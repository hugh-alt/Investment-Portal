"use client";

import { useState, useActionState } from "react";
import type { SleeveTotals, CurrencyTotals } from "@/lib/sleeve";
import type { LiquidityAssessment, BufferConfig } from "@/lib/liquidity";
import type { SellRecommendation, BuyRecommendation, SellWaterfallEntry, BuyWaterfallEntry } from "@/lib/waterfall";
import {
  createSleeveAction,
  addCommitmentAction,
  addLiquidPositionAction,
  updateBufferConfigAction,
  updateWaterfallConfigAction,
  approveRecommendationAction,
  createOrdersAction,
  simulateSubmitAction,
  simulateFillsAction,
  setCommitmentScenarioAction,
  type SleeveFormState,
} from "./sleeve-actions";
import { statusLabel, nextStepLabel } from "@/lib/approval";
import { EXECUTION_STATUS_LABELS, type ExecutionStatus } from "@/lib/execution";
import { formatDate, formatDateTime } from "@/lib/format";

const fmt = (v: number) =>
  "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const pct = (v: number) => (v * 100).toFixed(1) + "%";

const ratio = (v: number | null) => (v === null ? "—" : v.toFixed(2) + "x");

type CommitmentDetail = {
  fundId: string;
  fundName: string;
  currency: string;
  commitmentAmount: number;
  fundedAmount: number;
  navAmount: number;
  distributionsAmount: number;
  latestNavDate: string | null;
  metrics: { unfunded: number; pctCalled: number; dpi: number | null; rvpi: number | null; tvpi: number | null };
  projectedCalls: { month: string; amount: number }[];
  projectedDistributions: { month: string; amount: number }[];
  commitmentId?: string;
  eventCount?: number;
  navPointCount?: number;
  snapshotSource?: string;
  templateName?: string;
  templateSource?: string;
  scenarioTemplateId?: string | null;
};

// ── Create Sleeve Form ──────────────────────────────────

export function CreateSleeveForm({ clientId }: { clientId: string }) {
  const [state, action, pending] = useActionState<SleeveFormState, FormData>(
    createSleeveAction,
    {},
  );

  return (
    <div className="mt-4 rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
      <p className="text-sm text-zinc-500">No private markets sleeve yet.</p>
      <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
        <input type="hidden" name="clientId" value={clientId} />
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Name</label>
          <input
            name="name"
            required
            defaultValue="Private Markets Allocation"
            className="mt-1 w-48 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Target %</label>
          <input
            name="targetPct"
            type="number"
            step="0.1"
            defaultValue="15"
            className="mt-1 w-20 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Cash Buffer %</label>
          <input
            name="cashBufferPct"
            type="number"
            step="0.1"
            defaultValue="5"
            className="mt-1 w-20 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Creating..." : "Create Sleeve"}
        </button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      </form>
    </div>
  );
}

// ── Sleeve Summary ──────────────────────────────────────

type AlertInfo = {
  id: string;
  severity: string;
  message: string;
  createdAt: string;
};

type RecommendationEvent = {
  id: string;
  action: string;
  actorUserId: string;
  actorRole: string;
  note: string | null;
  createdAt: string;
};

type RecommendationLeg = {
  id: string;
  action: string;
  productId: string;
  productName: string;
  amount: number;
  reason: string;
};

type OrderInfo = {
  id: string;
  productName: string;
  side: string;
  amount: number;
  status: string;
  updatedAt: string;
  lastEvent: string | null;
};

type PersistedRecommendation = {
  id: string;
  kind: string;
  summary: string;
  status: string;
  createdAt: string;
  adviserApprovedAt: string | null;
  clientApprovedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  legs: RecommendationLeg[];
  events: RecommendationEvent[];
  orders: OrderInfo[];
};

