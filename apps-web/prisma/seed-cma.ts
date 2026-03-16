/**
 * Seeds CMA sets with assumptions for the demo taxonomy asset classes.
 * v1.2: Adds incomeYieldPct per assumption and riskFreeRatePct per set.
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { TaxonomyNodeType, CMASetStatus } from "../src/generated/prisma/enums";

// Assumptions: nodeParent:nodeName → { expReturn, vol, incomeYield }
const BASE_ASSUMPTIONS: Record<string, { expReturn: number; vol: number; incomeYield: number }> = {
  "Growth:Australian Equities":       { expReturn: 0.082, vol: 0.165, incomeYield: 0.040 },
  "Growth:International Equities":    { expReturn: 0.090, vol: 0.180, incomeYield: 0.020 },
  "Defensive:Australian Equities":    { expReturn: 0.065, vol: 0.120, incomeYield: 0.045 },
  "Defensive:Fixed Income":           { expReturn: 0.040, vol: 0.050, incomeYield: 0.035 },
};

// Bull case: higher returns, similar vol
const BULL_ASSUMPTIONS: Record<string, { expReturn: number; vol: number; incomeYield: number }> = {
  "Growth:Australian Equities":       { expReturn: 0.100, vol: 0.170, incomeYield: 0.042 },
  "Growth:International Equities":    { expReturn: 0.110, vol: 0.185, incomeYield: 0.022 },
  "Defensive:Australian Equities":    { expReturn: 0.075, vol: 0.125, incomeYield: 0.048 },
  "Defensive:Fixed Income":           { expReturn: 0.045, vol: 0.055, incomeYield: 0.038 },
};

// Retired set: old assumptions
const RETIRED_ASSUMPTIONS: Record<string, { expReturn: number; vol: number; incomeYield: number }> = {
  "Growth:Australian Equities":       { expReturn: 0.070, vol: 0.160, incomeYield: 0.038 },
  "Growth:International Equities":    { expReturn: 0.080, vol: 0.175, incomeYield: 0.018 },
  "Defensive:Australian Equities":    { expReturn: 0.055, vol: 0.115, incomeYield: 0.042 },
  "Defensive:Fixed Income":           { expReturn: 0.035, vol: 0.045, incomeYield: 0.032 },
};

function buildAssumptionData(
  assumptions: Record<string, { expReturn: number; vol: number; incomeYield: number }>,
  nodeByKey: Map<string, string>,
) {
  const data: { taxonomyNodeId: string; expReturnPct: number; volPct: number; incomeYieldPct: number }[] = [];
  for (const [key, { expReturn, vol, incomeYield }] of Object.entries(assumptions)) {
    const nodeId = nodeByKey.get(key);
    if (nodeId) {
      data.push({ taxonomyNodeId: nodeId, expReturnPct: expReturn, volPct: vol, incomeYieldPct: incomeYield });
    }
  }
  return data;
}

// Correlations for Base Case (PSD-valid "typical" correlations)
const BASE_CORRELATIONS: [string, string, number][] = [
  ["Growth:Australian Equities", "Growth:International Equities", 0.75],
  ["Growth:Australian Equities", "Defensive:Australian Equities", 0.60],
  ["Growth:Australian Equities", "Defensive:Fixed Income", 0.15],
  ["Growth:International Equities", "Defensive:Australian Equities", 0.55],
  ["Growth:International Equities", "Defensive:Fixed Income", 0.10],
  ["Defensive:Australian Equities", "Defensive:Fixed Income", 0.30],
];

// Intentionally non-PSD correlations for the DRAFT set (to demonstrate validation)
const NON_PSD_CORRELATIONS: [string, string, number][] = [
  ["Growth:Australian Equities", "Growth:International Equities", 0.90],
  ["Growth:Australian Equities", "Defensive:Australian Equities", 0.90],
  ["Growth:Australian Equities", "Defensive:Fixed Income", 0.90],
  ["Growth:International Equities", "Defensive:Australian Equities", -0.90],
  ["Growth:International Equities", "Defensive:Fixed Income", -0.90],
  ["Defensive:Australian Equities", "Defensive:Fixed Income", 0.90],
];

function buildCorrelationData(
  pairs: [string, string, number][],
  nodeByKey: Map<string, string>,
) {
  const data: { nodeIdA: string; nodeIdB: string; corr: number }[] = [];
  for (const [keyA, keyB, corr] of pairs) {
    const idA = nodeByKey.get(keyA);
    const idB = nodeByKey.get(keyB);
    if (idA && idB) {
      data.push({ nodeIdA: idA, nodeIdB: idB, corr });
    }
  }
  return data;
}

export async function seedCMA(prisma: PrismaClient, adminUserId: string, wealthGroupId?: string) {
  // Clean up
  await prisma.clientCMASelection.deleteMany({});
  await prisma.cMACorrelation.deleteMany({});
  await prisma.cMAAssumption.deleteMany({});
  await prisma.cMASet.deleteMany({});

  const taxonomy = await prisma.taxonomy.findFirst({
    where: { name: "Default SAA Taxonomy" },
    include: { nodes: true },
  });
  if (!taxonomy) {
    console.log("Skipping CMA seed: no taxonomy found");
    return;
  }

  const riskBuckets = taxonomy.nodes.filter((n) => n.nodeType === TaxonomyNodeType.RISK);
  const assetClassNodes = taxonomy.nodes.filter((n) => n.nodeType === TaxonomyNodeType.ASSET_CLASS);

  // Build lookup: "BucketName:AssetClassName" → nodeId
  const riskBucketById = new Map(riskBuckets.map((n) => [n.id, n.name]));
  const nodeByKey = new Map<string, string>();
  for (const ac of assetClassNodes) {
    const bucketName = riskBucketById.get(ac.parentId ?? "");
    if (bucketName) {
      nodeByKey.set(`${bucketName}:${ac.name}`, ac.id);
    }
  }

  // 1. ACTIVE default: "2026 Base Case" (with PSD-valid correlations)
  await prisma.cMASet.create({
    data: {
      name: "2026 Base Case",
      description: "Standard long-term assumptions for balanced portfolios",
      isDefault: true,
      status: CMASetStatus.ACTIVE,
      effectiveDate: new Date("2026-01-01"),
      riskFreeRatePct: 0.03,
      wealthGroupId: wealthGroupId ?? null,
      createdByUserId: adminUserId,
      assumptions: { create: buildAssumptionData(BASE_ASSUMPTIONS, nodeByKey) },
      correlations: { create: buildCorrelationData(BASE_CORRELATIONS, nodeByKey) },
    },
  });

  // 2. ACTIVE alternate: "2026 Bull Case" (same correlations)
  const bullSet = await prisma.cMASet.create({
    data: {
      name: "2026 Bull Case",
      description: "Optimistic scenario with higher growth expectations",
      isDefault: false,
      status: CMASetStatus.ACTIVE,
      effectiveDate: new Date("2026-01-01"),
      riskFreeRatePct: 0.025,
      wealthGroupId: wealthGroupId ?? null,
      createdByUserId: adminUserId,
      assumptions: { create: buildAssumptionData(BULL_ASSUMPTIONS, nodeByKey) },
      correlations: { create: buildCorrelationData(BASE_CORRELATIONS, nodeByKey) },
    },
  });

  // 3. DRAFT: "Non-PSD Demo" (intentionally non-PSD for validation demo)
  await prisma.cMASet.create({
    data: {
      name: "Non-PSD Demo (draft)",
      description: "Demo set with intentionally non-PSD correlations — cannot activate",
      isDefault: false,
      status: CMASetStatus.DRAFT,
      effectiveDate: new Date("2026-01-01"),
      riskFreeRatePct: 0.03,
      wealthGroupId: wealthGroupId ?? null,
      createdByUserId: adminUserId,
      assumptions: { create: buildAssumptionData(BASE_ASSUMPTIONS, nodeByKey) },
      correlations: { create: buildCorrelationData(NON_PSD_CORRELATIONS, nodeByKey) },
    },
  });

  // 4. RETIRED: "2025 Base Case"
  await prisma.cMASet.create({
    data: {
      name: "2025 Base Case",
      description: "Previous year assumptions — retired",
      isDefault: false,
      status: CMASetStatus.RETIRED,
      effectiveDate: new Date("2025-01-01"),
      riskFreeRatePct: 0.035,
      wealthGroupId: wealthGroupId ?? null,
      createdByUserId: adminUserId,
      assumptions: { create: buildAssumptionData(RETIRED_ASSUMPTIONS, nodeByKey) },
    },
  });

  // 4. Client CMA selection: second client uses Bull Case
  const secondClient = await prisma.client.findFirst({
    where: { id: "seed-bob-williams" },
  });
  if (secondClient) {
    await prisma.clientCMASelection.create({
      data: {
        clientId: secondClient.id,
        cmaSetId: bullSet.id,
      },
    });
  }

  console.log("Created 4 CMA sets (with correlations + income yields + risk-free rates), 1 client selection");
}
