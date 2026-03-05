/**
 * Seeds liquidity profiles, taxonomy defaults, and product overrides.
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { TaxonomyNodeType } from "../src/generated/prisma/enums";

export async function seedLiquidityProfiles(prisma: PrismaClient) {
  // Clean up existing data
  await prisma.productLiquidityOverride.deleteMany();
  await prisma.taxonomyLiquidityDefault.deleteMany();
  await prisma.liquidityProfile.deleteMany();

  // ── Create profiles ──

  const listedT2 = await prisma.liquidityProfile.create({
    data: {
      id: "lp-listed-t2",
      tier: "LISTED",
      horizonDays: 2,
      stressedHaircutPct: 0.02,
      redeemFrequency: "Daily",
    },
  });

  const fundLiquid = await prisma.liquidityProfile.create({
    data: {
      id: "lp-fund-liquid",
      tier: "FUND_LIQUID",
      horizonDays: 30,
      stressedHaircutPct: 0.05,
      noticeDays: 5,
      redeemFrequency: "Daily",
    },
  });

  const fundSemiLiquid = await prisma.liquidityProfile.create({
    data: {
      id: "lp-fund-semi",
      tier: "FUND_SEMI_LIQUID",
      horizonDays: 90,
      stressedHaircutPct: 0.10,
      noticeDays: 30,
      redeemFrequency: "Quarterly",
      gatePctPerPeriod: 0.25,
    },
  });

  const privateTier = await prisma.liquidityProfile.create({
    data: {
      id: "lp-private",
      tier: "PRIVATE",
      horizonDays: 365,
      stressedHaircutPct: 0.20,
      noticeDays: 90,
      redeemFrequency: "None",
    },
  });

  const lockedGated = await prisma.liquidityProfile.create({
    data: {
      id: "lp-locked-gated",
      tier: "LOCKED",
      horizonDays: 730,
      stressedHaircutPct: 0.25,
      gateOrSuspendRisk: true,
      noticeDays: 180,
      redeemFrequency: "None",
    },
  });

  // ── Taxonomy defaults ──
  // Find taxonomy nodes for asset classes
  const taxonomy = await prisma.taxonomy.findFirst({
    where: { name: "Default SAA Taxonomy" },
    include: { nodes: true },
  });

  if (!taxonomy) {
    console.log("Skipping liquidity profile taxonomy defaults: no taxonomy found");
    return;
  }

  const assetClassNodes = taxonomy.nodes.filter(
    (n) => n.nodeType === TaxonomyNodeType.ASSET_CLASS,
  );

  for (const node of assetClassNodes) {
    // Australian Equities / International Equities → listed
    // Fixed Income → fund liquid
    let profileId = listedT2.id;
    if (node.name.includes("Fixed Income")) {
      profileId = fundLiquid.id;
    }

    await prisma.taxonomyLiquidityDefault.create({
      data: {
        taxonomyNodeId: node.id,
        liquidityProfileId: profileId,
      },
    });
  }

  // Also set defaults for risk bucket nodes as fallback
  const riskNodes = taxonomy.nodes.filter(
    (n) => n.nodeType === TaxonomyNodeType.RISK,
  );
  for (const node of riskNodes) {
    // Growth → listed, Defensive → fund liquid
    const profileId = node.name === "Defensive" ? fundLiquid.id : listedT2.id;
    await prisma.taxonomyLiquidityDefault.create({
      data: {
        taxonomyNodeId: node.id,
        liquidityProfileId: profileId,
      },
    });
  }

  // ── Product overrides ──
  // Override managed portfolios as fund-liquid (30d) and one fund as semi-liquid

  await prisma.productLiquidityOverride.create({
    data: {
      productId: "prod-mp1",
      liquidityProfileId: fundLiquid.id,
      source: "PLATFORM_SUPER_ADMIN",
    },
  });

  await prisma.productLiquidityOverride.create({
    data: {
      productId: "prod-f2",
      liquidityProfileId: fundSemiLiquid.id,
      source: "PLATFORM_SUPER_ADMIN",
    },
  });

  // Locked + gated override for Australian Foundation Fund
  await prisma.productLiquidityOverride.create({
    data: {
      productId: "prod-f1",
      liquidityProfileId: lockedGated.id,
      source: "PLATFORM_SUPER_ADMIN",
    },
  });

  const defaultCount = assetClassNodes.length + riskNodes.length;
  console.log(
    `Created 5 liquidity profiles, ${defaultCount} taxonomy defaults, 3 product overrides (incl. 1 LOCKED+gated)`,
  );
}
