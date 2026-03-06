/**
 * Seeds CMA sets with assumptions for the demo taxonomy asset classes.
 * v1.1: Seeds 3 sets (1 ACTIVE default, 1 ACTIVE alternate, 1 RETIRED)
 *       plus 1 client CMA selection override.
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { TaxonomyNodeType, CMASetStatus } from "../src/generated/prisma/enums";

// Assumptions: nodeParent:nodeName → { expReturn, vol }
const BASE_ASSUMPTIONS: Record<string, { expReturn: number; vol: number }> = {
  "Growth:Australian Equities":       { expReturn: 0.082, vol: 0.165 },
  "Growth:International Equities":    { expReturn: 0.090, vol: 0.180 },
  "Defensive:Australian Equities":    { expReturn: 0.065, vol: 0.120 },
  "Defensive:Fixed Income":           { expReturn: 0.040, vol: 0.050 },
};

// Bull case: higher returns, similar vol
const BULL_ASSUMPTIONS: Record<string, { expReturn: number; vol: number }> = {
  "Growth:Australian Equities":       { expReturn: 0.100, vol: 0.170 },
  "Growth:International Equities":    { expReturn: 0.110, vol: 0.185 },
  "Defensive:Australian Equities":    { expReturn: 0.075, vol: 0.125 },
  "Defensive:Fixed Income":           { expReturn: 0.045, vol: 0.055 },
};

// Retired set: old assumptions
const RETIRED_ASSUMPTIONS: Record<string, { expReturn: number; vol: number }> = {
  "Growth:Australian Equities":       { expReturn: 0.070, vol: 0.160 },
  "Growth:International Equities":    { expReturn: 0.080, vol: 0.175 },
  "Defensive:Australian Equities":    { expReturn: 0.055, vol: 0.115 },
  "Defensive:Fixed Income":           { expReturn: 0.035, vol: 0.045 },
};

function buildAssumptionData(
  assumptions: Record<string, { expReturn: number; vol: number }>,
  nodeByKey: Map<string, string>,
) {
  const data: { taxonomyNodeId: string; expReturnPct: number; volPct: number }[] = [];
  for (const [key, { expReturn, vol }] of Object.entries(assumptions)) {
    const nodeId = nodeByKey.get(key);
    if (nodeId) {
      data.push({ taxonomyNodeId: nodeId, expReturnPct: expReturn, volPct: vol });
    }
  }
  return data;
}

export async function seedCMA(prisma: PrismaClient, adminUserId: string, wealthGroupId?: string) {
  // Clean up
  await prisma.clientCMASelection.deleteMany({});
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

  // 1. ACTIVE default: "2026 Base Case"
  await prisma.cMASet.create({
    data: {
      name: "2026 Base Case",
      description: "Standard long-term assumptions for balanced portfolios",
      isDefault: true,
      status: CMASetStatus.ACTIVE,
      effectiveDate: new Date("2026-01-01"),
      wealthGroupId: wealthGroupId ?? null,
      createdByUserId: adminUserId,
      assumptions: { create: buildAssumptionData(BASE_ASSUMPTIONS, nodeByKey) },
    },
  });

  // 2. ACTIVE alternate: "2026 Bull Case"
  const bullSet = await prisma.cMASet.create({
    data: {
      name: "2026 Bull Case",
      description: "Optimistic scenario with higher growth expectations",
      isDefault: false,
      status: CMASetStatus.ACTIVE,
      effectiveDate: new Date("2026-01-01"),
      wealthGroupId: wealthGroupId ?? null,
      createdByUserId: adminUserId,
      assumptions: { create: buildAssumptionData(BULL_ASSUMPTIONS, nodeByKey) },
    },
  });

  // 3. RETIRED: "2025 Base Case"
  await prisma.cMASet.create({
    data: {
      name: "2025 Base Case",
      description: "Previous year assumptions — retired",
      isDefault: false,
      status: CMASetStatus.RETIRED,
      effectiveDate: new Date("2025-01-01"),
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

  console.log("Created 3 CMA sets (1 ACTIVE default, 1 ACTIVE alternate, 1 RETIRED), 1 client selection");
}
