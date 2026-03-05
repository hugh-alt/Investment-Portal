"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role } from "@/generated/prisma/enums";

export async function setTaxonomyLiquidityDefaultAction(
  taxonomyId: string,
  nodeId: string,
  formData: FormData,
) {
  await requireRole(Role.ADMIN);

  const tier = formData.get("tier") as string;
  const horizonDays = parseInt(formData.get("horizonDays") as string, 10);
  const stressedHaircutPct = parseFloat(formData.get("stressedHaircutPct") as string) / 100;

  if (!tier || isNaN(horizonDays) || isNaN(stressedHaircutPct)) {
    return;
  }

  // Upsert: find or create a matching profile, then set the default
  const profile = await prisma.liquidityProfile.create({
    data: {
      tier: tier as "LISTED" | "FUND_LIQUID" | "FUND_SEMI_LIQUID" | "PRIVATE" | "LOCKED",
      horizonDays,
      stressedHaircutPct,
    },
  });

  await prisma.taxonomyLiquidityDefault.upsert({
    where: { taxonomyNodeId: nodeId },
    update: { liquidityProfileId: profile.id },
    create: { taxonomyNodeId: nodeId, liquidityProfileId: profile.id },
  });

  revalidatePath(`/admin/taxonomy/${taxonomyId}/liquidity-defaults`);
}

export async function removeTaxonomyLiquidityDefaultAction(
  taxonomyId: string,
  nodeId: string,
) {
  await requireRole(Role.ADMIN);

  await prisma.taxonomyLiquidityDefault.deleteMany({
    where: { taxonomyNodeId: nodeId },
  });

  revalidatePath(`/admin/taxonomy/${taxonomyId}/liquidity-defaults`);
}
