import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, wealthGroupFilter } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MappingScope, TaxonomyNodeType } from "@/generated/prisma/enums";
import { computeAllocation, type HoldingInput, type MappingInput } from "@/lib/allocation";
import { computeDrift, type CurrentWeightInput, type TargetInput } from "@/lib/drift";
import { computeSleeveTotals, groupByCurrency, type CommitmentInput } from "@/lib/sleeve";
import { computeFundMetrics } from "@/lib/pm-curves";
import { computeSnapshotFromEvents, selectTemplate, computeProjections } from "@/lib/pm-lifecycle";
import {
  computeRequiredVsUnfunded,
  computeRequiredVsProjectedCalls,
  assessLiquidity,
  type ProjectedCall,
  type LiquidityAssessment,
  type BufferConfig,
} from "@/lib/liquidity";
import {
  generateSellLegs,
  generateBuyLegs,
  computeExcess,
  type WaterfallPosition,
  type SellWaterfallEntry,
  type BuyWaterfallEntry,
} from "@/lib/waterfall";
import { computeExpectedOutcomes, computeHorizonOutcomes, type CMAInput, type WeightInput, type CorrelationEntry } from "@/lib/cma";
import {
  buildLiquidityLadder,
  type LiquidityProfileData,
  type ProductMapping as LPProductMapping,
  type TaxonomyNode as LPTaxNode,
  type ExposureInput,
} from "@/lib/liquidity-profile";

// Client-side components from /clients/[id]/
import { HoldingsTable } from "@/app/clients/[id]/holdings-table";
import { AllocationView } from "@/app/clients/[id]/allocation-view";
import { SAASelector } from "@/app/clients/[id]/saa-selector";
import { DriftView } from "@/app/clients/[id]/drift-view";
import { CreateSleeveForm, SleeveSummary } from "@/app/clients/[id]/sleeve-view";
import { RebalanceGenerateButton, RebalancePlanCard } from "@/app/clients/[id]/rebalance-view";
import { ExpectedOutcomesView } from "@/app/clients/[id]/expected-outcomes-view";
import { LiquidityLadderView } from "@/app/clients/[id]/liquidity-ladder-view";
import { LiquidityStressView } from "@/app/clients/[id]/liquidity-stress-view";
import { ClientDashboard } from "@/app/clients/[id]/client-dashboard";

import { ClientTabs } from "./client-tabs";

// ── Shared account type ──────────────────────────────────

type AccountHoldings = {
  id: string;
  accountName: string;
  platform: string;
  holdings: {
    id: string;
    productId: string;
    marketValue: number;
    units: number | null;
    price: number | null;
    product: { id: string; name: string; type: string };
    lookthroughHoldings: {
      id: string;
      underlyingProductId: string;
      underlyingMarketValue: number;
      weight: number;
      underlyingProduct: { id: string; name: string };
    }[];
  }[];
};

const money = (v: number) => "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// ── Main page ────────────────────────────────────────────

