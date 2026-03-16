"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const setOverrideSchema = z.object({
  productId: z.string().min(1),
  tier: z.enum(["LISTED", "FUND_LIQUID", "FUND_SEMI_LIQUID", "PRIVATE", "LOCKED"]),
  horizonDays: z.coerce.number().int().min(1),
  stressedHaircutPct: z.coerce.number().min(0).max(100),
  noticeDays: z.coerce.number().int().min(0).optional(),
  gatePctPerPeriod: z.coerce.number().min(0).max(100).optional(),
  gatePeriodDays: z.coerce.number().int().min(1).optional(),
});

export async function setAdviserLiquidityOverrideAction(
  _prev: { error?: string } | null,
  formData: FormData,
) {
  const user = await requireRole("ADVISER", "ADMIN");

  const parsed = setOverrideSchema.safeParse({
    productId: formData.get("productId"),
    tier: formData.get("tier"),
    horizonDays: formData.get("horizonDays"),
    stressedHaircutPct: formData.get("stressedHaircutPct"),
    noticeDays: formData.get("noticeDays") || undefined,
    gatePctPerPeriod: formData.get("gatePctPerPeriod") || undefined,
    gatePeriodDays: formData.get("gatePeriodDays") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Find adviser record
  const adviser = await prisma.adviser.findUnique({
    where: { userId: user.id },
  });
  if (!adviser) return { error: "No adviser record found for user" };

  // Check product exists
  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
  });
  if (!product) return { error: "Product not found" };

  // Check no platform override exists (platform truth takes precedence)
  const platformOverride = await prisma.productLiquidityOverride.findUnique({
    where: { productId: parsed.data.productId },
  });
  if (platformOverride) {
    return { error: "Cannot override — this product has a platform-level override set by Super Admin" };
  }

  // Create profile and upsert override
  const profile = await prisma.liquidityProfile.create({
    data: {
      tier: parsed.data.tier,
      horizonDays: parsed.data.horizonDays,
      stressedHaircutPct: parsed.data.stressedHaircutPct / 100,
      noticeDays: parsed.data.noticeDays ?? null,
      gatePctPerPeriod: parsed.data.gatePctPerPeriod != null ? parsed.data.gatePctPerPeriod / 100 : null,
      gatePeriodDays: parsed.data.gatePeriodDays ?? null,
    },
  });

  await prisma.adviserLiquidityOverride.upsert({
    where: {
      adviserId_productId: {
        adviserId: adviser.id,
        productId: parsed.data.productId,
      },
    },
    update: { liquidityProfileId: profile.id },
    create: {
      adviserId: adviser.id,
      productId: parsed.data.productId,
      liquidityProfileId: profile.id,
    },
  });

  revalidatePath("/adviser/liquidity-overrides");
  return null;
}

export async function removeAdviserLiquidityOverrideAction(productId: string) {
  const user = await requireRole("ADVISER", "ADMIN");

  const adviser = await prisma.adviser.findUnique({
    where: { userId: user.id },
  });
  if (!adviser) return;

  await prisma.adviserLiquidityOverride.deleteMany({
    where: { adviserId: adviser.id, productId },
  });

  revalidatePath("/adviser/liquidity-overrides");
}
