"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── Create CMA set ──

const createSetSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  effectiveDate: z.string().nullable().optional(),
});

export async function createCMASetAction(
  _prev: { error?: string } | null,
  formData: FormData,
) {
  const user = await requireRole("ADMIN");
  const parsed = createSetSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    effectiveDate: formData.get("effectiveDate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const cmaSet = await prisma.cMASet.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      effectiveDate: parsed.data.effectiveDate ? new Date(parsed.data.effectiveDate) : null,
      wealthGroupId: user.wealthGroupId,
      createdByUserId: user.id,
    },
  });

  redirect(`/admin/cma/${cmaSet.id}`);
}

// ── Upsert assumption ──

const assumptionSchema = z.object({
  cmaSetId: z.string().min(1),
  taxonomyNodeId: z.string().min(1),
  expReturnPctInput: z.coerce.number().min(-100).max(100),
  volPctInput: z.coerce.number().min(0).max(100),
});

export async function upsertAssumptionAction(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData,
) {
  await requireRole("ADMIN");
  const parsed = assumptionSchema.safeParse({
    cmaSetId: formData.get("cmaSetId"),
    taxonomyNodeId: formData.get("taxonomyNodeId"),
    expReturnPctInput: formData.get("expReturnPct"),
    volPctInput: formData.get("volPct"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { cmaSetId, taxonomyNodeId, expReturnPctInput, volPctInput } = parsed.data;
  const expReturnPct = expReturnPctInput / 100;
  const volPct = volPctInput / 100;

  await prisma.cMAAssumption.upsert({
    where: {
      cmaSetId_taxonomyNodeId: { cmaSetId, taxonomyNodeId },
    },
    update: { expReturnPct, volPct },
    create: { cmaSetId, taxonomyNodeId, expReturnPct, volPct },
  });

  revalidatePath(`/admin/cma/${cmaSetId}`);
  return { success: true };
}

// ── Delete assumption ──

export async function deleteAssumptionAction(cmaSetId: string, assumptionId: string) {
  await requireRole("ADMIN");
  await prisma.cMAAssumption.delete({ where: { id: assumptionId } });
  revalidatePath(`/admin/cma/${cmaSetId}`);
}

// ── Set as default (only ACTIVE sets) ──

export async function setDefaultCMASetAction(cmaSetId: string) {
  await requireRole("ADMIN");

  const target = await prisma.cMASet.findUnique({ where: { id: cmaSetId } });
  if (!target || target.status !== "ACTIVE") {
    return;
  }

  await prisma.cMASet.updateMany({
    where: { isDefault: true },
    data: { isDefault: false },
  });
  await prisma.cMASet.update({
    where: { id: cmaSetId },
    data: { isDefault: true },
  });

  revalidatePath("/admin/cma");
  revalidatePath(`/admin/cma/${cmaSetId}`);
}

// ── Update status ──

const validStatuses = ["DRAFT", "ACTIVE", "RETIRED"] as const;

export async function updateCMASetStatusAction(cmaSetId: string, status: string) {
  await requireRole("ADMIN");

  if (!validStatuses.includes(status as typeof validStatuses[number])) return;

  // If retiring the default, unset default
  const current = await prisma.cMASet.findUnique({ where: { id: cmaSetId } });
  if (!current) return;

  const updates: Record<string, unknown> = { status };

  if (status === "RETIRED" && current.isDefault) {
    updates.isDefault = false;
  }
  // If moving away from ACTIVE and it was default, unset default
  if (status !== "ACTIVE" && current.isDefault) {
    updates.isDefault = false;
  }

  await prisma.cMASet.update({
    where: { id: cmaSetId },
    data: updates,
  });

  revalidatePath("/admin/cma");
  revalidatePath(`/admin/cma/${cmaSetId}`);
}

// ── Delete CMA set ──

export async function deleteCMASetAction(cmaSetId: string) {
  await requireRole("ADMIN");
  // Remove any client selections pointing to this set first
  await prisma.clientCMASelection.deleteMany({ where: { cmaSetId } });
  await prisma.cMASet.delete({ where: { id: cmaSetId } });
  redirect("/admin/cma");
}