export default async function AdviserClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      adviser: true,
      accounts: {
        include: {
          holdings: {
            orderBy: { marketValue: "desc" },
            include: {
              product: true,
              lookthroughHoldings: {
                orderBy: { weight: "desc" },
                include: { underlyingProduct: true },
              },
            },
          },
        },
      },
    },
  });

  if (!client) notFound();

  // Authorization
  if (user.role !== "SUPER_ADMIN" && user.wealthGroupId && client.wealthGroupId !== user.wealthGroupId) {
    return <NotAuthorised />;
  }
  if (user.role === "ADVISER") {
    const adviser = await prisma.adviser.findUnique({ where: { userId: user.id } });
    if (!adviser || client.adviserId !== adviser.id) return <NotAuthorised />;
  }

  const totalValue = client.accounts.reduce(
    (sum, a) => sum + a.holdings.reduce((s, h) => s + h.marketValue, 0), 0,
  );

  // ── Quick summary data ───────────────────────────────
  const sleeve = await prisma.clientSleeve.findUnique({
    where: { clientId: id },
    select: { name: true, cashBufferPct: true, bufferMethod: true, bufferPctOfUnfunded: true,
      liquidPositions: { select: { marketValue: true } },
      commitments: { select: { commitmentAmount: true, fundedAmount: true } } },
  });
  const sleeveValue = sleeve?.liquidPositions.reduce((s, p) => s + p.marketValue, 0) ?? 0;
  const totalUnfunded = sleeve?.commitments.reduce((s, c) => s + Math.max(0, c.commitmentAmount - c.fundedAmount), 0) ?? 0;

  const clientSAA = await prisma.clientSAA.findUnique({
    where: { clientId: id },
    select: { saa: { select: { name: true } } },
  });

  // Pending approvals count
  const pendingRebalances = await prisma.rebalancePlan.count({
    where: { clientId: id, status: { in: ["DRAFT", "ADVISER_APPROVED"] } },
  });

  return (
    <div className="space-y-0">
      {/* ── Sticky Header ─────────────────────────────── */}
      <div className="sticky top-0 z-10 -mx-6 -mt-6 bg-white/95 backdrop-blur border-b border-zinc-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/adviser/clients" className="text-zinc-400 hover:text-zinc-700 text-sm">&larr;</Link>
            <div>
              <h1 className="text-xl font-semibold text-zinc-900">{client.name}</h1>
              <div className="flex gap-3 mt-0.5 text-xs text-zinc-500">
                <span>Portfolio: {money(totalValue)}</span>
                {sleeveValue > 0 && <span>Sleeve: {money(sleeveValue)}</span>}
                {clientSAA && <span>SAA: {clientSAA.saa.name}</span>}
                {pendingRebalances > 0 && (
                  <span className="text-amber-600">{pendingRebalances} pending approval{pendingRebalances !== 1 ? "s" : ""}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/adviser/rebalance/new" className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800">Rebalance</Link>
            <Link href="/adviser/sleeve/new" className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50">Adjust Sleeve</Link>
          </div>
        </div>
      </div>

      {/* ── Tabs + Content ────────────────────────────── */}
      <div className="mt-6 flex gap-6">
        {/* Main content area */}
        <div className="flex-1 min-w-0">
          <ClientTabs>
            {{
              overview: <OverviewTab accounts={client.accounts} clientId={id} clientName={client.name} totalValue={totalValue} adviserId={client.adviserId} />,
              portfolio: <PortfolioTab accounts={client.accounts} clientId={id} adviserId={client.adviserId} />,
              sleeve: <SleeveTab clientId={id} />,
              saa: <SAATab clientId={id} accounts={client.accounts} />,
              rebalance: <RebalanceTab clientId={id} />,
              projections: <ProjectionsTab clientId={id} />,
            }}
          </ClientTabs>
        </div>

        {/* ── Right Summary Rail (desktop) ────────────── */}
        <aside className="hidden xl:block w-64 shrink-0">
          <div className="sticky top-24 space-y-4">
            <RailCard label="Portfolio" value={money(totalValue)} />
            <RailCard label="Sleeve" value={sleeveValue > 0 ? money(sleeveValue) : "None"} />
            <RailCard label="Unfunded PM" value={totalUnfunded > 0 ? money(totalUnfunded) : "—"} />
            <RailCard label="SAA" value={clientSAA?.saa.name ?? "Not assigned"} />
            <RailCard label="Pending" value={pendingRebalances > 0 ? `${pendingRebalances} approval${pendingRebalances !== 1 ? "s" : ""}` : "None"} color={pendingRebalances > 0 ? "amber" : undefined} />
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Rail card ────────────────────────────────────────────

function RailCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-0.5 text-sm font-medium ${color === "amber" ? "text-amber-600" : "text-zinc-900"}`}>{value}</p>
    </div>
  );
}

function NotAuthorised() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="max-w-sm text-center">
        <h1 className="text-xl font-semibold text-zinc-900">Not authorised</h1>
        <p className="mt-2 text-sm text-zinc-500">You can only view your own clients.</p>
        <Link href="/adviser/clients" className="mt-4 inline-block text-sm font-medium text-zinc-900 hover:underline">&larr; Back to clients</Link>
      </div>
    </div>
  );
}

// ── Helper: build taxonomy/allocation context ────────────

type TaxCtx = {
  mappings: MappingInput[];
  holdingInputs: HoldingInput[];
  riskBucketById: Map<string, { id: string; name: string }>;
  mappingsByProduct: Map<string, { nodeId: string; productId: string }>;
};

async function buildTaxCtx(accounts: AccountHoldings[], clientId: string): Promise<TaxCtx | null> {
  const taxonomy = await prisma.taxonomy.findFirst({
    include: { nodes: true, productMaps: { where: { OR: [{ scope: MappingScope.FIRM_DEFAULT }, { scope: MappingScope.CLIENT_OVERRIDE, clientId }] } } },
    orderBy: { createdAt: "asc" },
  });
  if (!taxonomy) return null;

  const riskBucketById = new Map<string, { id: string; name: string }>();
  for (const n of taxonomy.nodes) if (n.nodeType === TaxonomyNodeType.RISK) riskBucketById.set(n.id, { id: n.id, name: n.name });
  for (const n of taxonomy.nodes) if (n.parentId && riskBucketById.has(n.parentId)) riskBucketById.set(n.id, riskBucketById.get(n.parentId)!);
  for (const n of taxonomy.nodes) if (n.parentId && riskBucketById.has(n.parentId) && !riskBucketById.has(n.id)) riskBucketById.set(n.id, riskBucketById.get(n.parentId)!);

  const nodeById = new Map(taxonomy.nodes.map((n) => [n.id, n]));
  const mappingsByProduct = new Map<string, { nodeId: string; productId: string }>();
  const rawMap = new Map<string, typeof taxonomy.productMaps[number]>();
  for (const m of taxonomy.productMaps) { const ex = rawMap.get(m.productId); if (!ex || m.scope === MappingScope.CLIENT_OVERRIDE) rawMap.set(m.productId, m); }

  const mappings: MappingInput[] = [];
  for (const [, m] of rawMap) {
    const node = nodeById.get(m.nodeId);
    if (!node) continue;
    const rb = riskBucketById.get(m.nodeId);
    mappings.push({ productId: m.productId, nodeId: m.nodeId, nodeName: node.name, nodeType: node.nodeType, riskBucketId: rb?.id ?? null, riskBucketName: rb?.name ?? null });
    mappingsByProduct.set(m.productId, { nodeId: m.nodeId, productId: m.productId });
  }

  const holdingInputs: HoldingInput[] = accounts.flatMap((a) =>
    a.holdings.map((h) => ({
      productId: h.productId, productName: h.product.name, productType: h.product.type, marketValue: h.marketValue,
      lookthrough: h.lookthroughHoldings.map((lt) => ({ underlyingProductId: lt.underlyingProductId, underlyingProductName: lt.underlyingProduct.name, underlyingMarketValue: lt.underlyingMarketValue, weight: lt.weight })),
    })),
  );

  return { mappings, holdingInputs, riskBucketById, mappingsByProduct };
}

// ══════════════════════════════════════════════════════════
// TABS
// ══════════════════════════════════════════════════════════

// ── 1. Overview Tab ──────────────────────────────────────

async function OverviewTab({ accounts, clientId, clientName, totalValue, adviserId }: { accounts: AccountHoldings[]; clientId: string; clientName: string; totalValue: number; adviserId: string }) {
  // Fetch sleeve summary for dashboard
  const sleeve = await prisma.clientSleeve.findUnique({
    where: { clientId },
    include: {
      commitments: { include: { fund: { select: { name: true, currency: true, truth: { include: { defaultTemplate: { select: { id: true, name: true, callCurvePctJson: true, distCurvePctJson: true } } } } } } } },
      liquidPositions: { include: { product: { select: { id: true, name: true } } } },
    },
  });

  const liquidBucketValue = sleeve?.liquidPositions.reduce((s, p) => s + p.marketValue, 0) ?? 0;
  const sleeveAllocationData = sleeve ? { liquidBucketValue, positions: sleeve.liquidPositions.map((p) => ({ productId: p.productId, productName: p.product.name, marketValue: p.marketValue })) } : null;

  let sleeveHealth = null;
  const pmProjections: { fundName: string; projectedCalls: { month: string; amount: number }[] }[] = [];

  if (sleeve) {
    const totalUnf = sleeve.commitments.reduce((s, c) => s + Math.max(0, c.commitmentAmount - c.fundedAmount), 0);
    const pmExp = sleeve.commitments.reduce((s, c) => s + c.commitmentAmount, 0);
    const req = sleeve.bufferMethod === "VS_UNFUNDED_PCT" ? totalUnf * sleeve.bufferPctOfUnfunded : 0;
    const sf = Math.max(0, req - liquidBucketValue);
    sleeveHealth = { sleeveName: sleeve.name, liquidBucketValue, requiredBuffer: req, severity: (sf === 0 ? "OK" : sf < req * 0.25 ? "WARN" : "CRITICAL") as "OK" | "WARN" | "CRITICAL", cashBufferPct: sleeve.cashBufferPct, totalUnfunded: totalUnf, pmExposure: pmExp };

    for (const c of sleeve.commitments) {
      const tmpl = c.fund.truth?.defaultTemplate;
      if (tmpl) {
        const proj = computeProjections(tmpl.callCurvePctJson, tmpl.distCurvePctJson, c.commitmentAmount, tmpl.name, "default");
        if (proj.projectedCalls.length > 0) pmProjections.push({ fundName: c.fund.name, projectedCalls: proj.projectedCalls });
      }
    }
  }

  // Allocation + drift
  const ctx = await buildTaxCtx(accounts, clientId);
  const allocation = ctx ? computeAllocation(ctx.holdingInputs, ctx.mappings) : null;

  const productHoldings: import("@/lib/allocation-chart-data").ProductHolding[] = [];
  const pmCommitments: import("@/lib/allocation-chart-data").PMCommitmentSummary[] = [];

  if (ctx && allocation) {
    const phMap = new Map<string, (typeof productHoldings)[number]>();
    for (const h of ctx.holdingInputs) {
      if (h.productType === "MANAGED_PORTFOLIO" && h.lookthrough.length > 0) {
        for (const lt of h.lookthrough) { const m = ctx.mappingsByProduct.get(lt.underlyingProductId); const rb = m ? ctx.riskBucketById.get(m.nodeId) : undefined; const ex = phMap.get(lt.underlyingProductId); if (ex) ex.marketValue += lt.underlyingMarketValue; else { const e = { productId: lt.underlyingProductId, productName: lt.underlyingProductName, marketValue: lt.underlyingMarketValue, riskBucketId: rb?.id ?? null, riskBucketName: rb?.name ?? null, assetClassNodeId: m?.nodeId }; phMap.set(lt.underlyingProductId, e); productHoldings.push(e); } }
      } else { const m = ctx.mappingsByProduct.get(h.productId); const rb = m ? ctx.riskBucketById.get(m.nodeId) : undefined; const ex = phMap.get(h.productId); if (ex) ex.marketValue += h.marketValue; else { const e = { productId: h.productId, productName: h.productName, marketValue: h.marketValue, riskBucketId: rb?.id ?? null, riskBucketName: rb?.name ?? null, assetClassNodeId: m?.nodeId }; phMap.set(h.productId, e); productHoldings.push(e); } }
    }
    if (sleeve) { for (const c of sleeve.commitments) { const m = ctx.mappingsByProduct.get(c.fundId); pmCommitments.push({ fundName: c.fund.name, assetClassNodeId: m?.nodeId ?? "", funded: c.fundedAmount, unfunded: Math.max(0, c.commitmentAmount - c.fundedAmount) }); } }
  }

  let driftResult = null;
  let saaName: string | null = null;
  const clientSAA = await prisma.clientSAA.findUnique({ where: { clientId }, include: { saa: { include: { allocations: { include: { node: true } } } } } });
  if (clientSAA?.saa && allocation) {
    saaName = clientSAA.saa.name;
    const cw: CurrentWeightInput[] = allocation.buckets.flatMap((b) => b.assetClasses.map((ac) => ({ nodeId: ac.nodeId, nodeName: ac.nodeName, nodeType: "ASSET_CLASS", riskBucketId: b.riskBucketId, riskBucketName: b.riskBucketName, weight: ac.pctOfTotal })));
    const tg: TargetInput[] = clientSAA.saa.allocations.map((a) => ({ nodeId: a.nodeId, targetWeight: a.targetWeight, minWeight: a.minWeight, maxWeight: a.maxWeight }));
    driftResult = computeDrift(cw, tg);
  }

  // Liquidity
  let liquidityBuckets: import("@/lib/liquidity-profile").LadderBucket[] = [];
  if (ctx) {
    try {
      const po = await prisma.productLiquidityOverride.findMany({ include: { profile: true } });
      const ov = new Map<string, LiquidityProfileData>(po.map((o) => [o.productId, { tier: o.profile.tier, horizonDays: o.profile.horizonDays, stressedHaircutPct: o.profile.stressedHaircutPct, gateOrSuspendRisk: o.profile.gateOrSuspendRisk, noticeDays: o.profile.noticeDays, gatePctPerPeriod: o.profile.gatePctPerPeriod, gatePeriodDays: o.profile.gatePeriodDays }]));
      const ao = await prisma.adviserLiquidityOverride.findMany({ where: { adviserId }, include: { profile: true } });
      const aov = new Map<string, LiquidityProfileData>(ao.map((o) => [o.productId, { tier: o.profile.tier, horizonDays: o.profile.horizonDays, stressedHaircutPct: o.profile.stressedHaircutPct, gateOrSuspendRisk: o.profile.gateOrSuspendRisk, noticeDays: o.profile.noticeDays, gatePctPerPeriod: o.profile.gatePctPerPeriod, gatePeriodDays: o.profile.gatePeriodDays }]));
      const td = await prisma.taxonomyLiquidityDefault.findMany({ include: { profile: true } });
      const tdm = new Map<string, LiquidityProfileData>(td.map((d) => [d.taxonomyNodeId, { tier: d.profile.tier, horizonDays: d.profile.horizonDays, stressedHaircutPct: d.profile.stressedHaircutPct, gateOrSuspendRisk: d.profile.gateOrSuspendRisk, noticeDays: d.profile.noticeDays, gatePctPerPeriod: d.profile.gatePctPerPeriod, gatePeriodDays: d.profile.gatePeriodDays }]));
      const taxonomy = await prisma.taxonomy.findFirst({ include: { nodes: true, productMaps: { where: { OR: [{ scope: MappingScope.FIRM_DEFAULT }, { scope: MappingScope.CLIENT_OVERRIDE, clientId }] } } }, orderBy: { createdAt: "asc" } });
      if (taxonomy) {
        const nds = new Map<string, LPTaxNode>(taxonomy.nodes.map((n) => [n.id, { id: n.id, parentId: n.parentId }]));
        const pm: LPProductMapping[] = taxonomy.productMaps.map((m) => ({ productId: m.productId, nodeId: m.nodeId }));
        const exp: ExposureInput[] = [];
        for (const a of accounts) for (const h of a.holdings) { if (h.product.type === "MANAGED_PORTFOLIO" && h.lookthroughHoldings.length > 0) { for (const lt of h.lookthroughHoldings) exp.push({ productId: lt.underlyingProductId, productName: lt.underlyingProduct.name, marketValue: lt.underlyingMarketValue }); } else exp.push({ productId: h.productId, productName: h.product.name, marketValue: h.marketValue }); }
        const byP = new Map<string, ExposureInput>(); for (const e of exp) { const ex = byP.get(e.productId); if (ex) ex.marketValue += e.marketValue; else byP.set(e.productId, { ...e }); }
        const ladder = buildLiquidityLadder([...byP.values()], pm, ov, tdm, nds, aov);
        liquidityBuckets = ladder.buckets;
      }
    } catch { /* liquidity tables may not exist */ }
  }

  return (
    <ClientDashboard
      clientName={clientName} totalValue={totalValue}
      allocation={allocation} productHoldings={productHoldings} pmCommitments={pmCommitments} sleeveAllocationData={sleeveAllocationData}
      drift={driftResult} saaName={saaName} liquidityBuckets={liquidityBuckets} totalPortfolioValue={totalValue}
      sleeveHealth={sleeveHealth} pmProjections={pmProjections}
    />
  );
}

// ── 2. Portfolio Tab ─────────────────────────────────────

async function PortfolioTab({ accounts, clientId, adviserId }: { accounts: AccountHoldings[]; clientId: string; adviserId: string }) {
  const ctx = await buildTaxCtx(accounts, clientId);
  const allocation = ctx ? computeAllocation(ctx.holdingInputs, ctx.mappings) : null;

  // Drift summary
  let driftResult = null;
  const clientSAA = await prisma.clientSAA.findUnique({ where: { clientId }, include: { saa: { include: { allocations: { include: { node: true } } } } } });
  if (clientSAA?.saa && allocation) {
    const cw: CurrentWeightInput[] = allocation.buckets.flatMap((b) => b.assetClasses.map((ac) => ({ nodeId: ac.nodeId, nodeName: ac.nodeName, nodeType: "ASSET_CLASS", riskBucketId: b.riskBucketId, riskBucketName: b.riskBucketName, weight: ac.pctOfTotal })));
    const tg: TargetInput[] = clientSAA.saa.allocations.map((a) => ({ nodeId: a.nodeId, targetWeight: a.targetWeight, minWeight: a.minWeight, maxWeight: a.maxWeight }));
    driftResult = computeDrift(cw, tg);
  }

  return (
    <div className="space-y-8">
      {/* Allocation */}
      {allocation ? (
        <AllocationView allocation={allocation} />
      ) : (
        <p className="text-sm text-zinc-400">No taxonomy mappings found.</p>
      )}

      {/* Drift summary */}
      {driftResult && (
        <div>
          <h3 className="text-sm font-medium text-zinc-700">Drift Summary</h3>
          <DriftView drift={driftResult} />
        </div>
      )}

      {/* Holdings by account */}
      <div>
        <h3 className="text-sm font-medium text-zinc-700 mb-3">Holdings by Account</h3>
        {accounts.map((account) => (
          <div key={account.id} className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-sm font-medium text-zinc-900">{account.accountName}</h4>
              <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-medium text-zinc-600">{account.platform}</span>
            </div>
            <HoldingsTable holdings={account.holdings} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 3. Sleeve Tab ────────────────────────────────────────

async function SleeveTab({ clientId }: { clientId: string }) {
  const sleeve = await prisma.clientSleeve.findUnique({
    where: { clientId },
    include: {
      commitments: { include: { fund: { select: { name: true, currency: true, profile: true, truth: { include: { defaultTemplate: { select: { id: true, name: true, callCurvePctJson: true, distCurvePctJson: true } } } } } }, cashflowEvents: { orderBy: { eventDate: "asc" } }, navPoints: { orderBy: { date: "asc" } }, scenario: { include: { selectedTemplate: { select: { id: true, name: true, callCurvePctJson: true, distCurvePctJson: true } } } } } },
      liquidPositions: { include: { product: { select: { id: true, name: true, type: true } } } },
    },
  });

  if (!sleeve) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-zinc-700">Private Markets Sleeve</h3>
        <p className="text-sm text-zinc-400">No sleeve configured for this client.</p>
        <CreateSleeveForm clientId={clientId} />
      </div>
    );
  }

  // Build commitment data using lifecycle logic
  const commitmentInputs: CommitmentInput[] = [];
  const commitmentDetails: { fundId: string; fundName: string; currency: string; commitmentAmount: number; fundedAmount: number; navAmount: number; distributionsAmount: number; latestNavDate: string | null; metrics: { unfunded: number; pctCalled: number; dpi: number | null; rvpi: number | null; tvpi: number | null }; projectedCalls: { month: string; amount: number }[]; projectedDistributions: { month: string; amount: number }[]; commitmentId?: string; eventCount?: number; navPointCount?: number; snapshotSource?: string; templateName?: string; templateSource?: string; scenarioTemplateId?: string | null }[] = [];

  for (const c of sleeve.commitments) {
    const events = c.cashflowEvents.map((e) => ({ type: e.type as "CALL" | "DISTRIBUTION", eventDate: e.eventDate.toISOString().slice(0, 10), amount: e.amount, currency: e.currency }));
    const navPts = c.navPoints.map((n) => ({ date: n.date.toISOString().slice(0, 10), navAmount: n.navAmount }));
    const snapshot = computeSnapshotFromEvents(events, navPts, c.fundedAmount, c.navAmount, c.distributionsAmount, c.latestNavDate?.toISOString().slice(0, 10) ?? null);
    const metrics = computeFundMetrics(snapshot.paidIn, snapshot.latestNav ?? 0, snapshot.distributions, c.commitmentAmount);
    const scenarioOverride = c.scenario ? { templateId: c.scenario.selectedTemplate.id, templateName: c.scenario.selectedTemplate.name } : null;
    const fundDefault = c.fund.truth?.defaultTemplate ? { templateId: c.fund.truth.defaultTemplate.id, templateName: c.fund.truth.defaultTemplate.name } : null;
    const templateChoice = selectTemplate(scenarioOverride, fundDefault);
    let projectedCalls: { month: string; amount: number }[] = [];
    let projectedDistributions: { month: string; amount: number }[] = [];
    let templateName = "";
    let templateSource = "";
    if (templateChoice.source !== "none") { const tmpl = c.scenario?.selectedTemplate ?? c.fund.truth?.defaultTemplate; if (tmpl) { const proj = computeProjections(tmpl.callCurvePctJson, tmpl.distCurvePctJson, c.commitmentAmount, templateChoice.templateName, templateChoice.source); projectedCalls = proj.projectedCalls; projectedDistributions = proj.projectedDistributions; templateName = proj.templateName; templateSource = proj.templateSource; } }
    else if (c.fund.profile) { const proj = computeProjections(c.fund.profile.projectedCallPctCurveJson, c.fund.profile.projectedDistPctCurveJson, c.commitmentAmount, "Fund Profile", "legacy"); projectedCalls = proj.projectedCalls; projectedDistributions = proj.projectedDistributions; templateName = proj.templateName; templateSource = proj.templateSource; }
    commitmentInputs.push({ fundId: c.fundId, fundName: c.fund.name, currency: c.fund.currency, commitmentAmount: c.commitmentAmount, fundedAmount: snapshot.paidIn, navAmount: snapshot.latestNav ?? 0, distributionsAmount: snapshot.distributions });
    commitmentDetails.push({ fundId: c.fundId, fundName: c.fund.name, currency: c.fund.currency, commitmentAmount: c.commitmentAmount, fundedAmount: snapshot.paidIn, navAmount: snapshot.latestNav ?? 0, distributionsAmount: snapshot.distributions, latestNavDate: snapshot.latestNavDate, metrics, projectedCalls, projectedDistributions, commitmentId: c.id, eventCount: c.cashflowEvents.length, navPointCount: c.navPoints.length, snapshotSource: snapshot.source, templateName, templateSource, scenarioTemplateId: c.scenario?.selectedTemplateId ?? null });
  }

  const liquidInputs = sleeve.liquidPositions.map((p) => ({ productId: p.productId, productName: p.product.name, marketValue: p.marketValue }));
  const totals = computeSleeveTotals(commitmentInputs, liquidInputs);

  const bufferConfig: BufferConfig = { bufferMethod: sleeve.bufferMethod, bufferPctOfUnfunded: sleeve.bufferPctOfUnfunded, bufferMonthsForward: sleeve.bufferMonthsForward };
  let liquidityAssessment: LiquidityAssessment;
  if (bufferConfig.bufferMethod === "VS_UNFUNDED_PCT") {
    const uf = groupByCurrency(commitmentInputs).map((ct) => ({ currency: ct.currency, totalUnfunded: ct.totalUnfunded }));
    liquidityAssessment = assessLiquidity(computeRequiredVsUnfunded(uf, bufferConfig.bufferPctOfUnfunded), totals.liquidBucketValue);
  } else {
    const allCalls: ProjectedCall[] = commitmentDetails.flatMap((c) => c.projectedCalls.map((pc) => ({ currency: c.currency, month: pc.month, amount: pc.amount })));
    liquidityAssessment = assessLiquidity(computeRequiredVsProjectedCalls(allCalls, bufferConfig.bufferMonthsForward), totals.liquidBucketValue);
  }

  const activeAlerts = await prisma.sleeveAlert.findMany({ where: { clientSleeveId: sleeve.id, isResolved: false }, orderBy: { createdAt: "desc" } });
  const waterfallPositions: WaterfallPosition[] = sleeve.liquidPositions.map((p) => ({ productId: p.productId, productName: p.product.name, productType: p.product.type, marketValue: p.marketValue }));
  let sellWaterfall: SellWaterfallEntry[] = []; let buyWaterfall: BuyWaterfallEntry[] = [];
  try { sellWaterfall = JSON.parse(sleeve.sellWaterfallJson); } catch { /* empty */ }
  try { buyWaterfall = JSON.parse(sleeve.buyWaterfallJson); } catch { /* empty */ }

  let sellRecommendation = null; let buyRecommendation = null;
  if (liquidityAssessment.shortfall > 0) { sellRecommendation = generateSellLegs(waterfallPositions, sellWaterfall, liquidityAssessment.shortfall, sleeve.minTradeAmount); }
  else { const excess = computeExcess(liquidityAssessment.liquidBucketValue, liquidityAssessment.totalRequired); if (excess > 0) buyRecommendation = generateBuyLegs(waterfallPositions, buyWaterfall, excess, sleeve.minTradeAmount); }

  // Persist recommendation if needed
  const existingActive = await prisma.sleeveRecommendation.findFirst({ where: { clientSleeveId: sleeve.id, status: { not: "REJECTED" } }, orderBy: { createdAt: "desc" } });
  const recommendation = sellRecommendation || buyRecommendation;
  if (recommendation && !existingActive) {
    const kind = sellRecommendation ? "RAISE_LIQUIDITY" as const : "INVEST_EXCESS" as const;
    const legs = sellRecommendation?.legs ?? buyRecommendation?.legs ?? [];
    await prisma.sleeveRecommendation.create({ data: { clientSleeveId: sleeve.id, kind, summary: recommendation.summary, status: "DRAFT", legs: { create: legs.map((leg) => ({ action: sellRecommendation ? "SELL" : "BUY", productId: leg.productId, amount: leg.amount, reason: leg.reason })) } } });
  }

  const persistedRecs = await prisma.sleeveRecommendation.findMany({ where: { clientSleeveId: sleeve.id }, include: { legs: { include: { product: { select: { name: true, type: true } } } }, events: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" }, take: 5 });
  const recIds = persistedRecs.map((r) => r.id);
  const allOrders = recIds.length > 0 ? await prisma.order.findMany({ where: { sourceId: { in: recIds } }, include: { product: { select: { name: true } }, events: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { createdAt: "asc" } }) : [];
  const ordersByRecId = new Map<string, typeof allOrders>(); for (const o of allOrders) { const l = ordersByRecId.get(o.sourceId) ?? []; l.push(o); ordersByRecId.set(o.sourceId, l); }
  const recsUI = persistedRecs.map((r) => ({ id: r.id, kind: r.kind as string, summary: r.summary, status: r.status as string, createdAt: r.createdAt.toISOString(), adviserApprovedAt: r.adviserApprovedAt?.toISOString() ?? null, clientApprovedAt: r.clientApprovedAt?.toISOString() ?? null, rejectedAt: r.rejectedAt?.toISOString() ?? null, rejectionReason: r.rejectionReason, legs: r.legs.map((l) => ({ id: l.id, action: l.action as string, productId: l.productId, productName: l.product.name, amount: l.amount, reason: l.reason })), events: r.events.map((e) => ({ id: e.id, action: e.action as string, actorUserId: e.actorUserId, actorRole: e.actorRole, note: e.note, createdAt: e.createdAt.toISOString() })), orders: (ordersByRecId.get(r.id) ?? []).map((o) => ({ id: o.id, productName: o.product.name, side: o.side as string, amount: o.amount, status: o.status as string, updatedAt: o.updatedAt.toISOString(), lastEvent: o.events[0]?.note ?? null })) }));

  const sleeveClient = await prisma.client.findUnique({ where: { id: clientId }, select: { wealthGroupId: true } });
  const approvedFunds = await prisma.pMFund.findMany({ where: { approvals: { some: { isApproved: true, ...(sleeveClient?.wealthGroupId ? { wealthGroupId: sleeveClient.wealthGroupId } : {}) } } }, select: { id: true, name: true, currency: true }, orderBy: { name: "asc" } });
  const products = await prisma.product.findMany({ select: { id: true, name: true, type: true }, orderBy: { name: "asc" } });
  const projTemplates = await prisma.pMProjectionTemplate.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } });

  return (
    <div>
      <h2 className="text-lg font-medium text-zinc-900">Private Markets Sleeve — {sleeve.name}</h2>
      <SleeveSummary
        sleeveName={sleeve.name} targetPct={sleeve.targetPct} cashBufferPct={sleeve.cashBufferPct}
        totals={totals} commitmentDetails={commitmentDetails} liquidPositions={liquidInputs}
        clientId={clientId} sleeveId={sleeve.id} approvedFunds={approvedFunds} products={products}
        bufferConfig={bufferConfig} liquidityAssessment={liquidityAssessment}
        activeAlerts={activeAlerts.map((a) => ({ id: a.id, severity: a.severity, message: a.message, createdAt: a.createdAt.toISOString() }))}
        sellRecommendation={sellRecommendation} buyRecommendation={buyRecommendation}
        sellWaterfall={sellWaterfall} buyWaterfall={buyWaterfall} minTradeAmount={sleeve.minTradeAmount}
        recommendations={recsUI} projectionTemplates={projTemplates}
      />
    </div>
  );
}

// ── 4. SAA Tab ───────────────────────────────────────────

async function SAATab({ clientId, accounts }: { clientId: string; accounts: AccountHoldings[] }) {
  const saas = await prisma.sAA.findMany({ select: { id: true, name: true, ownerScope: true }, orderBy: { name: "asc" } });
  const clientSAA = await prisma.clientSAA.findUnique({ where: { clientId }, include: { saa: { include: { allocations: { include: { node: true } }, taxonomy: { include: { nodes: true } } } } } });
  const currentSaaId = clientSAA?.saaId ?? null;

  let driftResult = null;
  if (clientSAA?.saa) {
    const ctx = await buildTaxCtx(accounts, clientId);
    if (ctx) {
      const allocation = computeAllocation(ctx.holdingInputs, ctx.mappings);
      const cw: CurrentWeightInput[] = allocation.buckets.flatMap((b) => b.assetClasses.map((ac) => ({ nodeId: ac.nodeId, nodeName: ac.nodeName, nodeType: "ASSET_CLASS", riskBucketId: b.riskBucketId, riskBucketName: b.riskBucketName, weight: ac.pctOfTotal })));
      const tg: TargetInput[] = clientSAA.saa.allocations.map((a) => ({ nodeId: a.nodeId, targetWeight: a.targetWeight, minWeight: a.minWeight, maxWeight: a.maxWeight }));
      driftResult = computeDrift(cw, tg);
    }
  }

  // Expected outcomes
  const ExpectedOutcomes = await buildExpectedOutcomes(clientId, accounts);

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-medium text-zinc-700">Assigned Model</h3>
        <div className="mt-2"><SAASelector clientId={clientId} currentSaaId={currentSaaId} saas={saas} /></div>
      </div>
      {driftResult && (
        <div>
          <h3 className="text-sm font-medium text-zinc-700">Drift Analysis</h3>
          <DriftView drift={driftResult} />
        </div>
      )}
      {currentSaaId && !driftResult && <p className="text-sm text-zinc-400">Unable to compute drift. Check taxonomy mappings.</p>}
      {ExpectedOutcomes}
    </div>
  );
}

// Helper for expected outcomes
async function buildExpectedOutcomes(clientId: string, accounts: AccountHoldings[]) {
  const activeCmaSets = await prisma.cMASet.findMany({ where: { status: "ACTIVE" }, include: { assumptions: true, correlations: true }, orderBy: { name: "asc" } });
  if (activeCmaSets.length === 0) return null;

  const clientCMASelection = await prisma.clientCMASelection.findUnique({ where: { clientId } });
  const defaultCMA = activeCmaSets.find((s) => s.isDefault);
  const selectedCMA = clientCMASelection ? activeCmaSets.find((s) => s.id === clientCMASelection.cmaSetId) : null;
  const effectiveCMA = selectedCMA ?? defaultCMA;
  if (!effectiveCMA) return null;

  const cmaInputs: CMAInput[] = effectiveCMA.assumptions.map((a) => ({ nodeId: a.taxonomyNodeId, expReturnPct: a.expReturnPct, volPct: a.volPct, incomeYieldPct: a.incomeYieldPct }));
  const corrEntries: CorrelationEntry[] = effectiveCMA.correlations.map((c) => ({ nodeIdA: c.nodeIdA, nodeIdB: c.nodeIdB, corr: c.corr }));

  const ctx = await buildTaxCtx(accounts, clientId);
  if (!ctx) return null;
  const allocation = computeAllocation(ctx.holdingInputs, ctx.mappings);
  const currentWeights: WeightInput[] = allocation.buckets.flatMap((b) => b.assetClasses.map((ac) => ({ nodeId: ac.nodeId, nodeName: ac.nodeName, weight: ac.pctOfTotal })));

  const portfolioResult = computeExpectedOutcomes(currentWeights, cmaInputs, effectiveCMA.riskFreeRatePct, corrEntries);
  const portfolioHorizons = computeHorizonOutcomes(portfolioResult.expectedReturnPct, portfolioResult.expectedIncomePct);

  let saaResult = null; let saaHorizons = null; let saaName: string | null = null; let saaWeights: WeightInput[] = [];
  const clientSAA = await prisma.clientSAA.findUnique({ where: { clientId }, include: { saa: { include: { allocations: { include: { node: true } } } } } });
  if (clientSAA?.saa) { saaName = clientSAA.saa.name; saaWeights = clientSAA.saa.allocations.map((a) => ({ nodeId: a.nodeId, nodeName: a.node.name, weight: a.targetWeight })); saaResult = computeExpectedOutcomes(saaWeights, cmaInputs, effectiveCMA.riskFreeRatePct, corrEntries); saaHorizons = computeHorizonOutcomes(saaResult.expectedReturnPct, saaResult.expectedIncomePct); }

  let compareResult = null; let compareSaaResult = null;
  if (selectedCMA && defaultCMA && selectedCMA.id !== defaultCMA.id) {
    const di: CMAInput[] = defaultCMA.assumptions.map((a) => ({ nodeId: a.taxonomyNodeId, expReturnPct: a.expReturnPct, volPct: a.volPct, incomeYieldPct: a.incomeYieldPct }));
    const dc: CorrelationEntry[] = defaultCMA.correlations.map((c) => ({ nodeIdA: c.nodeIdA, nodeIdB: c.nodeIdB, corr: c.corr }));
    compareResult = computeExpectedOutcomes(currentWeights, di, defaultCMA.riskFreeRatePct, dc);
    if (saaWeights.length > 0) compareSaaResult = computeExpectedOutcomes(saaWeights, di, defaultCMA.riskFreeRatePct, dc);
  }

  return (
    <div className="mt-8">
      <h3 className="text-sm font-medium text-zinc-700">Expected Outcomes</h3>
      <ExpectedOutcomesView
        clientId={clientId} selectedCmaSetId={clientCMASelection?.cmaSetId ?? null}
        activeCmaSets={activeCmaSets.map((s) => ({ id: s.id, name: s.name, status: s.status, isDefault: s.isDefault }))}
        portfolioResult={portfolioResult} portfolioHorizons={portfolioHorizons}
        saaResult={saaResult} saaHorizons={saaHorizons} saaName={saaName}
        cmaSetName={effectiveCMA.name} compareResult={compareResult}
        compareCmaSetName={defaultCMA?.name ?? null} compareSaaResult={compareSaaResult}
      />
    </div>
  );
}

// ── 5. Rebalance Tab ─────────────────────────────────────

async function RebalanceTab({ clientId }: { clientId: string }) {
  const clientSAA = await prisma.clientSAA.findUnique({ where: { clientId }, select: { saaId: true, saa: { select: { name: true } } } });
  const plans = await prisma.rebalancePlan.findMany({ where: { clientId }, include: { trades: { include: { product: { select: { name: true } } } }, events: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" }, take: 10 });
  const planIds = plans.map((p) => p.id);
  const allOrders = planIds.length > 0 ? await prisma.order.findMany({ where: { sourceId: { in: planIds } }, include: { product: { select: { name: true } }, events: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { createdAt: "asc" } }) : [];
  const ordersByPlanId = new Map<string, typeof allOrders>(); for (const o of allOrders) { const l = ordersByPlanId.get(o.sourceId) ?? []; l.push(o); ordersByPlanId.set(o.sourceId, l); }
  const plansUI = plans.map((p) => { let summary; try { summary = JSON.parse(p.summaryJson); } catch { summary = { totalPortfolioValue: 0, breachesBefore: 0, breachesAfter: 0, beforeDrift: [], afterDrift: [] }; } return { id: p.id, clientId, status: p.status as string, summary, createdAt: p.createdAt.toISOString(), trades: p.trades.map((t) => ({ id: t.id, productId: t.productId, productName: t.product.name, side: t.side as string, amount: t.amount, reason: t.reason })), events: p.events.map((e) => ({ id: e.id, action: e.action as string, actorRole: e.actorRole, note: e.note, createdAt: e.createdAt.toISOString() })), orders: (ordersByPlanId.get(p.id) ?? []).map((o) => ({ id: o.id, productName: o.product.name, side: o.side as string, amount: o.amount, status: o.status as string, lastEvent: o.events[0]?.note ?? null })) }; });

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        <Link href="/adviser/rebalance/new" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">Create Rebalance via Wizard</Link>
        {clientSAA && <RebalanceGenerateButton clientId={clientId} />}
      </div>
      {!clientSAA && <p className="text-sm text-zinc-400">Assign an SAA in the SAA tab before rebalancing.</p>}
      {clientSAA && <p className="text-xs text-zinc-500">SAA: {clientSAA.saa.name}</p>}
      {plansUI.length > 0 ? plansUI.map((plan) => <RebalancePlanCard key={plan.id} plan={plan} />) : <p className="text-sm text-zinc-400">No rebalance plans yet.</p>}
    </div>
  );
}

// ── 6. Projections Tab ───────────────────────────────────

async function ProjectionsTab({ clientId }: { clientId: string }) {
  // Liquidity stress — fetch data outside JSX construction
  let stressData: { scenarioName: string; horizons: { horizonDays: number; availableLiquidity: number; requiredLiquidity: number; coverageRatio: number; shortfall: number; status: string; details: { pmCallsWithinHorizon: number; bufferRequirement: number; extraDemandPct: number; extraDemandAmount: number; foreignCurrencyCalls: { currency: string; amount: number }[] } }[] } | null = null;
  try {
    const defaultScenario = await prisma.liquidityStressScenario.findFirst({ where: { isDefault: true }, select: { id: true, name: true } });
    if (defaultScenario) {
      const latestRun = await prisma.liquidityStressRun.findFirst({ where: { scenarioId: defaultScenario.id }, orderBy: { runAt: "desc" }, select: { results: { where: { clientId }, select: { horizonDays: true, availableLiquidity: true, requiredLiquidity: true, coverageRatio: true, shortfall: true, detailsJson: true }, orderBy: { horizonDays: "asc" } } } });
      if (latestRun && latestRun.results.length > 0) {
        const horizons = latestRun.results.map((r) => { let details = { pmCallsWithinHorizon: 0, bufferRequirement: 0, extraDemandPct: 0, extraDemandAmount: 0, foreignCurrencyCalls: [] as { currency: string; amount: number }[] }; try { details = { ...details, ...JSON.parse(r.detailsJson) }; } catch { /* empty */ } return { horizonDays: r.horizonDays, availableLiquidity: r.availableLiquidity, requiredLiquidity: r.requiredLiquidity, coverageRatio: r.coverageRatio, shortfall: r.shortfall, status: r.coverageRatio >= 1 ? "OK" : r.coverageRatio >= 0.8 ? "WARN" : "CRITICAL", details }; });
        stressData = { scenarioName: defaultScenario.name, horizons };
      }
    }
  } catch { /* table may not exist */ }

  // PM projections from sleeve
  const sleeve = await prisma.clientSleeve.findUnique({
    where: { clientId },
    include: { commitments: { include: { fund: { select: { name: true, truth: { include: { defaultTemplate: { select: { callCurvePctJson: true, distCurvePctJson: true, name: true } } } } } } } } },
  });

  const pmProjections: { fundName: string; calls: { month: string; amount: number }[]; distributions: { month: string; amount: number }[] }[] = [];
  if (sleeve) {
    for (const c of sleeve.commitments) {
      const tmpl = c.fund.truth?.defaultTemplate;
      if (tmpl) {
        const proj = computeProjections(tmpl.callCurvePctJson, tmpl.distCurvePctJson, c.commitmentAmount, tmpl.name, "default");
        if (proj.projectedCalls.length > 0 || proj.projectedDistributions.length > 0) pmProjections.push({ fundName: c.fund.name, calls: proj.projectedCalls, distributions: proj.projectedDistributions });
      }
    }
  }

  return (
    <div className="space-y-8">
      {pmProjections.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-zinc-700 mb-3">PM Projected Calls &amp; Distributions</h3>
          {pmProjections.map((p, i) => (
            <div key={i} className="mb-4 rounded-lg border border-zinc-200 p-4">
              <h4 className="text-sm font-medium text-zinc-900">{p.fundName}</h4>
              <div className="grid grid-cols-2 gap-4 mt-2 text-xs">
                <div>
                  <p className="text-zinc-500 font-medium">Projected Calls ({p.calls.length} months)</p>
                  {p.calls.slice(0, 6).map((c, j) => <p key={j} className="text-zinc-600">{c.month.slice(0, 7)}: {money(c.amount)}</p>)}
                  {p.calls.length > 6 && <p className="text-zinc-400">+{p.calls.length - 6} more...</p>}
                </div>
                <div>
                  <p className="text-zinc-500 font-medium">Projected Distributions ({p.distributions.length} months)</p>
                  {p.distributions.slice(0, 6).map((d, j) => <p key={j} className="text-zinc-600">{d.month.slice(0, 7)}: {money(d.amount)}</p>)}
                  {p.distributions.length > 6 && <p className="text-zinc-400">+{p.distributions.length - 6} more...</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {stressData && (
        <div>
          <h3 className="text-sm font-medium text-zinc-700 mb-3">Liquidity Stress</h3>
          <LiquidityStressView scenarioName={stressData.scenarioName} horizons={stressData.horizons} hasForeignCurrency={stressData.horizons.some((h) => h.details.foreignCurrencyCalls.length > 0)} />
        </div>
      )}

      {pmProjections.length === 0 && !stressData && (
        <p className="text-sm text-zinc-400">No projection or stress data available for this client.</p>
      )}
    </div>
  );
}
