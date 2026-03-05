"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateTransition, type ApprovalAction, type ActorRole } from "@/lib/approval";
import { canCreateOrders, canSubmitOrders, canFillOrders, type ExecutionStatus } from "@/lib/execution";

// ── Create Sleeve ───────────────────────────────────────

const createSleeveSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1, "Name is required").max(100),
  targetPct: z.string().nullable().optional(),
  cashBufferPct: z.string().nullable().optional(),
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
  alertEnabled: z.string().nullable().optional(),
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
  fundedAmount: z.string().nullable().optional(),
  navAmount: z.string().nullable().optional(),
  distributionsAmount: z.string().nullable().optional(),
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

// ── Approve / Reject Recommendation ────────────────────

const approvalSchema = z.object({
  clientId: z.string().min(1),
  recommendationId: z.string().min(1),
  action: z.enum(["APPROVE", "REJECT"]),
  note: z.string().nullable().optional(),
});

export async function approveRecommendationAction(
  _prev: SleeveFormState,
  formData: FormData,
): Promise<SleeveFormState> {
  const user = await requireUser();

  const parsed = approvalSchema.safeParse({
    clientId: formData.get("clientId"),
    recommendationId: formData.get("recommendationId"),
    action: formData.get("action"),
    note: formData.get("note"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const rec = await prisma.sleeveRecommendation.findUnique({
    where: { id: parsed.data.recommendationId },
  });
  if (!rec) return { error: "Recommendation not found" };

  const actorRole = user.role as ActorRole;
  const approvalAction = parsed.data.action as ApprovalAction;

  const result = validateTransition(
    rec.status as "DRAFT" | "ADVISER_APPROVED" | "CLIENT_APPROVED" | "REJECTED",
    approvalAction,
    actorRole,
  );
  if (!result.ok) return { error: result.error };

  const now = new Date();
  const updateData: Record<string, unknown> = { status: result.newStatus };

  if (result.newStatus === "ADVISER_APPROVED") {
    updateData.adviserApprovedAt = now;
  } else if (result.newStatus === "CLIENT_APPROVED") {
    updateData.clientApprovedAt = now;
  } else if (result.newStatus === "REJECTED") {
    updateData.rejectedAt = now;
    updateData.rejectionReason = parsed.data.note || null;
  }

  await prisma.$transaction([
    prisma.sleeveRecommendation.update({
      where: { id: rec.id },
      data: updateData,
    }),
    prisma.approvalEvent.create({
      data: {
        recommendationId: rec.id,
        action: approvalAction,
        actorUserId: user.id,
        actorRole: user.role,
        note: parsed.data.note || null,
      },
    }),
  ]);

  revalidatePath(`/clients/${parsed.data.clientId}`);
  return { success: true };
}

// ── Create Orders from Recommendation ──────────────────

const createOrdersSchema = z.object({
  clientId: z.string().min(1),
  recommendationId: z.string().min(1),
});

export async function createOrdersAction(
  _prev: SleeveFormState,
  formData: FormData,
): Promise<SleeveFormState> {
  await requireUser();

  const parsed = createOrdersSchema.safeParse({
    clientId: formData.get("clientId"),
    recommendationId: formData.get("recommendationId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const rec = await prisma.sleeveRecommendation.findUnique({
    where: { id: parsed.data.recommendationId },
    include: { legs: true },
  });
  if (!rec) return { error: "Recommendation not found" };

  const existingOrders = await prisma.order.count({
    where: { sourceId: rec.id },
  });

  const check = canCreateOrders(rec.status, existingOrders);
  if (!check.ok) return { error: check.error };

  await prisma.order.createMany({
    data: rec.legs.map((leg) => ({
      clientId: parsed.data.clientId,
      source: "SLEEVE_RECOMMENDATION" as const,
      sourceId: rec.id,
      productId: leg.productId,
      side: leg.action as "BUY" | "SELL",
      amount: leg.amount,
      status: "CREATED" as const,
    })),
  });

  // Create initial OrderEvents
  const orders = await prisma.order.findMany({
    where: { sourceId: rec.id },
    select: { id: true },
  });
  await prisma.orderEvent.createMany({
    data: orders.map((o) => ({
      orderId: o.id,
      status: "CREATED" as const,
      note: "Order created from recommendation",
    })),
  });

  revalidatePath(`/clients/${parsed.data.clientId}`);
  return { success: true };
}

// ── Simulate Submit Orders ─────────────────────────────

const simulateSchema = z.object({
  clientId: z.string().min(1),
  recommendationId: z.string().min(1),
});

export async function simulateSubmitAction(
  _prev: SleeveFormState,
  formData: FormData,
): Promise<SleeveFormState> {
  await requireUser();

  const parsed = simulateSchema.safeParse({
    clientId: formData.get("clientId"),
    recommendationId: formData.get("recommendationId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const orders = await prisma.order.findMany({
    where: { sourceId: parsed.data.recommendationId },
  });

  const statuses = orders.map((o) => o.status as ExecutionStatus);
  const check = canSubmitOrders(statuses);
  if (!check.ok) return { error: check.error };

  const createdOrders = orders.filter((o) => o.status === "CREATED");

  await prisma.$transaction(
    createdOrders.flatMap((o) => [
      prisma.order.update({
        where: { id: o.id },
        data: { status: "SUBMITTED" },
      }),
      prisma.orderEvent.create({
        data: {
          orderId: o.id,
          status: "SUBMITTED",
          note: "Simulated submission to platform",
        },
      }),
    ]),
  );

  revalidatePath(`/clients/${parsed.data.clientId}`);
  return { success: true };
}

// ── Simulate Fill Orders ───────────────────────────────

export async function simulateFillsAction(
  _prev: SleeveFormState,
  formData: FormData,
): Promise<SleeveFormState> {
  await requireUser();

  const parsed = simulateSchema.safeParse({
    clientId: formData.get("clientId"),
    recommendationId: formData.get("recommendationId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const orders = await prisma.order.findMany({
    where: { sourceId: parsed.data.recommendationId },
  });

  const fillable = orders.filter(
    (o) => o.status === "SUBMITTED" || o.status === "PARTIALLY_FILLED",
  );

  const statuses = orders.map((o) => o.status as ExecutionStatus);
  const check = canFillOrders(statuses);
  if (!check.ok) return { error: check.error };

  // Randomly pick one order to be PARTIALLY_FILLED, rest FILLED
  const partialIdx = fillable.length > 1 ? Math.floor(Math.random() * fillable.length) : -1;
  // Also randomly reject one order (1 in 4 chance) for demo
  const rejectIdx = fillable.length > 2 && Math.random() < 0.25
    ? (partialIdx + 1) % fillable.length
    : -1;

  type ExecStatus = "FILLED" | "PARTIALLY_FILLED" | "REJECTED";
  const ops = fillable.flatMap((o, i) => {
    let newStatus: ExecStatus;
    let note: string;

    if (i === rejectIdx) {
      newStatus = "REJECTED";
      note = "Simulated rejection: insufficient market liquidity";
    } else if (i === partialIdx && o.status === "SUBMITTED") {
      newStatus = "PARTIALLY_FILLED";
      note = `Simulated partial fill: ${Math.floor(50 + Math.random() * 40)}% filled`;
    } else {
      newStatus = "FILLED";
      note = "Simulated full fill";
    }

    return [
      prisma.order.update({
        where: { id: o.id },
        data: { status: newStatus },
      }),
      prisma.orderEvent.create({
        data: {
          orderId: o.id,
          status: newStatus,
          note,
        },
      }),
    ];
  });

  await prisma.$transaction(ops);

  revalidatePath(`/clients/${parsed.data.clientId}`);
  return { success: true };
}
