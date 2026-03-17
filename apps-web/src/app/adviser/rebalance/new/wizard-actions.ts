"use server";

import { revalidatePath } from "next/cache";
import { requireUser, wealthGroupFilter } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MappingScope, TaxonomyNodeType } from "@/generated/prisma/enums";
import { computeAllocation, type HoldingInput, type MappingInput } from "@/lib/allocation";
import { generateRebalanceTrades, type RebalanceHolding, type RebalanceTarget } from "@/lib/rebalance";
import { validateTransition, type ActorRole } from "@/lib/approval";
import { canCreateOrders, canSubmitOrders, canFillOrders, type ExecutionStatus } from "@/lib/execution";
import type { DriftRow, TradeRow, EventRow, OrderRow, LiquidityBucket, SleeveSummary, AvailableProduct } from "./wizard-config";

export type WizardResult = { error?: string; success?: boolean };

// ── Data loaders ─────────────────────────────────────────

export async function loadClientsForRebalance(): Promise<
  { id: string; name: string; hasSAA: boolean; saaId: string | null; saaName: string | null }[]
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
    select: {
      id: true,
      name: true,
      clientSAA: { select: { saaId: true, saa: { select: { name: true } } } },
    },
    orderBy: { name: "asc" },
  });

  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    hasSAA: !!c.clientSAA,
    saaId: c.clientSAA?.saaId ?? null,
    saaName: c.clientSAA?.saa.name ?? null,
  }));
}

