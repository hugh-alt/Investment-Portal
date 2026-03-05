import { PrismaClient } from "../src/generated/prisma/client";
import { SAAScope, TaxonomyNodeType } from "../src/generated/prisma/enums";

const DEFAULT_BAND = 0.02; // ±2%

function clamp(v: number) {
  return Math.max(0, Math.min(1, v));
}

export async function seedSAA(prisma: PrismaClient, adviserId: string, clientIds: string[]) {
  const taxonomy = await prisma.taxonomy.findFirst({
    where: { name: "Default SAA Taxonomy" },
    include: { nodes: true },
  });
  if (!taxonomy) {
    console.log("Skipping SAA seed: no taxonomy");
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

  // Clean existing SAAs for idempotency
  await prisma.clientSAA.deleteMany({});
  await prisma.sAA.deleteMany({});

  // 1. Firm SAA — "Balanced Growth"
  const firmTargets: { nodeId: string; weight: number }[] = [];
  if (ausEqGrowth) firmTargets.push({ nodeId: ausEqGrowth.id, weight: 0.30 });
  if (intlEqGrowth) firmTargets.push({ nodeId: intlEqGrowth.id, weight: 0.25 });
  if (ausEqDef) firmTargets.push({ nodeId: ausEqDef.id, weight: 0.15 });
  if (fixedInc) firmTargets.push({ nodeId: fixedInc.id, weight: 0.30 });

  const firmSAA = await prisma.sAA.create({
    data: {
      name: "Balanced Growth",
      taxonomyId: taxonomy.id,
      ownerScope: SAAScope.FIRM,
      allocations: {
        create: firmTargets.map((t) => ({
          nodeId: t.nodeId,
          targetWeight: t.weight,
          minWeight: clamp(t.weight - DEFAULT_BAND),
          maxWeight: clamp(t.weight + DEFAULT_BAND),
        })),
      },
    },
  });

  // 2. Adviser SAA — "High Growth"
  const advTargets: { nodeId: string; weight: number }[] = [];
  if (ausEqGrowth) advTargets.push({ nodeId: ausEqGrowth.id, weight: 0.40 });
  if (intlEqGrowth) advTargets.push({ nodeId: intlEqGrowth.id, weight: 0.35 });
  if (ausEqDef) advTargets.push({ nodeId: ausEqDef.id, weight: 0.10 });
  if (fixedInc) advTargets.push({ nodeId: fixedInc.id, weight: 0.15 });

  await prisma.sAA.create({
    data: {
      name: "High Growth",
      taxonomyId: taxonomy.id,
      ownerScope: SAAScope.ADVISER,
      adviserId,
      allocations: {
        create: advTargets.map((t) => ({
          nodeId: t.nodeId,
          targetWeight: t.weight,
          minWeight: clamp(t.weight - DEFAULT_BAND),
          maxWeight: clamp(t.weight + DEFAULT_BAND),
        })),
      },
    },
  });

  // Assign firm SAA to first 3 clients, leave last 2 unassigned
  for (let i = 0; i < Math.min(3, clientIds.length); i++) {
    await prisma.clientSAA.create({
      data: { clientId: clientIds[i], saaId: firmSAA.id },
    });
  }

  console.log("Created 2 SAAs (Balanced Growth + High Growth) with ±2% bands, assigned to 3 clients");
}
