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
  const user = await requireRole(Role.ADMIN);

  const tier = formData.get("tier") as string;
  const horizonDays = parseInt(formData.get("horizonDays") as string, 10);
  const stressedHaircutPct = parseFloat(formData.get("stressedHaircutPct") as string) / 100;

  if (!tier || isNaN(horizonDays) || isNaN(stressedHaircutPct)) {
    return;
  }

  // Create a matching profile, then set the default scoped to wealth group
  const profile = await prisma.liquidityProfile.create({
    data: {
      tier: tier as "LISTED" | "FUND_LIQUID" | "FUND_SEMI_LIQUID" | "PRIVATE" | "LOCKED",
      horizonDays,
      stressedHaircutPct,
    },
  });

  const wealthGroupId = user.wealthGroupId;

  // Find existing default for this node + wealth group
  const existing = await prisma.taxonomyLiquidityDefault.findFirst({
    where: { taxonomyNodeId: nodeId, wealthGroupId },
  });

  if (existing) {
    await prisma.taxonomyLiquidityDefault.update({
      where: { id: existing.id },
      data: { liquidityProfileId: profile.id },
    });
  } else {
    await prisma.taxonomyLiquidityDefault.create({
      data: { taxonomyNodeId: nodeId, liquidityProfileId: profile.id, wealthGroupId },
    });
  }

  revalidatePath(`/admin/taxonomy/${taxonomyId}/liquidity-defaults`);
}

export async function removeTaxonomyLiquidityDefaultAction(
  taxonomyId: string,
  nodeId: string,
) {
  const user = await requireRole(Role.ADMIN);

  await prisma.taxonomyLiquidityDefault.deleteMany({
    where: { taxonomyNodeId: nodeId, wealthGroupId: user.wealthGroupId },
  });

  revalidatePath(`/admin/taxonomy/${taxonomyId}/liquidity-defaults`);
}
