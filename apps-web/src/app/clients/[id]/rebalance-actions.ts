"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MappingScope, TaxonomyNodeType } from "@/generated/prisma/enums";
import { computeAllocation, type HoldingInput, type MappingInput } from "@/lib/allocation";
import { generateRebalanceTrades, type RebalanceHolding, type RebalanceTarget } from "@/lib/rebalance";
import { validateTransition, type ApprovalAction, type ActorRole } from "@/lib/approval";
import { canCreateOrders, canSubmitOrders, canFillOrders, type ExecutionStatus } from "@/lib/execution";

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

// ── Execution actions ─────────────────────────────────

export async function createRebalanceOrdersAction(
  planId: string,
): Promise<{ error?: string }> {
  await requireUser();

  const plan = await prisma.rebalancePlan.findUnique({
    where: { id: planId },
    include: { trades: true },
  });
  if (!plan) return { error: "Plan not found" };

  const existingOrders = await prisma.order.count({
    where: { sourceId: planId },
  });

  const check = canCreateOrders(plan.status, existingOrders);
  if (!check.ok) return { error: check.error };

  await prisma.order.createMany({
    data: plan.trades.map((t) => ({
      clientId: plan.clientId,
      source: "REBALANCE_PLAN" as const,
      sourceId: planId,
      productId: t.productId,
      side: t.side as "BUY" | "SELL",
      amount: t.amount,
      status: "CREATED" as const,
    })),
  });

  const orders = await prisma.order.findMany({
    where: { sourceId: planId },
    select: { id: true },
  });
  await prisma.orderEvent.createMany({
    data: orders.map((o) => ({
      orderId: o.id,
      status: "CREATED" as const,
      note: "Order created from rebalance plan",
    })),
  });

  revalidatePath(`/clients/${plan.clientId}`);
  return {};
}

export async function submitRebalanceOrdersAction(
  planId: string,
): Promise<{ error?: string }> {
  await requireUser();

  const plan = await prisma.rebalancePlan.findUnique({ where: { id: planId } });
  if (!plan) return { error: "Plan not found" };

  const orders = await prisma.order.findMany({
    where: { sourceId: planId },
  });

  const statuses = orders.map((o) => o.status as ExecutionStatus);
  const check = canSubmitOrders(statuses);
  if (!check.ok) return { error: check.error };

  const createdOrders = orders.filter((o) => o.status === "CREATED");

  await prisma.$transaction(
    createdOrders.flatMap((o) => [
      prisma.order.update({
        where: { id: o.id },
        data: { status: "SUBMITTED" },
      }),
      prisma.orderEvent.create({
        data: {
          orderId: o.id,
          status: "SUBMITTED",
          note: "Simulated submission to platform",
        },
      }),
    ]),
  );

  revalidatePath(`/clients/${plan.clientId}`);
  return {};
}

export async function fillRebalanceOrdersAction(
  planId: string,
): Promise<{ error?: string }> {
  await requireUser();

  const plan = await prisma.rebalancePlan.findUnique({ where: { id: planId } });
  if (!plan) return { error: "Plan not found" };

  const orders = await prisma.order.findMany({
    where: { sourceId: planId },
  });

  const statuses = orders.map((o) => o.status as ExecutionStatus);
  const check = canFillOrders(statuses);
  if (!check.ok) return { error: check.error };

  const fillable = orders.filter(
    (o) => o.status === "SUBMITTED" || o.status === "PARTIALLY_FILLED",
  );

  const partialIdx = fillable.length > 1 ? Math.floor(Math.random() * fillable.length) : -1;

  type ExecStatus = "FILLED" | "PARTIALLY_FILLED";
  const ops = fillable.flatMap((o, i) => {
    let newStatus: ExecStatus;
    let note: string;

    if (i === partialIdx && o.status === "SUBMITTED") {
      newStatus = "PARTIALLY_FILLED";
      note = `Simulated partial fill: ${Math.floor(50 + Math.random() * 40)}% filled`;
    } else {
      newStatus = "FILLED";
      note = "Simulated full fill";
    }

    return [
      prisma.order.update({
        where: { id: o.id },
        data: { status: newStatus },
      }),
      prisma.orderEvent.create({
        data: {
          orderId: o.id,
          status: newStatus,
          note,
        },
      }),
    ];
  });

  await prisma.$transaction(ops);

  revalidatePath(`/clients/${plan.clientId}`);
  return {};
}
