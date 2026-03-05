/**
 * Seeds a default CMA set with assumptions for the demo taxonomy asset classes.
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { TaxonomyNodeType } from "../src/generated/prisma/enums";

// Assumptions: nodeParent:nodeName → { expReturn, vol }
const ASSUMPTIONS: Record<string, { expReturn: number; vol: number }> = {
  "Growth:Australian Equities":       { expReturn: 0.082, vol: 0.165 },
  "Growth:International Equities":    { expReturn: 0.090, vol: 0.180 },
  "Defensive:Australian Equities":    { expReturn: 0.065, vol: 0.120 },
  "Defensive:Fixed Income":           { expReturn: 0.040, vol: 0.050 },
};

export async function seedCMA(prisma: PrismaClient, adminUserId: string) {
  // Clean up
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

  const assumptionData: { taxonomyNodeId: string; expReturnPct: number; volPct: number }[] = [];
  for (const [key, { expReturn, vol }] of Object.entries(ASSUMPTIONS)) {
    const nodeId = nodeByKey.get(key);
    if (nodeId) {
      assumptionData.push({
        taxonomyNodeId: nodeId,
        expReturnPct: expReturn,
        volPct: vol,
      });
    }
  }

  await prisma.cMASet.create({
    data: {
      name: "2026 Base Case",
      description: "Standard long-term assumptions for balanced portfolios",
      isDefault: true,
      createdByUserId: adminUserId,
      assumptions: {
        create: assumptionData,
      },
    },
  });

  console.log(`Created default CMA set with ${assumptionData.length} assumptions`);
}
