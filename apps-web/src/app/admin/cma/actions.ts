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
  riskFreeRatePct: z.coerce.number().min(-10).max(100).optional(),
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
    riskFreeRatePct: formData.get("riskFreeRatePct") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const riskFreeRate = parsed.data.riskFreeRatePct != null
    ? parsed.data.riskFreeRatePct / 100
    : 0.03;

  const cmaSet = await prisma.cMASet.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      effectiveDate: parsed.data.effectiveDate ? new Date(parsed.data.effectiveDate) : null,
      riskFreeRatePct: riskFreeRate,
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
  incomeYieldPctInput: z.coerce.number().min(0).max(100).optional(),
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
    incomeYieldPctInput: formData.get("incomeYieldPct") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { cmaSetId, taxonomyNodeId, expReturnPctInput, volPctInput, incomeYieldPctInput } = parsed.data;
  const expReturnPct = expReturnPctInput / 100;
  const volPct = volPctInput / 100;
  const incomeYieldPct = incomeYieldPctInput != null ? incomeYieldPctInput / 100 : 0;

  await prisma.cMAAssumption.upsert({
    where: {
      cmaSetId_taxonomyNodeId: { cmaSetId, taxonomyNodeId },
    },
    update: { expReturnPct, volPct, incomeYieldPct },
    create: { cmaSetId, taxonomyNodeId, expReturnPct, volPct, incomeYieldPct },
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

// ── Update risk-free rate ──

export async function updateRiskFreeRateAction(cmaSetId: string, riskFreeRatePct: number) {
  await requireRole("ADMIN");
  await prisma.cMASet.update({
    where: { id: cmaSetId },
    data: { riskFreeRatePct: riskFreeRatePct / 100 },
  });
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

  const current = await prisma.cMASet.findUnique({ where: { id: cmaSetId } });
  if (!current) return;

  const updates: Record<string, unknown> = { status };

  if (status === "RETIRED" && current.isDefault) {
    updates.isDefault = false;
  }
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
  await prisma.clientCMASelection.deleteMany({ where: { cmaSetId } });
  await prisma.cMASet.delete({ where: { id: cmaSetId } });
  redirect("/admin/cma");
}

// ── Save correlations ──

const corrEntrySchema = z.object({
  nodeIdA: z.string().min(1),
  nodeIdB: z.string().min(1),
  corr: z.number().min(-1).max(1),
});

export async function saveCorrelationsAction(
  cmaSetId: string,
  entries: { nodeIdA: string; nodeIdB: string; corr: number }[],
): Promise<{ error?: string; success?: boolean }> {
  await requireRole("ADMIN");

  const parsed = z.array(corrEntrySchema).safeParse(entries);
  if (!parsed.success) {
    return { error: "Invalid correlation entries" };
  }

  // Delete existing correlations for this set, then re-create
  await prisma.cMACorrelation.deleteMany({ where: { cmaSetId } });

  if (parsed.data.length > 0) {
    await prisma.cMACorrelation.createMany({
      data: parsed.data.map((e) => ({
        cmaSetId,
        nodeIdA: e.nodeIdA,
        nodeIdB: e.nodeIdB,
        corr: e.corr,
      })),
    });
  }

  revalidatePath(`/admin/cma/${cmaSetId}`);
  return { success: true };
}

// ── Block ACTIVE if not PSD ──

export async function updateCMASetStatusWithValidationAction(
  cmaSetId: string,
  status: string,
): Promise<{ error?: string }> {
  await requireRole("ADMIN");

  if (!validStatuses.includes(status as typeof validStatuses[number])) {
    return { error: "Invalid status" };
  }

  if (status === "ACTIVE") {
    // Check if correlations exist and are PSD
    const correlations = await prisma.cMACorrelation.findMany({ where: { cmaSetId } });
    if (correlations.length > 0) {
      const assumptions = await prisma.cMAAssumption.findMany({ where: { cmaSetId } });
      const nodeIds = assumptions.map((a) => a.taxonomyNodeId);
      const { buildCorrelationMatrix, validateCorrelationMatrix } = await import("@/lib/cma");
      const matrix = buildCorrelationMatrix(
        nodeIds,
        correlations.map((c) => ({ nodeIdA: c.nodeIdA, nodeIdB: c.nodeIdB, corr: c.corr })),
      );
      const validation = validateCorrelationMatrix(matrix);
      if (!validation.isPSD) {
        return { error: "Cannot set ACTIVE: correlation matrix is not positive semi-definite. Repair or fix correlations first." };
      }
    }
  }

  // Delegate to existing logic
  await updateCMASetStatusAction(cmaSetId, status);
  return {};
}
