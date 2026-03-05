"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";

export async function setProductLiquidityOverrideAction(
  productId: string,
  formData: FormData,
) {
  await requireSuperAdmin();

  const tier = formData.get("tier") as string;
  const horizonDays = parseInt(formData.get("horizonDays") as string, 10);
  const stressedHaircutPct = parseFloat(formData.get("stressedHaircutPct") as string) / 100;
  const noticeDays = formData.get("noticeDays") ? parseInt(formData.get("noticeDays") as string, 10) : null;
  const redeemFrequency = (formData.get("redeemFrequency") as string) || null;
  const gatePctPerPeriod = formData.get("gatePctPerPeriod")
    ? parseFloat(formData.get("gatePctPerPeriod") as string) / 100
    : null;

  if (!tier || isNaN(horizonDays) || isNaN(stressedHaircutPct)) return;

  const profile = await prisma.liquidityProfile.create({
    data: {
      tier: tier as "LISTED" | "FUND_LIQUID" | "FUND_SEMI_LIQUID" | "PRIVATE" | "LOCKED",
      horizonDays,
      stressedHaircutPct,
      noticeDays: isNaN(noticeDays!) ? null : noticeDays,
      redeemFrequency,
      gatePctPerPeriod: isNaN(gatePctPerPeriod!) ? null : gatePctPerPeriod,
    },
  });

  await prisma.productLiquidityOverride.upsert({
    where: { productId },
    update: { liquidityProfileId: profile.id },
    create: {
      productId,
      liquidityProfileId: profile.id,
      source: "PLATFORM_SUPER_ADMIN",
    },
  });

  revalidatePath("/admin/liquidity-overrides");
}

export async function removeProductLiquidityOverrideAction(productId: string) {
  await requireSuperAdmin();

  await prisma.productLiquidityOverride.deleteMany({
    where: { productId },
  });

  revalidatePath("/admin/liquidity-overrides");
}
