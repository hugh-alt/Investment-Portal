"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateMonotonicCumPct, type CurvePoint } from "@/lib/pm-curves";

// ── Create PM Fund ──────────────────────────────────────

const createFundSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  vintageYear: z.string().optional(),
  strategy: z.string().optional(),
  currency: z.string().optional(),
});

export type CreateFundState = { error?: string; success?: boolean };

export async function createFundAction(
  _prev: CreateFundState,
  formData: FormData,
): Promise<CreateFundState> {
  const user = await requireUser();
  if (!isAdmin(user)) return { error: "Admin access required" };

  const parsed = createFundSchema.safeParse({
    name: formData.get("name"),
    vintageYear: formData.get("vintageYear"),
    strategy: formData.get("strategy"),
    currency: formData.get("currency"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const vintageYear = parsed.data.vintageYear ? parseInt(parsed.data.vintageYear, 10) : null;

  const fund = await prisma.pMFund.create({
    data: {
      name: parsed.data.name,
      vintageYear: vintageYear && !isNaN(vintageYear) ? vintageYear : null,
      strategy: parsed.data.strategy || null,
      currency: parsed.data.currency || "AUD",
    },
  });

  // Create default approval (not approved)
  await prisma.pMFundApproval.create({
    data: { fundId: fund.id, isApproved: false },
  });

  revalidatePath("/admin/pm-funds");
  return { success: true };
}

// ── Toggle Approval ─────────────────────────────────────

const toggleSchema = z.object({
  fundId: z.string().min(1),
  isApproved: z.string(),
});

export type ToggleApprovalState = { error?: string };

export async function toggleApprovalAction(
  _prev: ToggleApprovalState,
  formData: FormData,
): Promise<ToggleApprovalState> {
  const user = await requireUser();
  if (!isAdmin(user)) return { error: "Admin access required" };

  const parsed = toggleSchema.safeParse({
    fundId: formData.get("fundId"),
    isApproved: formData.get("isApproved"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const isApproved = parsed.data.isApproved === "true";

  await prisma.pMFundApproval.upsert({
    where: { fundId: parsed.data.fundId },
    update: { isApproved },
    create: { fundId: parsed.data.fundId, isApproved },
  });

  revalidatePath("/admin/pm-funds");
  return {};
}

// ── Save Profile (% curves) ────────────────────────────

const profileSchema = z.object({
  fundId: z.string().min(1),
  projectedCallPctCurveJson: z.string(),
  projectedDistPctCurveJson: z.string(),
});

export type SaveProfileState = { error?: string; success?: boolean };

export async function saveProfileAction(
  _prev: SaveProfileState,
  formData: FormData,
): Promise<SaveProfileState> {
  const user = await requireUser();
  if (!isAdmin(user)) return { error: "Admin access required" };

  const parsed = profileSchema.safeParse({
    fundId: formData.get("fundId"),
    projectedCallPctCurveJson: formData.get("projectedCallPctCurveJson"),
    projectedDistPctCurveJson: formData.get("projectedDistPctCurveJson"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let callCurve: CurvePoint[];
  let distCurve: CurvePoint[];
  try {
    callCurve = JSON.parse(parsed.data.projectedCallPctCurveJson);
    distCurve = JSON.parse(parsed.data.projectedDistPctCurveJson);
  } catch {
    return { error: "Invalid JSON format" };
  }

  const callValidation = validateMonotonicCumPct(callCurve);
  if (!callValidation.valid) return { error: `Call curve: ${callValidation.error}` };

  const distValidation = validateMonotonicCumPct(distCurve);
  if (!distValidation.valid) return { error: `Dist curve: ${distValidation.error}` };

  await prisma.pMFundProfile.upsert({
    where: { fundId: parsed.data.fundId },
    update: {
      projectedCallPctCurveJson: parsed.data.projectedCallPctCurveJson,
      projectedDistPctCurveJson: parsed.data.projectedDistPctCurveJson,
    },
    create: {
      fundId: parsed.data.fundId,
      projectedCallPctCurveJson: parsed.data.projectedCallPctCurveJson,
      projectedDistPctCurveJson: parsed.data.projectedDistPctCurveJson,
    },
  });

  revalidatePath("/admin/pm-funds");
  revalidatePath(`/admin/pm-funds/${parsed.data.fundId}`);
  return { success: true };
}
