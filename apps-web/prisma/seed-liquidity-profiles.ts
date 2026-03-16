/**
 * Seeds liquidity profiles, taxonomy defaults, product overrides, and adviser overrides.
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { TaxonomyNodeType } from "../src/generated/prisma/enums";

export async function seedLiquidityProfiles(prisma: PrismaClient) {
  // Clean up existing data
  await prisma.adviserLiquidityOverride.deleteMany();
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

  await prisma.liquidityProfile.create({
    data: {
      id: "lp-fund-semi",
      tier: "FUND_SEMI_LIQUID",
      horizonDays: 90,
      stressedHaircutPct: 0.10,
      noticeDays: 30,
      redeemFrequency: "Quarterly",
      gatePctPerPeriod: 0.25,
      gatePeriodDays: 90,
    },
  });

  await prisma.liquidityProfile.create({
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

  // Gated product profile: 10% per 90 days gate
  const gatedProfile = await prisma.liquidityProfile.create({
    data: {
      id: "lp-gated-10-90",
      tier: "FUND_SEMI_LIQUID",
      horizonDays: 90,
      stressedHaircutPct: 0.10,
      noticeDays: 15,
      redeemFrequency: "Quarterly",
      gatePctPerPeriod: 0.10,
      gatePeriodDays: 90,
      gateOrSuspendRisk: true,
    },
  });

  // ── Taxonomy defaults ──
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

  const riskNodes = taxonomy.nodes.filter(
    (n) => n.nodeType === TaxonomyNodeType.RISK,
  );
  for (const node of riskNodes) {
    const profileId = node.name === "Defensive" ? fundLiquid.id : listedT2.id;
    await prisma.taxonomyLiquidityDefault.create({
      data: {
        taxonomyNodeId: node.id,
        liquidityProfileId: profileId,
      },
    });
  }

  // ── Product overrides (platform truth) ──

  await prisma.productLiquidityOverride.create({
    data: {
      productId: "prod-mp1",
      liquidityProfileId: fundLiquid.id,
      source: "PLATFORM_SUPER_ADMIN",
    },
  });

  // prod-f2 gets the gated profile (10% per 90 days) — platform truth
  await prisma.productLiquidityOverride.create({
    data: {
      productId: "prod-f2",
      liquidityProfileId: gatedProfile.id,
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

  // ── Adviser override ──
  // Find the first adviser and override a product from Listed to Semi-liquid
  const adviser = await prisma.adviser.findFirst();
  if (adviser) {
    // Create a semi-liquid profile for the adviser override
    const adviserSemiProfile = await prisma.liquidityProfile.create({
      data: {
        id: "lp-adviser-semi",
        tier: "FUND_SEMI_LIQUID",
        horizonDays: 90,
        stressedHaircutPct: 0.08,
        noticeDays: 20,
        redeemFrequency: "Monthly",
        gatePctPerPeriod: 0.15,
        gatePeriodDays: 30,
      },
    });

    // Find a product without a platform override to apply adviser override
    // Use a listed equity product (e.g. prod-eq1 or a fund without platform override)
    const productsWithoutPlatformOverride = await prisma.product.findMany({
      where: {
        liquidityOverride: null,
        type: { not: "MANAGED_PORTFOLIO" },
      },
      take: 1,
    });

    if (productsWithoutPlatformOverride.length > 0) {
      const targetProduct = productsWithoutPlatformOverride[0];
      await prisma.adviserLiquidityOverride.create({
        data: {
          adviserId: adviser.id,
          productId: targetProduct.id,
          liquidityProfileId: adviserSemiProfile.id,
        },
      });
      console.log(
        `Created adviser override: ${targetProduct.name} changed to FUND_SEMI_LIQUID (gate 15% per 30d)`,
      );
    }
  }

  const defaultCount = assetClassNodes.length + riskNodes.length;
  console.log(
    `Created 7 liquidity profiles, ${defaultCount} taxonomy defaults, 3 product overrides (incl. 1 gated 10%/90d), adviser override`,
  );
}
