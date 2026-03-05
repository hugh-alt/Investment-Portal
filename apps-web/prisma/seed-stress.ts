/**
 * Seeds 2 stress scenarios (GFC-style + Rates shock) with shocks and one run.
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { TaxonomyNodeType, MappingScope } from "../src/generated/prisma/enums";

// Re-use the pure functions for computing results at seed time
import { computeAllocation } from "../src/lib/allocation";
import type { HoldingInput, MappingInput } from "../src/lib/allocation";
import { computeStressImpact } from "../src/lib/stress";
import type { NodeWeight, ShockInput } from "../src/lib/stress";

export async function seedStress(prisma: PrismaClient, adminUserId: string) {
  // Clean up existing stress data
  await prisma.stressResult.deleteMany({});
  await prisma.stressRun.deleteMany({});
  await prisma.stressShock.deleteMany({});
  await prisma.stressScenario.deleteMany({});

  // Find the default taxonomy
  const taxonomy = await prisma.taxonomy.findFirst({
    where: { name: "Default SAA Taxonomy" },
    include: { nodes: true },
  });
  if (!taxonomy) {
    console.log("Skipping stress seed: no taxonomy found");
    return;
  }

  const riskBuckets = taxonomy.nodes.filter((n) => n.nodeType === TaxonomyNodeType.RISK);
  const growthBucket = riskBuckets.find((n) => n.name === "Growth");
  const defensiveBucket = riskBuckets.find((n) => n.name === "Defensive");
  if (!growthBucket || !defensiveBucket) return;

  const assetClassNodes = taxonomy.nodes.filter((n) => n.nodeType === TaxonomyNodeType.ASSET_CLASS);
  const nodeByKey = new Map(assetClassNodes.map((n) => [`${n.parentId}:${n.name}`, n]));

  const ausEqGrowth = nodeByKey.get(`${growthBucket.id}:Australian Equities`);
  const intlEqGrowth = nodeByKey.get(`${growthBucket.id}:International Equities`);
  const ausEqDef = nodeByKey.get(`${defensiveBucket.id}:Australian Equities`);
  const fixedInc = nodeByKey.get(`${defensiveBucket.id}:Fixed Income`);

  if (!ausEqGrowth || !intlEqGrowth) {
    console.log("Skipping stress seed: missing asset class nodes");
    return;
  }

  // ── Scenario 1: GFC-style ──
  const gfcScenario = await prisma.stressScenario.create({
    data: {
      name: "GFC-style",
      description: "2008 global financial crisis scenario with severe equity drawdowns",
      createdByUserId: adminUserId,
      shocks: {
        create: [
          { taxonomyNodeId: ausEqGrowth.id, shockPct: -0.40 },
          { taxonomyNodeId: intlEqGrowth.id, shockPct: -0.45 },
          ...(ausEqDef ? [{ taxonomyNodeId: ausEqDef.id, shockPct: -0.25 }] : []),
          ...(fixedInc ? [{ taxonomyNodeId: fixedInc.id, shockPct: 0.05 }] : []),
        ],
      },
    },
  });

  // ── Scenario 2: Rates shock ──
  await prisma.stressScenario.create({
    data: {
      name: "Rates shock",
      description: "Sharp interest rate rise hitting fixed income and rate-sensitive equities",
      createdByUserId: adminUserId,
      shocks: {
        create: [
          { taxonomyNodeId: ausEqGrowth.id, shockPct: -0.10 },
          { taxonomyNodeId: intlEqGrowth.id, shockPct: -0.08 },
          ...(fixedInc ? [{ taxonomyNodeId: fixedInc.id, shockPct: -0.15 }] : []),
        ],
      },
    },
  });

  // ── Run the GFC scenario so results show immediately ──
  const gfcShocks = await prisma.stressShock.findMany({
    where: { scenarioId: gfcScenario.id },
  });

  // Build node parent map
  const nodeParents = new Map<string, string | null>();
  for (const n of taxonomy.nodes) {
    nodeParents.set(n.id, n.parentId);
  }

  // Build risk bucket lookup
  const riskBucketById = new Map<string, { id: string; name: string }>();
  for (const rb of riskBuckets) {
    riskBucketById.set(rb.id, { id: rb.id, name: rb.name });
  }
  for (const n of taxonomy.nodes) {
    if (n.parentId && riskBucketById.has(n.parentId)) {
      riskBucketById.set(n.id, riskBucketById.get(n.parentId)!);
    }
  }

  const nodeById = new Map(taxonomy.nodes.map((n) => [n.id, n]));

  // Fetch product mappings
  const productMaps = await prisma.productTaxonomyMap.findMany({
    where: { taxonomyId: taxonomy.id, scope: MappingScope.FIRM_DEFAULT },
  });

  // Fetch all clients with holdings
  const clients = await prisma.client.findMany({
    include: {
      accounts: {
        include: {
          holdings: {
            include: {
              product: { select: { name: true, type: true } },
              lookthroughHoldings: {
                include: { underlyingProduct: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  });

  const shockInputs: ShockInput[] = gfcShocks.map((s) => ({
    nodeId: s.taxonomyNodeId,
    shockPct: s.shockPct,
  }));

  const resultData: {
    clientId: string;
    estimatedImpactPct: number;
    detailsJson: string;
  }[] = [];

  for (const client of clients) {
    const holdingInputs: HoldingInput[] = client.accounts.flatMap((a) =>
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

    if (holdingInputs.length === 0) continue;

    const mappingsByProduct = new Map<string, (typeof productMaps)[number]>();
    for (const m of productMaps) {
      mappingsByProduct.set(m.productId, m);
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

    const allocation = computeAllocation(holdingInputs, mappings);

    const nodeWeights: NodeWeight[] = allocation.buckets.flatMap((b) =>
      b.assetClasses.map((ac) => {
        const node = nodeById.get(ac.nodeId);
        return {
          nodeId: ac.nodeId,
          nodeName: ac.nodeName,
          nodeType: node?.nodeType ?? "ASSET_CLASS",
          parentId: node?.parentId ?? null,
          weight: ac.pctOfTotal,
        };
      }),
    );

    const impact = computeStressImpact(nodeWeights, shockInputs, nodeParents);

    resultData.push({
      clientId: client.id,
      estimatedImpactPct: impact.estimatedImpactPct,
      detailsJson: JSON.stringify({
        details: impact.details,
        unmappedPct: impact.unmappedPct,
      }),
    });
  }

  // Create the run with results
  await prisma.stressRun.create({
    data: {
      scenarioId: gfcScenario.id,
      runByUserId: adminUserId,
      results: {
        create: resultData,
      },
    },
  });

  console.log(`Created 2 stress scenarios (GFC-style + Rates shock) with ${resultData.length} GFC run results`);
}
