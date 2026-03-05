"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MappingScope } from "@/generated/prisma/enums";

const mapSchema = z.object({
  taxonomyId: z.string().min(1),
  productId: z.string().min(1),
  nodeId: z.string().min(1, "Select a node"),
});

export type MapState = { error?: string; success?: boolean };

export async function setMappingAction(
  _prev: MapState,
  formData: FormData,
): Promise<MapState> {
  const user = await requireUser();
  if (!isAdmin(user)) return { error: "Not authorised" };

  const parsed = mapSchema.safeParse({
    taxonomyId: formData.get("taxonomyId"),
    productId: formData.get("productId"),
    nodeId: formData.get("nodeId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { taxonomyId, productId, nodeId } = parsed.data;

  // Upsert: delete old firm-default for this product, create new
  await prisma.productTaxonomyMap.deleteMany({
    where: { taxonomyId, productId, scope: MappingScope.FIRM_DEFAULT },
  });

  if (nodeId !== "__none__") {
    await prisma.productTaxonomyMap.create({
      data: { taxonomyId, productId, nodeId, scope: MappingScope.FIRM_DEFAULT },
    });
  }

  revalidatePath(`/admin/taxonomy/${taxonomyId}/mapping`);
  return { success: true };
}
