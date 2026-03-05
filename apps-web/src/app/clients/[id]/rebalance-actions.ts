"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MappingScope, TaxonomyNodeType } from "@/generated/prisma/enums";
import { computeAllocation, type HoldingInput, type MappingInput } from "@/lib/allocation";
import { generateRebalanceTrades, type RebalanceHolding, type RebalanceTarget } from "@/lib/rebalance";
import { validateTransition, type ApprovalAction, type ActorRole } from "@/lib/approval";

export type RebalanceFormState = { error?: string; success?: boolean } | null;

export async function generateRebalancePlanAction(
  clientId: string,
): Promise<{ error?: string }> {
  const user = await requireUser();

  // Get client with SAA and holdings
  const clientSAA = await prisma.clientSAA.findUnique({
    where: { clientId },
    include: {
      saa: {
        include: {
          allocations: { include: { node: true } },
          taxonomy: { include: { nodes: true } },
        },
      },
    },
  });

  if (!clientSAA?.saa) return { error: "No SAA assigned to this client" };

  const { saa } = clientSAA;
  const taxonomy = saa.taxonomy;

  // Build risk bucket lookup
  const riskBucketById = new Map<string, { id: string; name: string }>();
  const riskBuckets = taxonomy.nodes.filter((n) => n.nodeType === TaxonomyNodeType.RISK);
  for (const rb of riskBuckets) {
    riskBucketById.set(rb.id, { id: rb.id, name: rb.name });
  }
  for (const n of taxonomy.nodes) {
    if (n.parentId && riskBucketById.has(n.parentId)) {
      riskBucketById.set(n.id, riskBucketById.get(n.parentId)!);
    }
  }
  for (const n of taxonomy.nodes) {
    if (n.parentId && riskBucketById.has(n.parentId) && !riskBucketById.has(n.id)) {
      riskBucketById.set(n.id, riskBucketById.get(n.parentId)!);
    }
  }

  const nodeById = new Map(taxonomy.nodes.map((n) => [n.id, n]));

  // Get taxonomy mappings
  const productMaps = await prisma.productTaxonomyMap.findMany({
    where: {
      taxonomyId: taxonomy.id,
      OR: [
        { scope: MappingScope.FIRM_DEFAULT },
        { scope: MappingScope.CLIENT_OVERRIDE, clientId },
      ],
    },
  });

  const mappingsByProduct = new Map<string, (typeof productMaps)[number]>();
  for (const m of productMaps) {
    const existing = mappingsByProduct.get(m.productId);
    if (!existing || m.scope === MappingScope.CLIENT_OVERRIDE) {
      mappingsByProduct.set(m.productId, m);
    }
  }

  const mappings: MappingInput[] = [];
  for (const [, m] of mappingsByProduct) {
    const node = nodeById.get(m.nodeId);
    if (!node) continue;
    const rb = riskBucketById.get(m.nodeId);
    mappings.push({
      productId: m.productId,
      nodeId: m.nodeId,
      nodeName: node.name,
      nodeType: node.nodeType,
      riskBucketId: rb?.id ?? null,
      riskBucketName: rb?.name ?? null,
    });
  }

  // Get client holdings
  const accounts = await prisma.account.findMany({
    where: { clientId },
    include: {
      holdings: {
        include: {
          product: { select: { id: true, name: true, type: true } },
          lookthroughHoldings: {
            include: { underlyingProduct: { select: { name: true } } },
          },
        },
      },
    },
  });

  const holdingInputs: HoldingInput[] = accounts.flatMap((a) =>
    a.holdings.map((h) => ({
      productId: h.productId,
      productName: h.product.name,
      productType: h.product.type,
      marketValue: h.marketValue,
      lookthrough: h.lookthroughHoldings.map((lt) => ({
        underlyingProductId: lt.underlyingProductId,
        underlyingProductName: lt.underlyingProduct.name,
        underlyingMarketValue: lt.underlyingMarketValue,
        weight: lt.weight,
      })),
    })),
  );

  // Compute allocation to get per-product per-node values
  const allocation = computeAllocation(holdingInputs, mappings);

  // Build rebalance holdings: map each product to its taxonomy node
  // For look-through holdings, map underlyings individually
  const rebalanceHoldings: RebalanceHolding[] = [];
  const mapByProduct = new Map(mappings.map((m) => [m.productId, m]));

  for (const a of accounts) {
    for (const h of a.holdings) {
      if (h.product.type === "MANAGED_PORTFOLIO" && h.lookthroughHoldings.length > 0) {
        // Map each underlying
        for (const lt of h.lookthroughHoldings) {
          const m = mapByProduct.get(lt.underlyingProductId);
          if (m) {
            // Aggregate with existing entry for same product+node
            const existing = rebalanceHoldings.find(
              (rh) => rh.productId === lt.underlyingProductId && rh.nodeId === m.nodeId,
            );
            if (existing) {
              existing.marketValue += lt.underlyingMarketValue;
            } else {
              rebalanceHoldings.push({
                productId: lt.underlyingProductId,
                productName: lt.underlyingProduct.name,
                marketValue: lt.underlyingMarketValue,
                nodeId: m.nodeId,
                nodeName: m.nodeName,
              });
            }
          }
        }
      } else {
        const m = mapByProduct.get(h.productId);
        if (m) {
          const existing = rebalanceHoldings.find(
            (rh) => rh.productId === h.productId && rh.nodeId === m.nodeId,
          );
          if (existing) {
            existing.marketValue += h.marketValue;
          } else {
            rebalanceHoldings.push({
              productId: h.productId,
              productName: h.product.name,
              marketValue: h.marketValue,
              nodeId: m.nodeId,
              nodeName: m.nodeName,
            });
          }
        }
      }
    }
  }

  // Build targets
  const rebalanceTargets: RebalanceTarget[] = saa.allocations.map((a) => ({
    nodeId: a.nodeId,
    nodeName: a.node.name,
    targetWeight: a.targetWeight,
    minWeight: a.minWeight,
    maxWeight: a.maxWeight,
  }));

  const result = generateRebalanceTrades(rebalanceHoldings, rebalanceTargets, {
    minTradeAmount: 500,
  });

  if (result.trades.length === 0) {
    return { error: "Portfolio is within tolerance bands — no trades needed" };
  }

  // Persist plan
  await prisma.rebalancePlan.create({
    data: {
      clientId,
      saaId: saa.id,
      status: "DRAFT",
      summaryJson: JSON.stringify({
        totalPortfolioValue: result.totalPortfolioValue,
        breachesBefore: result.breachesBefore,
        breachesAfter: result.breachesAfter,
        beforeDrift: result.beforeDrift,
        afterDrift: result.afterDrift,
      }),
      trades: {
        create: result.trades.map((t) => ({
          productId: t.productId,
          side: t.side,
          amount: t.amount,
          reason: t.reason,
        })),
      },
    },
  });

  revalidatePath(`/clients/${clientId}`);
  return {};
}

