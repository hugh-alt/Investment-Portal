import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { AdviserOverrideForm } from "./adviser-override-form";

export default async function AdviserLiquidityOverridesPage() {
  const user = await requireRole("ADVISER", "ADMIN");

  const adviser = await prisma.adviser.findUnique({
    where: { userId: user.id },
  });

  if (!adviser) {
    return <p className="text-sm text-zinc-500">No adviser record found.</p>;
  }

  // Fetch all products
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, type: true },
  });

  // Fetch adviser's existing overrides
  const overrides = await prisma.adviserLiquidityOverride.findMany({
    where: { adviserId: adviser.id },
    include: {
      profile: true,
      product: { select: { name: true } },
    },
  });

  // Fetch platform overrides (to show which products can't be overridden)
  const platformOverrides = await prisma.productLiquidityOverride.findMany({
    select: { productId: true },
  });
  const platformOverrideIds = new Set(platformOverrides.map((o) => o.productId));

  const overrideData = overrides.map((o) => ({
    productId: o.productId,
    productName: o.product.name,
    tier: o.profile.tier,
    horizonDays: o.profile.horizonDays,
    stressedHaircutPct: o.profile.stressedHaircutPct,
    noticeDays: o.profile.noticeDays,
    gatePctPerPeriod: o.profile.gatePctPerPeriod,
    gatePeriodDays: o.profile.gatePeriodDays,
    gateOrSuspendRisk: o.profile.gateOrSuspendRisk,
  }));

  const productOptions = products.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    hasPlatformOverride: platformOverrideIds.has(p.id),
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Adviser Liquidity Overrides
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Override liquidity profiles for products within your scope. Platform-level overrides (set by
        Super Admin) cannot be changed here.
      </p>
      <div className="mt-6">
        <AdviserOverrideForm
          products={productOptions}
          existingOverrides={overrideData}
        />
      </div>
    </div>
  );
}
