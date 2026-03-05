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

// ── Update Buffer Config ────────────────────────────────

const updateBufferSchema = z.object({
  clientId: z.string().min(1),
  sleeveId: z.string().min(1),
  bufferMethod: z.enum(["VS_UNFUNDED_PCT", "VS_PROJECTED_CALLS"]),
  bufferPctOfUnfunded: z.string().min(1),
  bufferMonthsForward: z.string().min(1),
  alertEnabled: z.string().optional(),
});

export async function updateBufferConfigAction(
  _prev: SleeveFormState,
  formData: FormData,
): Promise<SleeveFormState> {
  await requireUser();

  const parsed = updateBufferSchema.safeParse({
    clientId: formData.get("clientId"),
    sleeveId: formData.get("sleeveId"),
    bufferMethod: formData.get("bufferMethod"),
    bufferPctOfUnfunded: formData.get("bufferPctOfUnfunded"),
    bufferMonthsForward: formData.get("bufferMonthsForward"),
    alertEnabled: formData.get("alertEnabled"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const pctOfUnfunded = parseFloat(parsed.data.bufferPctOfUnfunded) / 100;
  if (isNaN(pctOfUnfunded) || pctOfUnfunded < 0 || pctOfUnfunded > 1) {
    return { error: "Buffer % must be between 0 and 100" };
  }

  const monthsForward = parseInt(parsed.data.bufferMonthsForward, 10);
  if (isNaN(monthsForward) || monthsForward < 1 || monthsForward > 36) {
    return { error: "Months forward must be between 1 and 36" };
  }

  await prisma.clientSleeve.update({
    where: { id: parsed.data.sleeveId },
    data: {
      bufferMethod: parsed.data.bufferMethod,
      bufferPctOfUnfunded: pctOfUnfunded,
      bufferMonthsForward: monthsForward,
      alertEnabled: parsed.data.alertEnabled === "on",
    },
  });

  revalidatePath(`/clients/${parsed.data.clientId}`);
  return { success: true };
}

// ── Update Waterfall Config ─────────────────────────────

const updateWaterfallSchema = z.object({
  clientId: z.string().min(1),
  sleeveId: z.string().min(1),
  sellWaterfallJson: z.string(),
  buyWaterfallJson: z.string(),
  minTradeAmount: z.string().min(1),
});

export async function updateWaterfallConfigAction(
  _prev: SleeveFormState,
  formData: FormData,
): Promise<SleeveFormState> {
  await requireUser();

  const parsed = updateWaterfallSchema.safeParse({
    clientId: formData.get("clientId"),
    sleeveId: formData.get("sleeveId"),
    sellWaterfallJson: formData.get("sellWaterfallJson"),
    buyWaterfallJson: formData.get("buyWaterfallJson"),
    minTradeAmount: formData.get("minTradeAmount"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Validate JSON arrays
  try {
    const sell = JSON.parse(parsed.data.sellWaterfallJson);
    const buy = JSON.parse(parsed.data.buyWaterfallJson);
    if (!Array.isArray(sell) || !Array.isArray(buy)) {
      return { error: "Waterfall configs must be arrays" };
    }
  } catch {
    return { error: "Invalid waterfall JSON" };
  }

  const minTrade = parseFloat(parsed.data.minTradeAmount);
  if (isNaN(minTrade) || minTrade < 0) {
    return { error: "Min trade amount must be >= 0" };
  }

  await prisma.clientSleeve.update({
    where: { id: parsed.data.sleeveId },
    data: {
      sellWaterfallJson: parsed.data.sellWaterfallJson,
      buyWaterfallJson: parsed.data.buyWaterfallJson,
      minTradeAmount: minTrade,
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