export async function approveRebalancePlanAction(
  planId: string,
): Promise<{ error?: string }> {
  const user = await requireUser();

  const plan = await prisma.rebalancePlan.findUnique({ where: { id: planId } });
  if (!plan) return { error: "Plan not found" };

  const result = validateTransition(
    plan.status as "DRAFT" | "ADVISER_APPROVED" | "CLIENT_APPROVED" | "REJECTED",
    "APPROVE",
    user.role as ActorRole,
  );
  if (!result.ok) return { error: result.error };

  await prisma.rebalancePlan.update({
    where: { id: planId },
    data: {
      status: result.newStatus,
      events: {
        create: {
          action: "APPROVE",
          actorUserId: user.id,
          actorRole: user.role,
        },
      },
    },
  });

  revalidatePath(`/clients/${plan.clientId}`);
  return {};
}

export async function rejectRebalancePlanAction(
  planId: string,
  note?: string,
): Promise<{ error?: string }> {
  const user = await requireUser();

  const plan = await prisma.rebalancePlan.findUnique({ where: { id: planId } });
  if (!plan) return { error: "Plan not found" };

  const result = validateTransition(
    plan.status as "DRAFT" | "ADVISER_APPROVED" | "CLIENT_APPROVED" | "REJECTED",
    "REJECT",
    user.role as ActorRole,
  );
  if (!result.ok) return { error: result.error };

  await prisma.rebalancePlan.update({
    where: { id: planId },
    data: {
      status: result.newStatus,
      events: {
        create: {
          action: "REJECT",
          actorUserId: user.id,
          actorRole: user.role,
          note,
        },
      },
    },
  });

  revalidatePath(`/clients/${plan.clientId}`);
  return {};
}