export function SleeveSummary({
  sleeveName,
  targetPct,
  cashBufferPct,
  totals,
  commitmentDetails,
  liquidPositions,
  clientId,
  sleeveId,
  approvedFunds,
  products,
  bufferConfig,
  liquidityAssessment,
  activeAlerts,
  sellRecommendation,
  buyRecommendation,
  sellWaterfall,
  buyWaterfall,
  minTradeAmount,
  recommendations,
  projectionTemplates,
}: {
  sleeveName: string;
  targetPct: number | null;
  cashBufferPct: number;
  totals: SleeveTotals;
  commitmentDetails: CommitmentDetail[];
  liquidPositions: { productId: string; productName: string; marketValue: number }[];
  clientId: string;
  sleeveId: string;
  approvedFunds: { id: string; name: string; currency: string }[];
  products: { id: string; name: string; type: string }[];
  bufferConfig: BufferConfig;
  liquidityAssessment: LiquidityAssessment;
  activeAlerts: AlertInfo[];
  sellRecommendation: SellRecommendation | null;
  buyRecommendation: BuyRecommendation | null;
  sellWaterfall: SellWaterfallEntry[];
  buyWaterfall: BuyWaterfallEntry[];
  minTradeAmount: number;
  recommendations: PersistedRecommendation[];
  projectionTemplates?: { id: string; name: string }[];
}) {
  const [expandedFund, setExpandedFund] = useState<string | null>(null);

  return (
    <div className="mt-4 space-y-4">
      {/* Multi-currency warning */}
      {totals.multiCurrency && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          Multiple currencies — totals shown per currency
        </p>
      )}

      {/* Per-currency PM totals */}
      {totals.byCurrency.map((ct) => (
        <CurrencySection key={ct.currency} ct={ct} />
      ))}

      {/* Liquid bucket */}
      <div>
        <SummaryCard label="Liquid Bucket (Portfolio currency)" value={fmt(totals.liquidBucketValue)} />
      </div>

      <div className="flex gap-4 text-xs text-zinc-500">
        {targetPct !== null && <span>Target: {pct(targetPct)}</span>}
        <span>Cash Buffer: {pct(cashBufferPct)}</span>
      </div>

      {/* Commitments — Today Snapshot */}
      {commitmentDetails.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Commitments — Today Snapshot</h4>
          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
                  <th className="px-3 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400">Fund</th>
                  <th className="px-3 py-2 text-center font-medium text-zinc-600 dark:text-zinc-400">Ccy</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">Commitment</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">Paid-in</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">Unfunded</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">NAV</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">Dist.</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">% Called</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">DPI</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">TVPI</th>
                  <th className="px-3 py-2 text-center font-medium text-zinc-600 dark:text-zinc-400"></th>
                </tr>
              </thead>
              <tbody>
                {commitmentDetails.map((c) => (
                  <CommitmentRow
                    key={c.fundId}
                    detail={c}
                    isExpanded={expandedFund === c.fundId}
                    onToggle={() => setExpandedFund(expandedFund === c.fundId ? null : c.fundId)}
                    clientId={clientId}
                    templates={projectionTemplates}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Liquid positions */}
      {liquidPositions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Liquid Bucket (Portfolio currency)</h4>
          <div className="mt-2 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
                  <th className="px-4 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400">Product</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">Market Value</th>
                </tr>
              </thead>
              <tbody>
                {liquidPositions.map((p, i) => (
                  <tr key={i} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                    <td className="px-4 py-2 text-zinc-900 dark:text-zinc-100">{p.productName}</td>
                    <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400">{fmt(p.marketValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Liquidity Health */}
      <LiquidityHealthCard
        assessment={liquidityAssessment}
        bufferConfig={bufferConfig}
        activeAlerts={activeAlerts}
        clientId={clientId}
        sleeveId={sleeveId}
      />

      {/* Recommended Actions with Approval Workflow */}
      {recommendations.length > 0 && (
        <RecommendedActionsPanel
          recommendations={recommendations}
          clientId={clientId}
        />
      )}

      {/* Waterfall Config */}
      <WaterfallConfigPanel
        clientId={clientId}
        sleeveId={sleeveId}
        sellWaterfall={sellWaterfall}
        buyWaterfall={buyWaterfall}
        minTradeAmount={minTradeAmount}
        products={products}
      />

      {/* Add forms */}
      <div className="grid gap-4 sm:grid-cols-2">
        <AddCommitmentForm
          clientId={clientId}
          sleeveId={sleeveId}
          approvedFunds={approvedFunds}
        />
        <AddLiquidForm
          clientId={clientId}
          sleeveId={sleeveId}
          products={products}
        />
      </div>
    </div>
  );
}

// ── Commitment Row with expandable projections ──────────

function CommitmentRow({
  detail,
  isExpanded,
  onToggle,
  clientId,
  templates,
}: {
  detail: CommitmentDetail;
  isExpanded: boolean;
  onToggle: () => void;
  clientId: string;
  templates?: { id: string; name: string }[];
}) {
  const { metrics } = detail;
  const hasProjections = detail.projectedCalls.length > 0 || detail.projectedDistributions.length > 0;
  const hasEvents = (detail.eventCount ?? 0) > 0 || (detail.navPointCount ?? 0) > 0;

  return (
    <>
      <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
        <td className="px-3 py-2">
          <div className="text-zinc-900 dark:text-zinc-100">{detail.fundName}</div>
          <div className="flex items-center gap-2">
            {detail.latestNavDate && (
              <span className="text-[10px] text-zinc-400">NAV as at {detail.latestNavDate}</span>
            )}
            {detail.snapshotSource === "events" && (
              <span className="rounded bg-blue-50 px-1 py-0.5 text-[10px] text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">from events</span>
            )}
            {detail.templateName && (
              <span className="rounded bg-purple-50 px-1 py-0.5 text-[10px] text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                {detail.templateName}{detail.templateSource === "scenario_override" ? " (override)" : ""}
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-2 text-center">
          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {detail.currency}
          </span>
        </td>
        <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">{fmt(detail.commitmentAmount)}</td>
        <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">{fmt(detail.fundedAmount)}</td>
        <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">{fmt(metrics.unfunded)}</td>
        <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">{fmt(detail.navAmount)}</td>
        <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">{fmt(detail.distributionsAmount)}</td>
        <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">{pct(metrics.pctCalled)}</td>
        <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">{ratio(metrics.dpi)}</td>
        <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">{ratio(metrics.tvpi)}</td>
        <td className="px-3 py-2 text-center">
          <button
            onClick={onToggle}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            {isExpanded ? "Hide" : (hasProjections || hasEvents) ? "Detail" : ""}
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={11} className="bg-zinc-50 px-3 py-3 dark:bg-zinc-900/50">
            <div className="space-y-3">
              {/* Scenario Selector */}
              {detail.commitmentId && templates && templates.length > 0 && (
                <ScenarioSelector
                  clientId={clientId}
                  commitmentId={detail.commitmentId}
                  currentTemplateId={detail.scenarioTemplateId ?? undefined}
                  templates={templates}
                />
              )}
              {/* Event Info */}
              {hasEvents && (
                <div className="text-xs text-zinc-500">
                  Data source: {detail.eventCount} cashflow event{detail.eventCount === 1 ? "" : "s"}, {detail.navPointCount} NAV point{detail.navPointCount === 1 ? "" : "s"}
                </div>
              )}
              {/* Projections */}
              {hasProjections && <ProjectionsPanel detail={detail} />}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Projections Panel ───────────────────────────────────

function ProjectionsPanel({ detail }: { detail: CommitmentDetail }) {
  const maxLen = Math.max(detail.projectedCalls.length, detail.projectedDistributions.length);
  if (maxLen === 0) return null;

  // Only show months with non-zero activity (or all if all zero)
  const rows = Array.from({ length: maxLen }, (_, i) => ({
    month: detail.projectedCalls[i]?.month ?? detail.projectedDistributions[i]?.month ?? "",
    call: detail.projectedCalls[i]?.amount ?? 0,
    dist: detail.projectedDistributions[i]?.amount ?? 0,
  }));

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-zinc-500">
        Forward Projections ({detail.currency}) — scaled to {fmt(detail.commitmentAmount)} commitment
      </p>
      <div className="overflow-hidden rounded border border-zinc-200 dark:border-zinc-700">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
              <th className="px-2 py-1.5 text-left font-medium text-zinc-500">Month</th>
              <th className="px-2 py-1.5 text-right font-medium text-zinc-500">Proj. Call ({detail.currency})</th>
              <th className="px-2 py-1.5 text-right font-medium text-zinc-500">Proj. Dist ({detail.currency})</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                <td className="px-2 py-1 text-zinc-500">{r.month}</td>
                <td className="px-2 py-1 text-right text-zinc-600 dark:text-zinc-400">
                  {r.call > 0 ? fmt(r.call) : "—"}
                </td>
                <td className="px-2 py-1 text-right text-zinc-600 dark:text-zinc-400">
                  {r.dist > 0 ? fmt(r.dist) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Scenario Selector ───────────────────────────────────

function ScenarioSelector({
  clientId,
  commitmentId,
  currentTemplateId,
  templates,
}: {
  clientId: string;
  commitmentId: string;
  currentTemplateId?: string;
  templates: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<SleeveFormState, FormData>(
    setCommitmentScenarioAction,
    {},
  );

  return (
    <div className="rounded border border-zinc-200 p-2 dark:border-zinc-700">
      <p className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Modelling scenario <span className="text-zinc-400">(does not change fund truth)</span>
      </p>
      <form action={action} className="flex items-center gap-2">
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="commitmentId" value={commitmentId} />
        <select
          name="templateId"
          defaultValue={currentTemplateId ?? ""}
          className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="" disabled>Select template...</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-zinc-900 px-2 py-1 text-xs text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "..." : "Apply"}
        </button>
        {state.error && <span className="text-xs text-red-600">{state.error}</span>}
        {state.success && <span className="text-xs text-green-600">Updated</span>}
      </form>
    </div>
  );
}

// ── Shared components ───────────────────────────────────

function CurrencySection({ ct }: { ct: CurrencyTotals }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-zinc-500">PM Totals — {ct.currency}</p>
      <div className="grid gap-3 sm:grid-cols-5">
        <SummaryCard label={`Commitment (${ct.currency})`} value={fmt(ct.totalCommitment)} small />
        <SummaryCard label={`Funded (${ct.currency})`} value={fmt(ct.totalFunded)} small />
        <SummaryCard label={`Unfunded (${ct.currency})`} value={fmt(ct.totalUnfunded)} small />
        <SummaryCard label={`NAV (${ct.currency})`} value={fmt(ct.totalNav)} small />
        <SummaryCard label={`Distributions (${ct.currency})`} value={fmt(ct.totalDistributions)} small />
      </div>
    </div>
  );
}

function SummaryCard({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`${small ? "text-base" : "text-lg"} font-semibold text-zinc-900 dark:text-zinc-100`}>
        {value}
      </p>
    </div>
  );
}

// ── Liquidity Health Card ────────────────────────────────

const severityStyles = {
  OK: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  WARN: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  CRITICAL: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

function LiquidityHealthCard({
  assessment,
  bufferConfig,
  activeAlerts,
  clientId,
  sleeveId,
}: {
  assessment: LiquidityAssessment;
  bufferConfig: BufferConfig;
  activeAlerts: AlertInfo[];
  clientId: string;
  sleeveId: string;
}) {
  const [showConfig, setShowConfig] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Liquidity Health</h4>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${severityStyles[assessment.severity]}`}>
          {assessment.severity}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div>
          <p className="text-xs text-zinc-500">Required ({assessment.portfolioCurrency})</p>
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{fmt(assessment.totalRequired)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Liquid Bucket</p>
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{fmt(assessment.liquidBucketValue)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Shortfall</p>
          <p className={`text-base font-semibold ${assessment.shortfall > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
            {assessment.shortfall > 0 ? fmt(assessment.shortfall) : "None"}
          </p>
        </div>
      </div>

      {/* Per-currency requirements */}
      {assessment.requirements.length > 1 && (
        <div className="mt-3">
          <p className="text-xs text-zinc-500">Required by currency:</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {assessment.requirements.map((r) => (
              <span key={r.currency} className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {r.currency}: {fmt(r.requiredLiquidity)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Non-covered currency warning */}
      {assessment.nonCoveredCurrencies.length > 0 && (
        <p className="mt-2 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          No liquid coverage for {assessment.nonCoveredCurrencies.join(", ")} commitments — liquid bucket is {assessment.portfolioCurrency} only
        </p>
      )}

      {/* Active alerts */}
      {activeAlerts.length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="text-xs font-medium text-zinc-500">Active Alerts</p>
          {activeAlerts.map((a) => (
            <div key={a.id} className={`rounded px-2 py-1.5 text-xs ${severityStyles[a.severity as keyof typeof severityStyles] ?? "bg-zinc-100 text-zinc-600"}`}>
              {a.message}
            </div>
          ))}
        </div>
      )}

      {/* Buffer config toggle */}
      <div className="mt-3 flex items-center gap-2">
        <p className="text-xs text-zinc-400">
          Method: {bufferConfig.bufferMethod === "VS_UNFUNDED_PCT"
            ? `${(bufferConfig.bufferPctOfUnfunded * 100).toFixed(0)}% of unfunded`
            : `${bufferConfig.bufferMonthsForward}mo projected calls`}
        </p>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          {showConfig ? "Hide" : "Configure"}
        </button>
      </div>

      {showConfig && (
        <BufferConfigForm
          clientId={clientId}
          sleeveId={sleeveId}
          bufferConfig={bufferConfig}
        />
      )}
    </div>
  );
}

function BufferConfigForm({
  clientId,
  sleeveId,
  bufferConfig,
}: {
  clientId: string;
  sleeveId: string;
  bufferConfig: BufferConfig;
}) {
  const [state, action, pending] = useActionState<SleeveFormState, FormData>(
    updateBufferConfigAction,
    {},
  );

  return (
    <form action={action} className="mt-2 rounded border border-zinc-200 p-3 dark:border-zinc-700">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="sleeveId" value={sleeveId} />
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Method</label>
          <select
            name="bufferMethod"
            defaultValue={bufferConfig.bufferMethod}
            className="mt-1 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="VS_UNFUNDED_PCT">% of Unfunded</option>
            <option value="VS_PROJECTED_CALLS">Projected Calls</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Buffer %</label>
          <input
            name="bufferPctOfUnfunded"
            type="number"
            step="1"
            min="0"
            max="100"
            defaultValue={(bufferConfig.bufferPctOfUnfunded * 100).toFixed(0)}
            className="mt-1 w-20 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Months Forward</label>
          <input
            name="bufferMonthsForward"
            type="number"
            step="1"
            min="1"
            max="36"
            defaultValue={bufferConfig.bufferMonthsForward}
            className="mt-1 w-20 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="checkbox"
            name="alertEnabled"
            defaultChecked
            className="rounded border-zinc-300"
          />
          <label className="text-xs text-zinc-600 dark:text-zinc-400">Alerts</label>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Saving..." : "Save"}
        </button>
      </div>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
      {state.success && <p className="mt-1 text-xs text-green-600">Saved.</p>}
    </form>
  );
}

// ── Recommended Actions Panel ────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  ADVISER_APPROVED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  CLIENT_APPROVED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

function RecommendedActionsPanel({
  recommendations,
  clientId,
}: {
  recommendations: PersistedRecommendation[];
  clientId: string;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Recommendations</h4>
      {recommendations.map((rec) => (
        <RecommendationCard key={rec.id} rec={rec} clientId={clientId} />
      ))}
    </div>
  );
}

const ORDER_STATUS_COLORS: Record<string, string> = {
  CREATED: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  SUBMITTED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  PARTIALLY_FILLED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  FILLED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  CANCELLED: "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400",
};

function RecommendationCard({
  rec,
  clientId,
}: {
  rec: PersistedRecommendation;
  clientId: string;
}) {
  const [showTimeline, setShowTimeline] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [approveState, approveAction, approvePending] = useActionState<SleeveFormState, FormData>(
    approveRecommendationAction,
    {},
  );
  const [orderState, orderAction, orderPending] = useActionState<SleeveFormState, FormData>(
    createOrdersAction,
    {},
  );
  const [submitState, submitAction, submitPending] = useActionState<SleeveFormState, FormData>(
    simulateSubmitAction,
    {},
  );
  const [fillState, fillAction, fillPending] = useActionState<SleeveFormState, FormData>(
    simulateFillsAction,
    {},
  );

  const kindBadge = rec.kind === "RAISE_LIQUIDITY"
    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";

  const statusColor = STATUS_COLORS[rec.status] ?? "bg-zinc-100 text-zinc-600";
  const step = nextStepLabel(rec.status as "DRAFT" | "ADVISER_APPROVED" | "CLIENT_APPROVED" | "REJECTED");

  const hasOrders = rec.orders.length > 0;
  const hasCreated = rec.orders.some((o) => o.status === "CREATED");
  const hasSubmitted = rec.orders.some((o) => o.status === "SUBMITTED" || o.status === "PARTIALLY_FILLED");

  function exportCSV() {
    const header = "id,product,side,amount,status";
    const rows = rec.orders.map((o) =>
      `${o.id},"${o.productName}",${o.side},${o.amount},${o.status}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${rec.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      {/* Header: kind + status + date */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${kindBadge}`}>
          {rec.kind === "RAISE_LIQUIDITY" ? "RAISE LIQUIDITY" : "INVEST EXCESS"}
        </span>
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${statusColor}`}>
          {statusLabel(rec.status as "DRAFT" | "ADVISER_APPROVED" | "CLIENT_APPROVED" | "REJECTED")}
        </span>
        <span className="text-xs text-zinc-400">{formatDate(rec.createdAt)}</span>
        {step && <span className="text-xs text-zinc-500 italic">{step}</span>}
      </div>

      {/* Summary */}
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{rec.summary}</p>

      {/* Rejection reason */}
      {rec.status === "REJECTED" && rec.rejectionReason && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">Reason: {rec.rejectionReason}</p>
      )}

      {/* Legs table */}
      {rec.legs.length > 0 && !hasOrders && (
        <div className="mt-2 overflow-hidden rounded border border-zinc-200 dark:border-zinc-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
                <th className="px-3 py-1.5 text-left text-xs font-medium text-zinc-500">Action</th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-zinc-500">Product</th>
                <th className="px-3 py-1.5 text-right text-xs font-medium text-zinc-500">Amount</th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-zinc-500">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rec.legs.map((leg) => (
                <tr key={leg.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                  <td className="px-3 py-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${leg.action === "SELL" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"}`}>
                      {leg.action}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-zinc-900 dark:text-zinc-100">{leg.productName}</td>
                  <td className="px-3 py-1.5 text-right text-zinc-600 dark:text-zinc-400">{fmt(leg.amount)}</td>
                  <td className="px-3 py-1.5 text-xs text-zinc-500">{leg.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Order Blotter */}
      {hasOrders && (
        <div className="mt-2">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Order Blotter</h5>
            <button
              type="button"
              onClick={exportCSV}
              className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Export CSV
            </button>
          </div>
          <div className="mt-1 overflow-hidden rounded border border-zinc-200 dark:border-zinc-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
                  <th className="px-3 py-1.5 text-left text-xs font-medium text-zinc-500">Side</th>
                  <th className="px-3 py-1.5 text-left text-xs font-medium text-zinc-500">Product</th>
                  <th className="px-3 py-1.5 text-right text-xs font-medium text-zinc-500">Amount</th>
                  <th className="px-3 py-1.5 text-left text-xs font-medium text-zinc-500">Status</th>
                  <th className="px-3 py-1.5 text-left text-xs font-medium text-zinc-500">Last Update</th>
                </tr>
              </thead>
              <tbody>
                {rec.orders.map((order) => (
                  <tr key={order.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                    <td className="px-3 py-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${order.side === "SELL" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"}`}>
                        {order.side}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-zinc-900 dark:text-zinc-100">{order.productName}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-600 dark:text-zinc-400">{fmt(order.amount)}</td>
                    <td className="px-3 py-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ORDER_STATUS_COLORS[order.status] ?? ""}`}>
                        {EXECUTION_STATUS_LABELS[order.status as ExecutionStatus] ?? order.status}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-xs text-zinc-500">
                      {order.lastEvent ?? formatDateTime(order.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approval action buttons */}
      {(rec.status === "DRAFT" || rec.status === "ADVISER_APPROVED") && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <form action={approveAction}>
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="recommendationId" value={rec.id} />
            <input type="hidden" name="action" value="APPROVE" />
            <button
              type="submit"
              disabled={approvePending}
              className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500 disabled:opacity-50"
            >
              {approvePending ? "..." : rec.status === "DRAFT" ? "Adviser Approve" : "Client Approve"}
            </button>
          </form>

          {!showRejectForm ? (
            <button
              type="button"
              onClick={() => setShowRejectForm(true)}
              className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500"
            >
              Reject
            </button>
          ) : (
            <form action={approveAction} className="flex items-center gap-1.5">
              <input type="hidden" name="clientId" value={clientId} />
              <input type="hidden" name="recommendationId" value={rec.id} />
              <input type="hidden" name="action" value="REJECT" />
              <input
                name="note"
                type="text"
                placeholder="Reason (optional)"
                className="w-40 rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <button
                type="submit"
                disabled={approvePending}
                className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                Confirm Reject
              </button>
              <button type="button" onClick={() => setShowRejectForm(false)} className="text-xs text-zinc-400">Cancel</button>
            </form>
          )}

          {approveState.error && <span className="text-xs text-red-600">{approveState.error}</span>}
        </div>
      )}

      {/* Execution action buttons */}
      {rec.status === "CLIENT_APPROVED" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!hasOrders && (
            <form action={orderAction}>
              <input type="hidden" name="clientId" value={clientId} />
              <input type="hidden" name="recommendationId" value={rec.id} />
              <button
                type="submit"
                disabled={orderPending}
                className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {orderPending ? "Creating..." : "Create Orders"}
              </button>
            </form>
          )}

          {hasCreated && (
            <form action={submitAction}>
              <input type="hidden" name="clientId" value={clientId} />
              <input type="hidden" name="recommendationId" value={rec.id} />
              <button
                type="submit"
                disabled={submitPending}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {submitPending ? "Submitting..." : "Simulate Submit"}
              </button>
            </form>
          )}

          {hasSubmitted && (
            <form action={fillAction}>
              <input type="hidden" name="clientId" value={clientId} />
              <input type="hidden" name="recommendationId" value={rec.id} />
              <button
                type="submit"
                disabled={fillPending}
                className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {fillPending ? "Filling..." : "Simulate Fills"}
              </button>
            </form>
          )}

          {orderState.error && <span className="text-xs text-red-600">{orderState.error}</span>}
          {submitState.error && <span className="text-xs text-red-600">{submitState.error}</span>}
          {fillState.error && <span className="text-xs text-red-600">{fillState.error}</span>}
        </div>
      )}

      {/* Timeline toggle */}
      {rec.events.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowTimeline(!showTimeline)}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            {showTimeline ? "Hide" : "Show"} history ({rec.events.length})
          </button>
          {showTimeline && (
            <div className="mt-1 space-y-1">
              {rec.events.map((e) => (
                <div key={e.id} className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className={`rounded px-1.5 py-0.5 font-medium ${e.action === "APPROVE" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"}`}>
                    {e.action}
                  </span>
                  <span>{e.actorRole}</span>
                  <span className="text-zinc-400">{formatDateTime(e.createdAt)}</span>
                  {e.note && <span className="italic text-zinc-400">— {e.note}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Waterfall Config Panel ──────────────────────────────

type SellItem = { productId: string; maxSellPct: number };
type BuyItem = { productId: string; maxBuyPct: number };

function WaterfallConfigPanel({
  clientId,
  sleeveId,
  sellWaterfall,
  buyWaterfall,
  minTradeAmount,
  products,
}: {
  clientId: string;
  sleeveId: string;
  sellWaterfall: SellWaterfallEntry[];
  buyWaterfall: BuyWaterfallEntry[];
  minTradeAmount: number;
  products: { id: string; name: string; type: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [sellItems, setSellItems] = useState<SellItem[]>(
    sellWaterfall.map((e) => ({ productId: e.productId, maxSellPct: e.maxSellPct })),
  );
  const [buyItems, setBuyItems] = useState<BuyItem[]>(
    buyWaterfall.map((e) => ({ productId: e.productId, maxBuyPct: e.maxBuyPct })),
  );
  const [search, setSearch] = useState("");
  const [state, action, pending] = useActionState<SleeveFormState, FormData>(
    updateWaterfallConfigAction,
    {},
  );

  const productMap = new Map(products.map((p) => [p.id, p]));

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        Configure Waterfalls
      </button>
    );
  }

  const filteredProducts = search.length > 0
    ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : products;

  return (
    <form action={action} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="sleeveId" value={sleeveId} />
      <input type="hidden" name="sellWaterfallJson" value={JSON.stringify(sellItems)} />
      <input type="hidden" name="buyWaterfallJson" value={JSON.stringify(buyItems)} />

      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Waterfall Configuration</h4>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-zinc-500 hover:text-zinc-700">Close</button>
      </div>

      {/* Product search for adding */}
      <div className="mt-3">
        <input
          type="text"
          placeholder="Search products to add..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {/* Sell waterfall */}
        <div>
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Sell Waterfall (shortfall)</p>
          <div className="mt-1 space-y-1">
            {sellItems.map((item, i) => {
              const prod = productMap.get(item.productId);
              return (
                <div key={item.productId} className="flex items-center gap-1.5 rounded bg-zinc-50 px-2 py-1.5 dark:bg-zinc-800">
                  <span className="text-xs text-zinc-400">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate block">{prod?.name ?? item.productId}</span>
                    {prod && <span className="text-[10px] text-zinc-400">{prod.type}</span>}
                  </div>
                  <div className="flex items-center gap-0.5">
                    {item.maxSellPct === 0 ? (
                      <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">Do not sell</span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="5"
                        value={(item.maxSellPct * 100).toFixed(0)}
                        onChange={(e) => {
                          const next = [...sellItems];
                          next[i] = { ...next[i], maxSellPct: Math.min(1, Math.max(0, parseFloat(e.target.value) / 100)) };
                          setSellItems(next);
                        }}
                        className="w-14 rounded border border-zinc-300 bg-white px-1 py-0.5 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                      />
                    )}
                    <span className="text-[10px] text-zinc-400">%</span>
                  </div>
                  <button type="button" onClick={() => { const n = [...sellItems]; n[i] = { ...n[i], maxSellPct: item.maxSellPct === 0 ? 1.0 : 0 }; setSellItems(n); }} className="text-[10px] text-zinc-400 hover:text-zinc-600" title={item.maxSellPct === 0 ? "Allow selling" : "Set do-not-sell"}>
                    {item.maxSellPct === 0 ? "Allow" : "Block"}
                  </button>
                  <button type="button" onClick={() => { const n = [...sellItems]; if (i > 0) { [n[i-1], n[i]] = [n[i], n[i-1]]; } setSellItems(n); }} disabled={i === 0} className="text-xs text-zinc-400 hover:text-zinc-600">&#9650;</button>
                  <button type="button" onClick={() => { const n = [...sellItems]; if (i < n.length-1) { [n[i], n[i+1]] = [n[i+1], n[i]]; } setSellItems(n); }} disabled={i >= sellItems.length - 1} className="text-xs text-zinc-400 hover:text-zinc-600">&#9660;</button>
                  <button type="button" onClick={() => setSellItems(sellItems.filter((_, idx) => idx !== i))} className="text-xs text-red-400 hover:text-red-600">&#10005;</button>
                </div>
              );
            })}
          </div>
          <select
            onChange={(e) => {
              if (e.target.value && !sellItems.some((s) => s.productId === e.target.value)) {
                setSellItems([...sellItems, { productId: e.target.value, maxSellPct: 1.0 }]);
              }
              e.target.value = "";
            }}
            className="mt-1 rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            defaultValue=""
          >
            <option value="" disabled>+ Add product...</option>
            {filteredProducts.filter((p) => !sellItems.some((s) => s.productId === p.id)).map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
            ))}
          </select>
        </div>

        {/* Buy waterfall */}
        <div>
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Buy Waterfall (excess)</p>
          <div className="mt-1 space-y-1">
            {buyItems.map((item, i) => {
              const prod = productMap.get(item.productId);
              return (
                <div key={item.productId} className="flex items-center gap-1.5 rounded bg-zinc-50 px-2 py-1.5 dark:bg-zinc-800">
                  <span className="text-xs text-zinc-400">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate block">{prod?.name ?? item.productId}</span>
                    {prod && <span className="text-[10px] text-zinc-400">{prod.type}</span>}
                  </div>
                  <button type="button" onClick={() => { const n = [...buyItems]; if (i > 0) { [n[i-1], n[i]] = [n[i], n[i-1]]; } setBuyItems(n); }} disabled={i === 0} className="text-xs text-zinc-400 hover:text-zinc-600">&#9650;</button>
                  <button type="button" onClick={() => { const n = [...buyItems]; if (i < n.length-1) { [n[i], n[i+1]] = [n[i+1], n[i]]; } setBuyItems(n); }} disabled={i >= buyItems.length - 1} className="text-xs text-zinc-400 hover:text-zinc-600">&#9660;</button>
                  <button type="button" onClick={() => setBuyItems(buyItems.filter((_, idx) => idx !== i))} className="text-xs text-red-400 hover:text-red-600">&#10005;</button>
                </div>
              );
            })}
          </div>
          <select
            onChange={(e) => {
              if (e.target.value && !buyItems.some((b) => b.productId === e.target.value)) {
                setBuyItems([...buyItems, { productId: e.target.value, maxBuyPct: 1.0 }]);
              }
              e.target.value = "";
            }}
            className="mt-1 rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            defaultValue=""
          >
            <option value="" disabled>+ Add product...</option>
            {filteredProducts.filter((p) => !buyItems.some((b) => b.productId === p.id)).map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3">
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Min Trade Amount ($)</label>
        <input
          name="minTradeAmount"
          type="number"
          step="100"
          min="0"
          defaultValue={minTradeAmount}
          className="mt-1 w-32 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      {state.error && <p className="mt-2 text-xs text-red-600">{state.error}</p>}
      {state.success && <p className="mt-2 text-xs text-green-600">Saved.</p>}

      <div className="mt-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Saving..." : "Save Waterfall Config"}
        </button>
      </div>
    </form>
  );
}

// ── Add Commitment Form ─────────────────────────────────

function AddCommitmentForm({
  clientId,
  sleeveId,
  approvedFunds,
}: {
  clientId: string;
  sleeveId: string;
  approvedFunds: { id: string; name: string; currency: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<SleeveFormState, FormData>(
    addCommitmentAction,
    {},
  );

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        + Add Commitment
      </button>
    );
  }

  return (
    <form action={action} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="sleeveId" value={sleeveId} />
      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Add Commitment</p>
      <div className="mt-2 flex flex-col gap-2">
        <select
          name="fundId"
          required
          className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="">Select fund...</option>
          {approvedFunds.map((f) => (
            <option key={f.id} value={f.id}>{f.name} ({f.currency})</option>
          ))}
        </select>
        <input name="commitmentAmount" type="number" step="1000" required placeholder="Commitment $" className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
        <input name="fundedAmount" type="number" step="1000" placeholder="Paid-in $ (optional)" className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
        <input name="navAmount" type="number" step="1000" placeholder="NAV $ (optional)" className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
        <input name="distributionsAmount" type="number" step="1000" placeholder="Distributions $ (optional)" className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
      </div>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
      {state.success && <p className="mt-1 text-xs text-green-600">Added.</p>}
      <div className="mt-2 flex gap-2">
        <button type="submit" disabled={pending} className="rounded bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">
          {pending ? "Adding..." : "Add"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-zinc-500 hover:text-zinc-700">Cancel</button>
      </div>
    </form>
  );
}

// ── Add Liquid Position Form ────────────────────────────

function AddLiquidForm({
  clientId,
  sleeveId,
  products,
}: {
  clientId: string;
  sleeveId: string;
  products: { id: string; name: string; type: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [state, action, pending] = useActionState<SleeveFormState, FormData>(
    addLiquidPositionAction,
    {},
  );

  const filtered = search.length > 0
    ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : products;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        + Add Liquid Position
      </button>
    );
  }

  return (
    <form action={action} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="sleeveId" value={sleeveId} />
      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Add Liquid Position</p>
      <div className="mt-2 flex flex-col gap-2">
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <select
          name="productId"
          required
          size={Math.min(5, filtered.length + 1)}
          className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          {filtered.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input name="marketValue" type="number" step="1000" required placeholder="Market Value $" className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
      </div>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
      {state.success && <p className="mt-1 text-xs text-green-600">Added.</p>}
      <div className="mt-2 flex gap-2">
        <button type="submit" disabled={pending} className="rounded bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">
          {pending ? "Adding..." : "Add"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-zinc-500 hover:text-zinc-700">Cancel</button>
      </div>
    </form>
  );
}
