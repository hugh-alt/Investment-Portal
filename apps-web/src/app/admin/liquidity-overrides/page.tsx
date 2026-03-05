import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { ProductOverrideTable } from "./product-override-table";

export default async function LiquidityOverridesPage() {
  await requireSuperAdmin();

  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    include: {
      liquidityOverride: { include: { profile: true } },
    },
  });

  const productData = products.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    override: p.liquidityOverride
      ? {
          tier: p.liquidityOverride.profile.tier,
          horizonDays: p.liquidityOverride.profile.horizonDays,
          stressedHaircutPct: p.liquidityOverride.profile.stressedHaircutPct,
          noticeDays: p.liquidityOverride.profile.noticeDays,
          redeemFrequency: p.liquidityOverride.profile.redeemFrequency,
          gatePctPerPeriod: p.liquidityOverride.profile.gatePctPerPeriod,
        }
      : null,
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Product Liquidity Overrides
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Super Admin: set product-specific liquidity profiles that override taxonomy defaults.
      </p>
      <div className="mt-6">
        <ProductOverrideTable products={productData} />
      </div>
    </div>
  );
}
