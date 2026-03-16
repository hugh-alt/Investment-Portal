"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeDistributionAllocations } from "@/lib/pm-fund-truth";

// ── Create Fund (SUPER_ADMIN only, on platform) ─────────

const createFundSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  vintageYear: z.string().optional(),
  strategy: z.string().optional(),
  currency: z.string().optional(),
});

export type CreateFundState = { error?: string; success?: boolean };

export async function createPlatformFundAction(
  _prev: CreateFundState | null,
  formData: FormData,
): Promise<CreateFundState> {
  await requireSuperAdmin();

  const parsed = createFundSchema.safeParse({
    name: formData.get("name"),
    vintageYear: formData.get("vintageYear"),
    strategy: formData.get("strategy"),
    currency: formData.get("currency"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const vintageYear = parsed.data.vintageYear ? parseInt(parsed.data.vintageYear, 10) : null;

  await prisma.pMFund.create({
    data: {
      name: parsed.data.name,
      vintageYear: vintageYear && !isNaN(vintageYear) ? vintageYear : null,
      strategy: parsed.data.strategy || null,
      currency: parsed.data.currency || "AUD",
    },
  });

  revalidatePath("/platform/pm-funds");
  revalidatePath("/admin/pm-funds");
  return { success: true };
}

// ── Update Fund Truth (SUPER_ADMIN only) ─────────────────

const updateTruthSchema = z.object({
  fundId: z.string().min(1),
  lifecycleStage: z.enum(["FUNDRAISING", "INVESTING", "HARVESTING", "LIQUIDATING"]).nullable(),
  firstCloseDate: z.string().nullable(),
  investmentPeriodMonths: z.coerce.number().int().positive().nullable(),
  fundTermMonths: z.coerce.number().int().positive().nullable(),
  extensionMonths: z.coerce.number().int().nonnegative().nullable(),
});

export type UpdateTruthState = { error?: string; success?: boolean };

export async function updateFundTruthAction(
  _prev: UpdateTruthState | null,
  formData: FormData,
): Promise<UpdateTruthState> {
  await requireSuperAdmin();

  const parsed = updateTruthSchema.safeParse({
    fundId: formData.get("fundId"),
    lifecycleStage: formData.get("lifecycleStage") || null,
    firstCloseDate: formData.get("firstCloseDate") || null,
    investmentPeriodMonths: formData.get("investmentPeriodMonths") || null,
    fundTermMonths: formData.get("fundTermMonths") || null,
    extensionMonths: formData.get("extensionMonths") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { fundId, lifecycleStage, firstCloseDate, investmentPeriodMonths, fundTermMonths, extensionMonths } = parsed.data;

  await prisma.pMFundTruth.upsert({
    where: { fundId },
    update: {
      lifecycleStage: lifecycleStage as "FUNDRAISING" | "INVESTING" | "HARVESTING" | "LIQUIDATING" | null,
      firstCloseDate: firstCloseDate ? new Date(firstCloseDate) : null,
      investmentPeriodMonths,
      fundTermMonths,
      extensionMonths,
    },
    create: {
      fundId,
      lifecycleStage: lifecycleStage as "FUNDRAISING" | "INVESTING" | "HARVESTING" | "LIQUIDATING" | null,
      firstCloseDate: firstCloseDate ? new Date(firstCloseDate) : null,
      investmentPeriodMonths,
      fundTermMonths,
      extensionMonths,
    },
  });

  revalidatePath(`/platform/pm-funds/${fundId}`);
  revalidatePath("/platform/pm-funds");
  return { success: true };
}

// ── Add Fund Close (SUPER_ADMIN only) ────────────────────

const addCloseSchema = z.object({
  fundId: z.string().min(1),
  closeType: z.enum(["FIRST", "SECOND", "FINAL", "OTHER"]),
  closeDate: z.string().min(1, "Close date is required"),
  capitalRaised: z.coerce.number().nonnegative().nullable(),
  notes: z.string().nullable(),
});

export type AddCloseState = { error?: string; success?: boolean };

export async function addFundCloseAction(
  _prev: AddCloseState | null,
  formData: FormData,
): Promise<AddCloseState> {
  await requireSuperAdmin();

  const parsed = addCloseSchema.safeParse({
    fundId: formData.get("fundId"),
    closeType: formData.get("closeType"),
    closeDate: formData.get("closeDate"),
    capitalRaised: formData.get("capitalRaised") || null,
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.pMFundClose.create({
    data: {
      fundId: parsed.data.fundId,
      closeType: parsed.data.closeType,
      closeDate: new Date(parsed.data.closeDate),
      capitalRaised: parsed.data.capitalRaised,
      notes: parsed.data.notes,
    },
  });

  revalidatePath(`/platform/pm-funds/${parsed.data.fundId}`);
  return { success: true };
}

export async function deleteFundCloseAction(closeId: string): Promise<{ error?: string }> {
  await requireSuperAdmin();
  const close = await prisma.pMFundClose.findUnique({ where: { id: closeId } });
  if (!close) return { error: "Close not found" };
  await prisma.pMFundClose.delete({ where: { id: closeId } });
  revalidatePath(`/platform/pm-funds/${close.fundId}`);
  return {};
}

// ── Add Fund NAV Point (SUPER_ADMIN only) ────────────────

const addNavSchema = z.object({
  fundId: z.string().min(1),
  navDate: z.string().min(1, "NAV date is required"),
  navAmount: z.coerce.number().positive("NAV must be positive"),
  currency: z.string().default("AUD"),
});

export type AddNavState = { error?: string; success?: boolean };

export async function addFundNAVPointAction(
  _prev: AddNavState | null,
  formData: FormData,
): Promise<AddNavState> {
  await requireSuperAdmin();

  const parsed = addNavSchema.safeParse({
    fundId: formData.get("fundId"),
    navDate: formData.get("navDate"),
    navAmount: formData.get("navAmount"),
    currency: formData.get("currency") || "AUD",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.pMFundNAVPoint.create({
    data: {
      fundId: parsed.data.fundId,
      navDate: new Date(parsed.data.navDate),
      navAmount: parsed.data.navAmount,
      currency: parsed.data.currency,
    },
  });

  revalidatePath(`/platform/pm-funds/${parsed.data.fundId}`);
  return { success: true };
}

export async function deleteFundNAVPointAction(navPointId: string): Promise<{ error?: string }> {
  await requireSuperAdmin();
  const nav = await prisma.pMFundNAVPoint.findUnique({ where: { id: navPointId } });
  if (!nav) return { error: "NAV point not found" };
  await prisma.pMFundNAVPoint.delete({ where: { id: navPointId } });
  revalidatePath(`/platform/pm-funds/${nav.fundId}`);
  return {};
}

// ── Add Fund Call Event — % based (SUPER_ADMIN only) ─────

const addCallSchema = z.object({
  fundId: z.string().min(1),
  eventDate: z.string().min(1, "Event date is required"),
  callPct: z.coerce.number().positive("Call % must be positive").max(1, "Call % must be <= 100%"),
  currency: z.string().default("AUD"),
  notes: z.string().nullable(),
});

export type AddCallState = { error?: string; success?: boolean };

export async function addFundCallEventAction(
  _prev: AddCallState | null,
  formData: FormData,
): Promise<AddCallState> {
  await requireSuperAdmin();

  const rawPct = formData.get("callPct");
  // UI sends percentage (e.g. 2.50), convert to decimal
  const pctDecimal = rawPct ? parseFloat(rawPct as string) / 100 : 0;

  const parsed = addCallSchema.safeParse({
    fundId: formData.get("fundId"),
    eventDate: formData.get("eventDate"),
    callPct: pctDecimal,
    currency: formData.get("currency") || "AUD",
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.pMFundCashflowEvent.create({
    data: {
      fundId: parsed.data.fundId,
      type: "CALL",
      eventDate: new Date(parsed.data.eventDate),
      callPct: parsed.data.callPct,
      amount: null,
      currency: parsed.data.currency,
      notes: parsed.data.notes,
    },
  });

  revalidatePath(`/platform/pm-funds/${parsed.data.fundId}`);
  return { success: true };
}

export async function deleteFundCashflowEventAction(eventId: string): Promise<{ error?: string }> {
  await requireSuperAdmin();
  const evt = await prisma.pMFundCashflowEvent.findUnique({ where: { id: eventId } });
  if (!evt) return { error: "Event not found" };
  await prisma.pMFundCashflowEvent.delete({ where: { id: eventId } });
  revalidatePath(`/platform/pm-funds/${evt.fundId}`);
  return {};
}

// ── Distribution Events (SUPER_ADMIN only) ───────────────

const addDistributionSchema = z.object({
  fundId: z.string().min(1),
  eventDate: z.string().min(1, "Event date is required"),
  totalAmount: z.coerce.number().positive("Amount must be positive"),
  currency: z.string().default("AUD"),
  basis: z.enum(["PRO_RATA_COMMITMENT", "PRO_RATA_PAIDIN"]),
  notes: z.string().nullable(),
});

export type AddDistributionState = { error?: string; success?: boolean };

export async function addDistributionEventAction(
  _prev: AddDistributionState | null,
  formData: FormData,
): Promise<AddDistributionState> {
  await requireSuperAdmin();

  const parsed = addDistributionSchema.safeParse({
    fundId: formData.get("fundId"),
    eventDate: formData.get("eventDate"),
    totalAmount: formData.get("totalAmount"),
    currency: formData.get("currency") || "AUD",
    basis: formData.get("basis") || "PRO_RATA_COMMITMENT",
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { fundId, eventDate, totalAmount, currency, basis, notes } = parsed.data;

  // Fetch all commitments for this fund
  const commitments = await prisma.clientCommitment.findMany({
    where: { fundId },
  });

  // Compute allocations
  const allocations = computeDistributionAllocations(
    totalAmount,
    commitments.map((c) => ({
      id: c.id,
      commitmentAmount: c.commitmentAmount,
      fundedAmount: c.fundedAmount,
    })),
    basis,
  );

  // Create event with allocations
  await prisma.pMFundDistributionEvent.create({
    data: {
      fundId,
      eventDate: new Date(eventDate),
      totalAmount,
      currency,
      basis,
      notes,
      allocations: {
        create: allocations.map((a) => ({
          clientCommitmentId: a.commitmentId,
          amount: a.amount,
          pctOfCommitment: a.pctOfCommitment,
        })),
      },
    },
  });

  revalidatePath(`/platform/pm-funds/${fundId}`);
  return { success: true };
}

export async function deleteDistributionEventAction(eventId: string): Promise<{ error?: string }> {
  await requireSuperAdmin();
  const evt = await prisma.pMFundDistributionEvent.findUnique({ where: { id: eventId } });
  if (!evt) return { error: "Distribution event not found" };
  // Cascade deletes allocations
  await prisma.pMFundDistributionEvent.delete({ where: { id: eventId } });
  revalidatePath(`/platform/pm-funds/${evt.fundId}`);
  return {};
}

export async function recalculateAllocationsAction(eventId: string): Promise<{ error?: string }> {
  await requireSuperAdmin();

  const evt = await prisma.pMFundDistributionEvent.findUnique({
    where: { id: eventId },
  });
  if (!evt) return { error: "Distribution event not found" };

  const commitments = await prisma.clientCommitment.findMany({
    where: { fundId: evt.fundId },
  });

  const allocations = computeDistributionAllocations(
    evt.totalAmount,
    commitments.map((c) => ({
      id: c.id,
      commitmentAmount: c.commitmentAmount,
      fundedAmount: c.fundedAmount,
    })),
    evt.basis,
  );

  // Delete existing and recreate
  await prisma.pMFundDistributionAllocation.deleteMany({
    where: { distributionEventId: eventId },
  });

  await prisma.pMFundDistributionAllocation.createMany({
    data: allocations.map((a) => ({
      distributionEventId: eventId,
      clientCommitmentId: a.commitmentId,
      amount: a.amount,
      pctOfCommitment: a.pctOfCommitment,
    })),
  });

  revalidatePath(`/platform/pm-funds/${evt.fundId}`);
  return {};
}

// ── KPI Points (SUPER_ADMIN only) ────────────────────────

const addKpiSchema = z.object({
  fundId: z.string().min(1),
  kpiDate: z.string().min(1, "KPI date is required"),
  tvpi: z.coerce.number().nonnegative(),
  rvpi: z.coerce.number().nonnegative(),
  dpi: z.coerce.number().nonnegative(),
  moic: z.coerce.number().nonnegative(),
});

export type AddKpiState = { error?: string; success?: boolean };

export async function addFundKpiPointAction(
  _prev: AddKpiState | null,
  formData: FormData,
): Promise<AddKpiState> {
  await requireSuperAdmin();

  const parsed = addKpiSchema.safeParse({
    fundId: formData.get("fundId"),
    kpiDate: formData.get("kpiDate"),
    tvpi: formData.get("tvpi"),
    rvpi: formData.get("rvpi"),
    dpi: formData.get("dpi"),
    moic: formData.get("moic"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.pMFundKpiPoint.create({
    data: {
      fundId: parsed.data.fundId,
      kpiDate: new Date(parsed.data.kpiDate),
      tvpi: parsed.data.tvpi,
      rvpi: parsed.data.rvpi,
      dpi: parsed.data.dpi,
      moic: parsed.data.moic,
    },
  });

  revalidatePath(`/platform/pm-funds/${parsed.data.fundId}`);
  return { success: true };
}

export async function deleteFundKpiPointAction(kpiId: string): Promise<{ error?: string }> {
  await requireSuperAdmin();
  const kpi = await prisma.pMFundKpiPoint.findUnique({ where: { id: kpiId } });
  if (!kpi) return { error: "KPI point not found" };
  await prisma.pMFundKpiPoint.delete({ where: { id: kpiId } });
  revalidatePath(`/platform/pm-funds/${kpi.fundId}`);
  return {};
}
