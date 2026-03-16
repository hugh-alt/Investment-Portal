"use server";

import { revalidatePath } from "next/cache";
import { requireUser, wealthGroupFilter } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { LiquidEntry, CommitmentEntry, WaterfallEntry, TargetMode, BufferBasis } from "./wizard-config";

export type WizardResult = { error?: string; success?: boolean; sleeveId?: string };

// ── Step 1: Create sleeve draft ──────────────────────────

export async function createSleeveDraftAction(
  clientId: string,
  name: string,
  targetPct: number | null,
  cashBufferPct: number,
  configJson: string,
): Promise<WizardResult> {
  await requireUser();

  if (!clientId) return { error: "Select a client" };
  if (!name.trim()) return { error: "Name is required" };
  if (targetPct !== null && (targetPct < 0 || targetPct > 1)) return { error: "Target % must be 0-100" };
  if (cashBufferPct < 0 || cashBufferPct > 1) return { error: "Cash buffer % must be 0-100" };

  // Check client doesn't already have a sleeve
  const existing = await prisma.clientSleeve.findUnique({ where: { clientId } });
  if (existing) return { error: "This client already has a sleeve. Edit it from the client page." };

  const sleeve = await prisma.clientSleeve.create({
    data: { clientId, name, targetPct, cashBufferPct, configJson },
  });

  return { success: true, sleeveId: sleeve.id };
}

// ── Step 2: Add liquid positions ─────────────────────────

export async function addLiquidPositionsAction(
  sleeveId: string,
  clientId: string,
  positions: LiquidEntry[],
): Promise<WizardResult> {
  await requireUser();

  if (!sleeveId) return { error: "Sleeve not created yet" };

  // Clear existing and re-add (idempotent)
  await prisma.sleeveLiquidPosition.deleteMany({ where: { clientSleeveId: sleeveId } });

  for (const p of positions) {
    if (p.marketValue <= 0) continue;
    await prisma.sleeveLiquidPosition.create({
      data: { clientSleeveId: sleeveId, productId: p.productId, marketValue: p.marketValue },
    });
  }

  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}

// ── Step 3: Add commitments ──────────────────────────────

export async function addCommitmentsAction(
  sleeveId: string,
  clientId: string,
  commitments: CommitmentEntry[],
): Promise<WizardResult> {
  await requireUser();

  if (!sleeveId) return { error: "Sleeve not created yet" };

  // Clear existing and re-add (idempotent)
  await prisma.clientCommitment.deleteMany({ where: { clientSleeveId: sleeveId } });

  for (const c of commitments) {
    if (c.commitmentAmount <= 0) continue;
    await prisma.clientCommitment.create({
      data: {
        clientSleeveId: sleeveId,
        fundId: c.fundId,
        commitmentAmount: c.commitmentAmount,
      },
    });
  }

  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}

// ── Step 4: Update buffer config ─────────────────────────

export async function updateBufferAction(
  sleeveId: string,
  clientId: string,
  bufferMethod: "VS_UNFUNDED_PCT" | "VS_PROJECTED_CALLS",
  bufferPctOfUnfunded: number,
  bufferMonthsForward: number,
): Promise<WizardResult> {
  await requireUser();

  if (!sleeveId) return { error: "Sleeve not created yet" };

  await prisma.clientSleeve.update({
    where: { id: sleeveId },
    data: { bufferMethod, bufferPctOfUnfunded, bufferMonthsForward },
  });

  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}

// ── Step 5: Update waterfalls ────────────────────────────

export async function updateWaterfallsAction(
  sleeveId: string,
  clientId: string,
  sellWaterfall: WaterfallEntry[],
  buyWaterfall: WaterfallEntry[],
  minTradeAmount: number,
): Promise<WizardResult> {
  await requireUser();

  if (!sleeveId) return { error: "Sleeve not created yet" };

  const sellJson = JSON.stringify(
    sellWaterfall.map((e) => ({ productId: e.productId, maxSellPct: e.maxPct, excluded: e.excluded })),
  );
  const buyJson = JSON.stringify(
    buyWaterfall.map((e) => ({ productId: e.productId, maxBuyPct: e.maxPct, excluded: e.excluded })),
  );

  await prisma.clientSleeve.update({
    where: { id: sleeveId },
    data: {
      sellWaterfallJson: sellJson,
      buyWaterfallJson: buyJson,
      minTradeAmount: Math.max(0, minTradeAmount),
    },
  });

  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}

// ── Data loaders ─────────────────────────────────────────

export async function loadClientsForSleeve(): Promise<
  { id: string; name: string; hasSleeve: boolean }[]
> {
  const user = await requireUser();
  const wgFilter = wealthGroupFilter(user);
  let where: Record<string, unknown> = {};
  if (wgFilter) where = { ...where, ...wgFilter };

  if (user.role === "ADVISER") {
    const adviser = await prisma.adviser.findUnique({ where: { userId: user.id } });
    if (adviser) where = { ...where, adviserId: adviser.id };
    else return [];
  }

  const clients = await prisma.client.findMany({
    where,
    select: { id: true, name: true, clientSleeve: { select: { id: true } } },
    orderBy: { name: "asc" },
  });

  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    hasSleeve: !!c.clientSleeve,
  }));
}

export async function loadProductsForLiquid(): Promise<
  { id: string; name: string; type: string }[]
> {
  await requireUser();
  return prisma.product.findMany({
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
  });
}

export async function loadApprovedFunds(clientId: string): Promise<
  { id: string; name: string; currency: string }[]
> {
  await requireUser();
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { wealthGroupId: true },
  });
  if (!client?.wealthGroupId) return [];

  return prisma.pMFund.findMany({
    where: {
      approvals: {
        some: { isApproved: true, wealthGroupId: client.wealthGroupId },
      },
    },
    select: { id: true, name: true, currency: true },
    orderBy: { name: "asc" },
  });
}

/** Load a client's total portfolio value from their holdings */
export async function loadClientPortfolioValue(clientId: string): Promise<number> {
  await requireUser();
  const holdings = await prisma.holding.findMany({
    where: { account: { clientId } },
    select: { marketValue: true },
  });
  return holdings.reduce((sum, h) => sum + h.marketValue, 0);
}

/** Load a client's holdings as liquid-bucket-ready entries */
export async function loadClientHoldings(clientId: string): Promise<
  { productId: string; productName: string; marketValue: number }[]
> {
  await requireUser();
  const holdings = await prisma.holding.findMany({
    where: { account: { clientId } },
    select: {
      marketValue: true,
      product: { select: { id: true, name: true } },
    },
  });

  // Aggregate by product
  const byProduct = new Map<string, { productId: string; productName: string; marketValue: number }>();
  for (const h of holdings) {
    const existing = byProduct.get(h.product.id);
    if (existing) {
      existing.marketValue += h.marketValue;
    } else {
      byProduct.set(h.product.id, {
        productId: h.product.id,
        productName: h.product.name,
        marketValue: h.marketValue,
      });
    }
  }

  return Array.from(byProduct.values()).sort((a, b) => b.marketValue - a.marketValue);
}
