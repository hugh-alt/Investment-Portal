import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { MappingScope } from "@/generated/prisma/enums";
import {
  resolveProfile,
  type LiquidityProfileData,
  type ProductMapping,
  type TaxonomyNode,
} from "@/lib/liquidity-profile";
import { ProductsTable } from "./products-table";

export default async function ProductsPage() {
  await requireSuperAdmin();

  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    include: {
      liquidityOverride: { include: { profile: true } },
    },
  });

  // Build resolution data
  const productOverrides = new Map<string, LiquidityProfileData>();
  for (const p of products) {
    if (p.liquidityOverride) {
      const pr = p.liquidityOverride.profile;
      productOverrides.set(p.id, {
        tier: pr.tier,
        horizonDays: pr.horizonDays,
        stressedHaircutPct: pr.stressedHaircutPct,
        gateOrSuspendRisk: pr.gateOrSuspendRisk,
      });
    }
  }

  const taxDefaultsRaw = await prisma.taxonomyLiquidityDefault.findMany({
    include: { profile: true },
  });
  const taxonomyDefaults = new Map<string, LiquidityProfileData>(
    taxDefaultsRaw.map((d) => [
      d.taxonomyNodeId,
      {
        tier: d.profile.tier,
        horizonDays: d.profile.horizonDays,
        stressedHaircutPct: d.profile.stressedHaircutPct,
        gateOrSuspendRisk: d.profile.gateOrSuspendRisk,
      },
    ]),
  );

  const taxonomy = await prisma.taxonomy.findFirst({
    include: {
      nodes: true,
      productMaps: { where: { scope: MappingScope.FIRM_DEFAULT } },
    },
    orderBy: { createdAt: "asc" },
  });

  const nodes = new Map<string, TaxonomyNode>(
    (taxonomy?.nodes ?? []).map((n) => [n.id, { id: n.id, parentId: n.parentId }]),
  );
  const productMappings: ProductMapping[] = (taxonomy?.productMaps ?? []).map((m) => ({
    productId: m.productId,
    nodeId: m.nodeId,
  }));

  // Resolve effective profile for each product
  const productData = products.map((p) => {
    const effective = resolveProfile(p.id, productMappings, productOverrides, taxonomyDefaults, nodes);
    const override = p.liquidityOverride
      ? {
          tier: p.liquidityOverride.profile.tier,
          horizonDays: p.liquidityOverride.profile.horizonDays,
          stressedHaircutPct: p.liquidityOverride.profile.stressedHaircutPct,
          gateOrSuspendRisk: p.liquidityOverride.profile.gateOrSuspendRisk,
          noticeDays: p.liquidityOverride.profile.noticeDays,
          redeemFrequency: p.liquidityOverride.profile.redeemFrequency,
          gatePctPerPeriod: p.liquidityOverride.profile.gatePctPerPeriod,
        }
      : null;
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      effective: {
        tier: effective.tier,
        horizonDays: effective.horizonDays,
        stressedHaircutPct: effective.stressedHaircutPct,
        gateOrSuspendRisk: effective.gateOrSuspendRisk,
        source: effective.source,
      },
      override,
    };
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Products
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Super Admin: view all products with their effective liquidity profile and set overrides.
      </p>
      <div className="mt-6">
        <ProductsTable products={productData} />
      </div>
    </div>
  );
}
