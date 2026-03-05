/**
 * Seeds a CLIENT_APPROVED rebalance plan for the first client (Alice)
 * so that the execution flow is immediately demoable.
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { MappingScope, TaxonomyNodeType } from "../src/generated/prisma/enums";
import { computeAllocation, type HoldingInput, type MappingInput } from "../src/lib/allocation";
import { generateRebalanceTrades, type RebalanceHolding, type RebalanceTarget } from "../src/lib/rebalance";

export async function seedRebalance(
  prisma: PrismaClient,
  clientId: string,
  adviserUserId: string,
) {
  // Clean up existing rebalance data
  await prisma.rebalanceApprovalEvent.deleteMany({});
  await prisma.rebalanceTrade.deleteMany({});
  await prisma.rebalancePlan.deleteMany({});

  // Get client SAA
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

  if (!clientSAA?.saa) {
    console.log("Skipping rebalance seed: no SAA assigned");
    return;
  }

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

  // Get holdings
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

  const mapByProduct = new Map(mappings.map((m) => [m.productId, m]));
  const rebalanceHoldings: RebalanceHolding[] = [];

  for (const a of accounts) {
    for (const h of a.holdings) {
      if (h.product.type === "MANAGED_PORTFOLIO" && h.lookthroughHoldings.length > 0) {
        for (const lt of h.lookthroughHoldings) {
          const m = mapByProduct.get(lt.underlyingProductId);
          if (m) {
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
    console.log("Skipping rebalance seed: portfolio within tolerance");
    return;
  }

  // Create a CLIENT_APPROVED plan with approval events
  await prisma.rebalancePlan.create({
    data: {
      clientId,
      saaId: saa.id,
      status: "CLIENT_APPROVED",
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
      events: {
        create: [
          {
            action: "APPROVE",
            actorUserId: adviserUserId,
            actorRole: "ADVISER",
          },
          {
            action: "APPROVE",
            actorUserId: adviserUserId,
            actorRole: "ADVISER",
          },
        ],
      },
    },
  });

  console.log(`Created CLIENT_APPROVED rebalance plan with ${result.trades.length} trades for ${clientId}`);
}
