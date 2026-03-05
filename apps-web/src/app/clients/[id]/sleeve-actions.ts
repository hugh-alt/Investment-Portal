"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── Create Sleeve ───────────────────────────────────────

const createSleeveSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1, "Name is required").max(100),
  targetPct: z.string().optional(),
  cashBufferPct: z.string().optional(),
});

export type SleeveFormState = { error?: string; success?: boolean };

export async function createSleeveAction(
  _prev: SleeveFormState,
  formData: FormData,
): Promise<SleeveFormState> {
  await requireUser();

  const parsed = createSleeveSchema.safeParse({
    clientId: formData.get("clientId"),
    name: formData.get("name"),
    targetPct: formData.get("targetPct"),
    cashBufferPct: formData.get("cashBufferPct"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const targetPct = parsed.data.targetPct ? parseFloat(parsed.data.targetPct) / 100 : null;
  const cashBufferPct = parsed.data.cashBufferPct
    ? parseFloat(parsed.data.cashBufferPct) / 100
    : 0.05;

  if (targetPct !== null && (targetPct < 0 || targetPct > 1)) {
    return { error: "Target % must be between 0 and 100" };
  }
  if (cashBufferPct < 0 || cashBufferPct > 1) {
    return { error: "Cash buffer % must be between 0 and 100" };
  }

  await prisma.clientSleeve.create({
    data: {
      clientId: parsed.data.clientId,
      name: parsed.data.name,
      targetPct,
      cashBufferPct,
    },
  });

  revalidatePath(`/clients/${parsed.data.clientId}`);
  return { success: true };
}

// ── Add Commitment ──────────────────────────────────────

const addCommitmentSchema = z.object({
  clientId: z.string().min(1),
  sleeveId: z.string().min(1),
  fundId: z.string().min(1, "Select a fund"),
  commitmentAmount: z.string().min(1, "Commitment amount required"),
  fundedAmount: z.string().optional(),
  navAmount: z.string().optional(),
  distributionsAmount: z.string().optional(),
});

export async function addCommitmentAction(
  _prev: SleeveFormState,
  formData: FormData,
): Promise<SleeveFormState> {
  await requireUser();

  const parsed = addCommitmentSchema.safeParse({
    clientId: formData.get("clientId"),
    sleeveId: formData.get("sleeveId"),
    fundId: formData.get("fundId"),
    commitmentAmount: formData.get("commitmentAmount"),
    fundedAmount: formData.get("fundedAmount"),
    navAmount: formData.get("navAmount"),
    distributionsAmount: formData.get("distributionsAmount"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const commitment = parseFloat(parsed.data.commitmentAmount);
  if (isNaN(commitment) || commitment <= 0) return { error: "Invalid commitment amount" };

  // Verify fund is approved
  const approval = await prisma.pMFundApproval.findUnique({
    where: { fundId: parsed.data.fundId },
  });
  if (!approval?.isApproved) return { error: "Fund is not approved" };

  await prisma.clientCommitment.create({
    data: {
      clientSleeveId: parsed.data.sleeveId,
      fundId: parsed.data.fundId,
      commitmentAmount: commitment,
      fundedAmount: parseFloat(parsed.data.fundedAmount ?? "0") || 0,
      navAmount: parseFloat(parsed.data.navAmount ?? "0") || 0,
      distributionsAmount: parseFloat(parsed.data.distributionsAmount ?? "0") || 0,
    },
  });

  revalidatePath(`/clients/${parsed.data.clientId}`);
  return { success: true };
}

// ── Add Liquid Position ─────────────────────────────────

const addLiquidSchema = z.object({
  clientId: z.string().min(1),
  sleeveId: z.string().min(1),
  productId: z.string().min(1, "Select a product"),
  marketValue: z.string().min(1, "Market value required"),
});

export async function addLiquidPositionAction(
  _prev: SleeveFormState,
  formData: FormData,
): Promise<SleeveFormState> {
  await requireUser();

  const parsed = addLiquidSchema.safeParse({
    clientId: formData.get("clientId"),
    sleeveId: formData.get("sleeveId"),
    productId: formData.get("productId"),
    marketValue: formData.get("marketValue"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const marketValue = parseFloat(parsed.data.marketValue);
  if (isNaN(marketValue) || marketValue <= 0) return { error: "Invalid market value" };

  await prisma.sleeveLiquidPosition.create({
    data: {
      clientSleeveId: parsed.data.sleeveId,
      productId: parsed.data.productId,
      marketValue,
    },
  });

  revalidatePath(`/clients/${parsed.data.clientId}`);
  return { success: true };
}