export async function loadSAAList(): Promise<{ id: string; name: string }[]> {
  await requireUser();
  return prisma.sAA.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function loadAvailableProducts(): Promise<AvailableProduct[]> {
  await requireUser();
  return prisma.product.findMany({
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
  });
}

// ── Sleeve summary loader ────────────────────────────────

export async function loadSleeveSummary(clientId: string): Promise<SleeveSummary | null> {
  await requireUser();

  const sleeve = await prisma.clientSleeve.findUnique({
    where: { clientId },
    include: {
      liquidPositions: true,
      commitments: true,
    },
  });

  if (!sleeve) return null;

  const liquidBucketValue = sleeve.liquidPositions.reduce((s, p) => s + p.marketValue, 0);
  const pmExposure = sleeve.commitments.reduce((s, c) => s + c.commitmentAmount, 0);
  const totalUnfunded = sleeve.commitments.reduce((s, c) => s + (c.commitmentAmount - c.fundedAmount), 0);
  const requiredBuffer = sleeve.bufferMethod === "VS_UNFUNDED_PCT"
    ? totalUnfunded * sleeve.bufferPctOfUnfunded
    : 0;
  const shortfall = Math.max(0, requiredBuffer - liquidBucketValue);

  let warningStatus: "OK" | "WARN" | "CRITICAL" = "OK";
  if (shortfall > 0) warningStatus = shortfall < requiredBuffer * 0.25 ? "WARN" : "CRITICAL";

  return {
    sleeveName: sleeve.name,
    liquidBucketValue,
    pmExposure,
    cashBufferPct: sleeve.cashBufferPct,
    bufferMethod: sleeve.bufferMethod,
    warningStatus,
  };
}

// ── Step 1: Generate rebalance plan ──────────────────────

export async function generateRebalancePlanWizardAction(
  clientId: string,
  saaId: string,
): Promise<{
  error?: string;
  planId?: string;
  totalPortfolioValue?: number;
  breachesBefore?: number;
  breachesAfter?: number;
  beforeDrift?: DriftRow[];
  afterDrift?: DriftRow[];
  trades?: TradeRow[];
  availableProducts?: AvailableProduct[];
}> {
  await requireUser();

  if (!clientId) return { error: "Select a client" };

  // Ensure SAA is assigned
  const existingSAA = await prisma.clientSAA.findUnique({ where: { clientId } });
  if (!existingSAA && saaId) {
    await prisma.clientSAA.create({ data: { clientId, saaId } });
  } else if (!existingSAA && !saaId) {
    return { error: "Select an SAA for this client" };
  }

  const effectiveSAAId = existingSAA?.saaId ?? saaId;

  const saa = await prisma.sAA.findUnique({
    where: { id: effectiveSAAId },
    include: {
      allocations: { include: { node: true } },
      taxonomy: { include: { nodes: true } },
    },
  });

  if (!saa) return { error: "SAA not found" };

  const taxonomy = saa.taxonomy;

  // Build risk bucket lookup
  const riskBucketById = new Map<string, { id: string; name: string }>();
  const riskBuckets = taxonomy.nodes.filter((n) => n.nodeType === TaxonomyNodeType.RISK);
  for (const rb of riskBuckets) riskBucketById.set(rb.id, { id: rb.id, name: rb.name });
  for (const n of taxonomy.nodes) {
    if (n.parentId && riskBucketById.has(n.parentId)) riskBucketById.set(n.id, riskBucketById.get(n.parentId)!);
  }
  for (const n of taxonomy.nodes) {
    if (n.parentId && riskBucketById.has(n.parentId) && !riskBucketById.has(n.id))
      riskBucketById.set(n.id, riskBucketById.get(n.parentId)!);
  }

  const nodeById = new Map(taxonomy.nodes.map((n) => [n.id, n]));

  const productMaps = await prisma.productTaxonomyMap.findMany({
    where: {
      taxonomyId: taxonomy.id,
      OR: [
        { scope: MappingScope.FIRM_DEFAULT },
        { scope: MappingScope.CLIENT_OVERRIDE, clientId },
      ],
    },
  });

  const mappingsByProduct = new Map<string, (typeof productMaps)[number]>();
  for (const m of productMaps) {
    const existing = mappingsByProduct.get(m.productId);
    if (!existing || m.scope === MappingScope.CLIENT_OVERRIDE) mappingsByProduct.set(m.productId, m);
  }

  const mappings: MappingInput[] = [];
  for (const [, m] of mappingsByProduct) {
    const node = nodeById.get(m.nodeId);
    if (!node) continue;
    const rb = riskBucketById.get(m.nodeId);
    mappings.push({
      productId: m.productId,
      nodeId: m.nodeId,
      nodeName: node.name,
      nodeType: node.nodeType,
      riskBucketId: rb?.id ?? null,
      riskBucketName: rb?.name ?? null,
    });
  }

  const accounts = await prisma.account.findMany({
    where: { clientId },
    include: {
      holdings: {
        include: {
          product: { select: { id: true, name: true, type: true } },
          lookthroughHoldings: {
            include: { underlyingProduct: { select: { name: true } } },
          },
        },
      },
    },
  });

  const rebalanceHoldings: RebalanceHolding[] = [];
  const mapByProduct = new Map(mappings.map((m) => [m.productId, m]));

  for (const a of accounts) {
    for (const h of a.holdings) {
      if (h.product.type === "MANAGED_PORTFOLIO" && h.lookthroughHoldings.length > 0) {
        for (const lt of h.lookthroughHoldings) {
          const m = mapByProduct.get(lt.underlyingProductId);
          if (!m) continue;
          const existing = rebalanceHoldings.find((rh) => rh.productId === lt.underlyingProductId && rh.nodeId === m.nodeId);
          if (existing) existing.marketValue += lt.underlyingMarketValue;
          else rebalanceHoldings.push({
            productId: lt.underlyingProductId,
            productName: lt.underlyingProduct.name,
            marketValue: lt.underlyingMarketValue,
            nodeId: m.nodeId,
            nodeName: m.nodeName,
          });
        }
      } else {
        const m = mapByProduct.get(h.productId);
        if (!m) continue;
        const existing = rebalanceHoldings.find((rh) => rh.productId === h.productId && rh.nodeId === m.nodeId);
        if (existing) existing.marketValue += h.marketValue;
        else rebalanceHoldings.push({
          productId: h.productId,
          productName: h.product.name,
          marketValue: h.marketValue,
          nodeId: m.nodeId,
          nodeName: m.nodeName,
        });
      }
    }
  }

  const rebalanceTargets: RebalanceTarget[] = saa.allocations.map((a) => ({
    nodeId: a.nodeId,
    nodeName: a.node.name,
    targetWeight: a.targetWeight,
    minWeight: a.minWeight,
    maxWeight: a.maxWeight,
  }));

  const result = generateRebalanceTrades(rebalanceHoldings, rebalanceTargets, { minTradeAmount: 500 });

  if (result.trades.length === 0) {
    return { error: "Portfolio is within tolerance bands — no trades needed." };
  }

  const plan = await prisma.rebalancePlan.create({
    data: {
      clientId,
      saaId: effectiveSAAId,
      status: "DRAFT",
      summaryJson: JSON.stringify({
        totalPortfolioValue: result.totalPortfolioValue,
        breachesBefore: result.breachesBefore,
        breachesAfter: result.breachesAfter,
        beforeDrift: result.beforeDrift,
        afterDrift: result.afterDrift,
      }),
      trades: {
        create: result.trades.map((t) => ({
          productId: t.productId,
          side: t.side,
          amount: t.amount,
          reason: t.reason,
        })),
      },
    },
    include: {
      trades: { include: { product: { select: { name: true } } } },
    },
  });

  // Get sleeve liquid product IDs for marking sleeve trades
  const sleevePositions = await prisma.sleeveLiquidPosition.findMany({
    where: { sleeve: { clientId } },
    select: { productId: true },
  });
  const sleeveProductIds = new Set(sleevePositions.map((p) => p.productId));

  const products = await prisma.product.findMany({
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
  });

  revalidatePath(`/clients/${clientId}`);

  return {
    planId: plan.id,
    totalPortfolioValue: result.totalPortfolioValue,
    breachesBefore: result.breachesBefore,
    breachesAfter: result.breachesAfter,
    beforeDrift: result.beforeDrift as DriftRow[],
    afterDrift: result.afterDrift as DriftRow[],
    trades: plan.trades.map((t) => ({
      id: t.id,
      productId: t.productId,
      productName: t.product.name,
      side: t.side,
      amount: t.amount,
      reason: t.reason,
      isSleeve: sleeveProductIds.has(t.productId),
    })),
    availableProducts: products.map((p) => ({ id: p.id, name: p.name, type: p.type })),
  };
}

// ── Step 4: Save amended trades ──────────────────────────

export async function saveAmendedTradesAction(
  planId: string,
  clientId: string,
  trades: TradeRow[],
): Promise<{ error?: string; success?: boolean }> {
  await requireUser();

  const plan = await prisma.rebalancePlan.findUnique({ where: { id: planId } });
  if (!plan) return { error: "Plan not found" };
  if (plan.status !== "DRAFT") return { error: "Can only amend DRAFT plans" };

  // Delete existing trades and recreate
  await prisma.rebalanceTrade.deleteMany({ where: { planId } });

  for (const t of trades) {
    if (t.amount <= 0) continue;
    await prisma.rebalanceTrade.create({
      data: {
        planId,
        productId: t.productId,
        side: t.side as "BUY" | "SELL",
        amount: t.amount,
        reason: t.reason,
      },
    });
  }

  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}

// ── Step 3: Enhanced liquidity check ─────────────────────

export async function checkLiquidityAction(
  clientId: string,
  totalTradeValue: number,
  includeSleeve: boolean,
): Promise<{
  error?: string;
  buckets?: LiquidityBucket[];
  totalLiquid?: number;
  sleeveLiquid?: number;
  nonSleeveLiquid?: number;
  liquidityOk?: boolean;
  warnings?: string[];
}> {
  await requireUser();

  const accounts = await prisma.account.findMany({
    where: { clientId },
    include: { holdings: { select: { marketValue: true, product: { select: { id: true, type: true } } } } },
  });

  const allHoldings = accounts.flatMap((a) => a.holdings);
  const totalPortfolio = allHoldings.reduce((s, h) => s + h.marketValue, 0);

  // Get sleeve liquid position product IDs
  const sleevePositions = await prisma.sleeveLiquidPosition.findMany({
    where: { sleeve: { clientId } },
    select: { productId: true, marketValue: true },
  });
  const sleeveProductIds = new Set(sleevePositions.map((p) => p.productId));
  const sleeveTotal = sleevePositions.reduce((s, p) => s + p.marketValue, 0);

  // Classify holdings
  const listedHoldings = allHoldings.filter((h) => h.product.type === "DIRECT" || h.product.type === "ETF");
  const fundHoldings = allHoldings.filter((h) => h.product.type === "FUND" || h.product.type === "MANAGED_PORTFOLIO");

  const listedSleeve = listedHoldings.filter((h) => sleeveProductIds.has(h.product.id)).reduce((s, h) => s + h.marketValue, 0);
  const listedNonSleeve = listedHoldings.reduce((s, h) => s + h.marketValue, 0) - listedSleeve;

  const fundSleeve = fundHoldings.filter((h) => sleeveProductIds.has(h.product.id)).reduce((s, h) => s + h.marketValue, 0);
  const fundNonSleeve = fundHoldings.reduce((s, h) => s + h.marketValue, 0) - fundSleeve;

  const listedTotal = listedHoldings.reduce((s, h) => s + h.marketValue, 0);
  const fundTotal = fundHoldings.reduce((s, h) => s + h.marketValue, 0);

  const buckets: LiquidityBucket[] = [
    {
      horizonLabel: "T+2 (Listed/ETF)",
      horizonDays: 2,
      grossValue: includeSleeve ? listedTotal : listedNonSleeve,
      stressedValue: (includeSleeve ? listedTotal : listedNonSleeve) * 0.98,
      pctOfPortfolio: totalPortfolio > 0 ? (includeSleeve ? listedTotal : listedNonSleeve) / totalPortfolio : 0,
      gatedCount: 0,
      sleeveValue: listedSleeve,
      nonSleeveValue: listedNonSleeve,
    },
    {
      horizonLabel: "30 days (Funds)",
      horizonDays: 30,
      grossValue: includeSleeve ? fundTotal : fundNonSleeve,
      stressedValue: (includeSleeve ? fundTotal : fundNonSleeve) * 0.95,
      pctOfPortfolio: totalPortfolio > 0 ? (includeSleeve ? fundTotal : fundNonSleeve) / totalPortfolio : 0,
      gatedCount: 0,
      sleeveValue: fundSleeve,
      nonSleeveValue: fundNonSleeve,
    },
  ];

  const effectiveLiquid = includeSleeve ? listedTotal + fundTotal : listedNonSleeve + fundNonSleeve;
  const warnings: string[] = [];

  if (totalTradeValue > (includeSleeve ? listedTotal : listedNonSleeve)) {
    warnings.push(`Trade volume (${fmt(totalTradeValue)}) exceeds immediately liquid assets (${fmt(includeSleeve ? listedTotal : listedNonSleeve)}).`);
  }

  if (!includeSleeve && sleeveTotal > 0) {
    warnings.push(`Sleeve excluded — ${fmt(sleeveTotal)} in sleeve liquid positions not available for rebalance.`);
  }

  if (includeSleeve && sleeveTotal > 0) {
    warnings.push(`Sleeve included — ${fmt(sleeveTotal)} from sleeve liquid positions contributing to rebalance liquidity.`);
  }

  return {
    buckets,
    totalLiquid: effectiveLiquid,
    sleeveLiquid: sleeveTotal,
    nonSleeveLiquid: effectiveLiquid - sleeveTotal,
    liquidityOk: warnings.filter((w) => w.includes("exceeds")).length === 0,
    warnings,
  };
}

function fmt(v: number): string {
  return "$" + Math.round(v).toLocaleString();
}

// ── Step 5: Approval actions ─────────────────────────────

export async function approveRebalanceWizardAction(
  planId: string,
): Promise<{ error?: string; newStatus?: string; events?: EventRow[] }> {
  const user = await requireUser();

  const plan = await prisma.rebalancePlan.findUnique({
    where: { id: planId },
    include: { events: { orderBy: { createdAt: "asc" } } },
  });
  if (!plan) return { error: "Plan not found" };

  const result = validateTransition(
    plan.status as "DRAFT" | "ADVISER_APPROVED" | "CLIENT_APPROVED" | "REJECTED",
    "APPROVE",
    user.role as ActorRole,
  );
  if (!result.ok) return { error: result.error };

  const updated = await prisma.rebalancePlan.update({
    where: { id: planId },
    data: {
      status: result.newStatus,
      events: { create: { action: "APPROVE", actorUserId: user.id, actorRole: user.role } },
    },
    include: { events: { orderBy: { createdAt: "asc" } } },
  });

  revalidatePath(`/clients/${plan.clientId}`);

  return {
    newStatus: updated.status,
    events: updated.events.map((e) => ({
      id: e.id,
      action: e.action,
      actorRole: e.actorRole,
      note: e.note,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

export async function rejectRebalanceWizardAction(
  planId: string,
  note?: string,
): Promise<{ error?: string; newStatus?: string; events?: EventRow[] }> {
  const user = await requireUser();

  const plan = await prisma.rebalancePlan.findUnique({
    where: { id: planId },
    include: { events: { orderBy: { createdAt: "asc" } } },
  });
  if (!plan) return { error: "Plan not found" };

  const result = validateTransition(
    plan.status as "DRAFT" | "ADVISER_APPROVED" | "CLIENT_APPROVED" | "REJECTED",
    "REJECT",
    user.role as ActorRole,
  );
  if (!result.ok) return { error: result.error };

  const updated = await prisma.rebalancePlan.update({
    where: { id: planId },
    data: {
      status: result.newStatus,
      events: { create: { action: "REJECT", actorUserId: user.id, actorRole: user.role, note } },
    },
    include: { events: { orderBy: { createdAt: "asc" } } },
  });

  revalidatePath(`/clients/${plan.clientId}`);

  return {
    newStatus: updated.status,
    events: updated.events.map((e) => ({
      id: e.id,
      action: e.action,
      actorRole: e.actorRole,
      note: e.note,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

// ── Step 6: Execution actions ────────────────────────────

export async function createRebalanceOrdersWizardAction(
  planId: string,
): Promise<{ error?: string; orders?: OrderRow[] }> {
  await requireUser();

  const plan = await prisma.rebalancePlan.findUnique({
    where: { id: planId },
    include: { trades: { include: { product: { select: { name: true } } } } },
  });
  if (!plan) return { error: "Plan not found" };

  const existingOrders = await prisma.order.count({ where: { sourceId: planId } });
  const check = canCreateOrders(plan.status, existingOrders);
  if (!check.ok) return { error: check.error };

  await prisma.order.createMany({
    data: plan.trades.map((t) => ({
      clientId: plan.clientId,
      source: "REBALANCE_PLAN" as const,
      sourceId: planId,
      productId: t.productId,
      side: t.side as "BUY" | "SELL",
      amount: t.amount,
      status: "CREATED" as const,
    })),
  });

  const orders = await prisma.order.findMany({
    where: { sourceId: planId },
    include: { product: { select: { name: true } }, events: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  await prisma.orderEvent.createMany({
    data: orders.map((o) => ({ orderId: o.id, status: "CREATED" as const, note: "Order created from rebalance plan" })),
  });

  revalidatePath(`/clients/${plan.clientId}`);

  return {
    orders: orders.map((o) => ({
      id: o.id,
      productName: o.product.name,
      side: o.side,
      amount: o.amount,
      status: "CREATED",
      lastEvent: "Order created from rebalance plan",
    })),
  };
}

export async function submitRebalanceOrdersWizardAction(
  planId: string,
): Promise<{ error?: string; orders?: OrderRow[] }> {
  await requireUser();

  const plan = await prisma.rebalancePlan.findUnique({ where: { id: planId } });
  if (!plan) return { error: "Plan not found" };

  const orders = await prisma.order.findMany({ where: { sourceId: planId } });
  const statuses = orders.map((o) => o.status as ExecutionStatus);
  const check = canSubmitOrders(statuses);
  if (!check.ok) return { error: check.error };

  const createdOrders = orders.filter((o) => o.status === "CREATED");
  await prisma.$transaction(
    createdOrders.flatMap((o) => [
      prisma.order.update({ where: { id: o.id }, data: { status: "SUBMITTED" } }),
      prisma.orderEvent.create({ data: { orderId: o.id, status: "SUBMITTED", note: "Simulated submission to platform" } }),
    ]),
  );

  revalidatePath(`/clients/${plan.clientId}`);
  return { orders: await loadOrders(planId) };
}

export async function fillRebalanceOrdersWizardAction(
  planId: string,
): Promise<{ error?: string; orders?: OrderRow[] }> {
  await requireUser();

  const plan = await prisma.rebalancePlan.findUnique({ where: { id: planId } });
  if (!plan) return { error: "Plan not found" };

  const orders = await prisma.order.findMany({ where: { sourceId: planId } });
  const statuses = orders.map((o) => o.status as ExecutionStatus);
  const check = canFillOrders(statuses);
  if (!check.ok) return { error: check.error };

  const fillable = orders.filter((o) => o.status === "SUBMITTED" || o.status === "PARTIALLY_FILLED");
  const partialIdx = fillable.length > 1 ? Math.floor(Math.random() * fillable.length) : -1;

  type ExecStatus = "FILLED" | "PARTIALLY_FILLED";
  const ops = fillable.flatMap((o, i) => {
    let newStatus: ExecStatus;
    let note: string;
    if (i === partialIdx && o.status === "SUBMITTED") {
      newStatus = "PARTIALLY_FILLED";
      note = `Simulated partial fill: ${Math.floor(50 + Math.random() * 40)}% filled`;
    } else {
      newStatus = "FILLED";
      note = "Simulated full fill";
    }
    return [
      prisma.order.update({ where: { id: o.id }, data: { status: newStatus } }),
      prisma.orderEvent.create({ data: { orderId: o.id, status: newStatus, note } }),
    ];
  });

  await prisma.$transaction(ops);
  revalidatePath(`/clients/${plan.clientId}`);
  return { orders: await loadOrders(planId) };
}

async function loadOrders(planId: string): Promise<OrderRow[]> {
  const orders = await prisma.order.findMany({
    where: { sourceId: planId },
    include: { product: { select: { name: true } }, events: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "asc" },
  });
  return orders.map((o) => ({
    id: o.id,
    productName: o.product.name,
    side: o.side,
    amount: o.amount,
    status: o.status,
    lastEvent: o.events[0]?.note ?? null,
  }));
}
