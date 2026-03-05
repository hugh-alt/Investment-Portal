/**
 * Seeds firm-default taxonomy mappings for the demo taxonomy.
 * Leaves prod-vae (Vanguard Asia ETF) and prod-f2 (Hyperion Small Growth)
 * unmapped to demonstrate governance workflow.
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { MappingScope, TaxonomyNodeType } from "../src/generated/prisma/enums";

// Product → asset class name mapping (must match nodes created below)
const PRODUCT_ASSET_CLASS: Record<string, { assetClass: string; riskBucket: string }> = {
  "prod-bhp": { assetClass: "Australian Equities", riskBucket: "Growth" },
  "prod-cba": { assetClass: "Australian Equities", riskBucket: "Growth" },
  "prod-csl": { assetClass: "Australian Equities", riskBucket: "Growth" },
  "prod-wbc": { assetClass: "Australian Equities", riskBucket: "Growth" },
  "prod-nab": { assetClass: "Australian Equities", riskBucket: "Growth" },
  "prod-anz": { assetClass: "Australian Equities", riskBucket: "Growth" },
  "prod-rio": { assetClass: "Australian Equities", riskBucket: "Growth" },
  "prod-mqg": { assetClass: "Australian Equities", riskBucket: "Growth" },
  "prod-wes": { assetClass: "Australian Equities", riskBucket: "Growth" },
  "prod-tls": { assetClass: "Australian Equities", riskBucket: "Defensive" },
  "prod-vgs": { assetClass: "International Equities", riskBucket: "Growth" },
  "prod-vas": { assetClass: "Australian Equities", riskBucket: "Growth" },
  // prod-vae: intentionally unmapped
  "prod-mp1": { assetClass: "International Equities", riskBucket: "Growth" },
  "prod-mp2": { assetClass: "International Equities", riskBucket: "Growth" },
  "prod-f1":  { assetClass: "Fixed Income", riskBucket: "Defensive" },
  // prod-f2: intentionally unmapped
};

export async function seedMappings(prisma: PrismaClient) {
  // Find the default taxonomy
  const taxonomy = await prisma.taxonomy.findFirst({
    where: { name: "Default SAA Taxonomy" },
    include: { nodes: true },
  });
  if (!taxonomy) {
    console.log("Skipping mappings: no taxonomy found");
    return;
  }

  // Ensure asset class nodes exist under the right risk buckets
  const riskBuckets = taxonomy.nodes.filter((n) => n.nodeType === TaxonomyNodeType.RISK);
  const growthBucket = riskBuckets.find((n) => n.name === "Growth");
  const defensiveBucket = riskBuckets.find((n) => n.name === "Defensive");

  if (!growthBucket || !defensiveBucket) {
    console.log("Skipping mappings: missing Growth/Defensive risk buckets");
    return;
  }

  // Asset classes to ensure exist
  const ASSET_CLASSES: { name: string; parentId: string }[] = [
    { name: "Australian Equities", parentId: growthBucket.id },
    { name: "International Equities", parentId: growthBucket.id },
    { name: "Australian Equities", parentId: defensiveBucket.id },
    { name: "Fixed Income", parentId: defensiveBucket.id },
  ];

  const nodeMap = new Map<string, string>(); // "parentId:name" → nodeId

  // Index existing nodes
  for (const n of taxonomy.nodes) {
    if (n.parentId) {
      nodeMap.set(`${n.parentId}:${n.name}`, n.id);
    }
  }

  // Create missing asset class nodes
  for (const ac of ASSET_CLASSES) {
    const key = `${ac.parentId}:${ac.name}`;
    if (!nodeMap.has(key)) {
      const maxSort = await prisma.taxonomyNode.aggregate({
        where: { taxonomyId: taxonomy.id, parentId: ac.parentId },
        _max: { sortOrder: true },
      });
      const node = await prisma.taxonomyNode.create({
        data: {
          taxonomyId: taxonomy.id,
          parentId: ac.parentId,
          name: ac.name,
          nodeType: TaxonomyNodeType.ASSET_CLASS,
          sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        },
      });
      nodeMap.set(key, node.id);
    }
  }

  // Clear existing firm-default mappings for this taxonomy
  await prisma.productTaxonomyMap.deleteMany({
    where: { taxonomyId: taxonomy.id, scope: MappingScope.FIRM_DEFAULT },
  });

  // Create mappings
  for (const [productId, { assetClass, riskBucket }] of Object.entries(PRODUCT_ASSET_CLASS)) {
    const parentId = riskBucket === "Growth" ? growthBucket.id : defensiveBucket.id;
    const nodeId = nodeMap.get(`${parentId}:${assetClass}`);
    if (!nodeId) continue;

    await prisma.productTaxonomyMap.create({
      data: {
        taxonomyId: taxonomy.id,
        productId,
        nodeId,
        scope: MappingScope.FIRM_DEFAULT,
      },
    });
  }

  const mappedCount = Object.keys(PRODUCT_ASSET_CLASS).length;
  console.log(`Created ${mappedCount} firm-default mappings (2 products intentionally unmapped)`);
}
