"use client";

import { useSleeveWizard } from "../../wizard-context";
import { isCashProduct } from "@/lib/sleeve-liquid-bucket";

const fmt = (v: number) =>
  "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function Step6Page() {
  const { data } = useSleeveWizard();

  const totalLiquid = data.liquidPositions.reduce((s, p) => s + p.marketValue, 0);
  const totalCommitment = data.commitments.reduce((s, c) => s + c.commitmentAmount, 0);
  const bufferPct = parseFloat(data.bufferPctOfUnfunded) || 0;
  const requiredBuffer = data.bufferMethod === "VS_UNFUNDED_PCT"
    ? totalCommitment * (bufferPct / 100)
    : 0;
  const shortfall = Math.max(0, requiredBuffer - totalLiquid);

  const statusColor = shortfall === 0
    ? "text-emerald-600 bg-emerald-50 border-emerald-200"
    : shortfall < requiredBuffer * 0.25
      ? "text-amber-600 bg-amber-50 border-amber-200"
      : "text-red-600 bg-red-50 border-red-200";
  const statusLabel = shortfall === 0 ? "OK" : shortfall < requiredBuffer * 0.25 ? "WARN" : "CRITICAL";

  // Compute target display
  const targetDisplay = data.targetMode === "PCT_PORTFOLIO"
    ? `${data.targetPct}% of portfolio`
    : `${fmt(parseFloat(data.targetAmount) || 0)}`;
  const computedTargetDollars = data.targetMode === "PCT_PORTFOLIO" && data.portfolioValue > 0
    ? fmt(data.portfolioValue * ((parseFloat(data.targetPct) || 0) / 100))
    : null;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Client" value={data.clientName || "—"} />
        <SummaryCard label="Sleeve Name" value={data.sleeveName || "—"} />
        <SummaryCard
          label="Target"
          value={targetDisplay}
          sub={computedTargetDollars ? `= ${computedTargetDollars}` : undefined}
        />
        <SummaryCard
          label="Cash Buffer"
          value={data.bufferEnabled ? `${data.cashBufferPct}% (${data.bufferBasis.replace(/_/g, " ").toLowerCase()})` : "Disabled"}
        />
      </div>

      {/* Target mode */}
      <Section title="Target Configuration">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-zinc-500">Mode</p>
            <p className="font-medium text-zinc-900">
              {data.targetMode === "PCT_PORTFOLIO" ? "% of Portfolio" : "$ Amount"}
            </p>
          </div>
          <div>
            <p className="text-zinc-500">Value</p>
            <p className="font-medium text-zinc-900">{targetDisplay}</p>
          </div>
        </div>
      </Section>

      {/* Liquid bucket */}
      <Section title="Liquid Bucket" count={data.liquidPositions.length}>
        <div className="mb-2 text-xs text-zinc-500">
          Mode: {data.liquidBucketMode === "MIRROR" ? "Mirror Portfolio" : "Custom"}
          {data.alignToRebalance && " | Aligned to rebalance"}
        </div>
        <div className="divide-y divide-zinc-100">
          {data.liquidPositions.map((p, i) => (
            <div key={i} className="flex justify-between py-2 px-1">
              <span className="text-sm text-zinc-700">
                {p.productName}
                {isCashProduct(p.productId) && <span className="ml-1 text-xs text-blue-500">(cash)</span>}
              </span>
              <span className="text-sm text-zinc-500">
                {p.weightPct.toFixed(1)}%
                {p.marketValue > 0 && <span className="ml-2 font-medium text-zinc-900">{fmt(p.marketValue)}</span>}
              </span>
            </div>
          ))}
          <div className="flex justify-between py-2 px-1 font-medium">
            <span className="text-sm text-zinc-900">Total</span>
            <span className="text-sm text-zinc-900">
              {data.liquidPositions.reduce((s, p) => s + p.weightPct, 0).toFixed(1)}%
              {totalLiquid > 0 && <span className="ml-2">{fmt(totalLiquid)}</span>}
            </span>
          </div>
        </div>
      </Section>

      {/* Commitments */}
      <Section title="Fund Commitments" count={data.commitmentsSkipped ? undefined : data.commitments.length}>
        {data.commitmentsSkipped ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
            <p className="text-xs text-amber-700">Skipped — commitments can be added later from the client page.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {data.commitments.map((c, i) => (
              <div key={i} className="flex justify-between py-2 px-1">
                <span className="text-sm text-zinc-700">{c.fundName} <span className="text-zinc-400">({c.currency})</span></span>
                <span className="text-sm font-medium text-zinc-900">{fmt(c.commitmentAmount)}</span>
              </div>
            ))}
            {data.commitments.length > 0 && (
              <div className="flex justify-between py-2 px-1 font-medium">
                <span className="text-sm text-zinc-900">Total Unfunded</span>
                <span className="text-sm text-zinc-900">{fmt(totalCommitment)}</span>
              </div>
            )}
            {data.commitments.length === 0 && (
              <p className="text-xs text-zinc-400 py-1">No commitments added.</p>
            )}
          </div>
        )}
      </Section>

      {/* Buffer / Warning */}
      <Section title="Warning Threshold">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-zinc-500">Method</p>
            <p className="font-medium text-zinc-900">
              {data.bufferMethod === "VS_UNFUNDED_PCT" ? "% of Unfunded" : "Projected Calls"}
            </p>
          </div>
          <div>
            <p className="text-zinc-500">
              {data.bufferMethod === "VS_UNFUNDED_PCT" ? "Threshold %" : "Months Forward"}
            </p>
            <p className="font-medium text-zinc-900">
              {data.bufferMethod === "VS_UNFUNDED_PCT"
                ? `${data.bufferPctOfUnfunded}%`
                : `${data.bufferMonthsForward} months`}
            </p>
          </div>
          <div>
            <p className="text-zinc-500">Buffer Enabled</p>
            <p className="font-medium text-zinc-900">{data.bufferEnabled ? "Yes" : "No"}</p>
          </div>
          <div>
            <p className="text-zinc-500">Buffer Basis</p>
            <p className="font-medium text-zinc-900">{data.bufferBasis.replace(/_/g, " ").toLowerCase()}</p>
          </div>
        </div>
        {data.bufferMethod === "VS_UNFUNDED_PCT" && totalCommitment > 0 && (
          <div className={`mt-3 rounded-lg border p-3 ${statusColor}`}>
            <p className="text-sm font-medium">
              Status: {statusLabel}
              {shortfall > 0 && ` — shortfall ${fmt(shortfall)}`}
            </p>
            <p className="text-xs mt-0.5">
              Threshold: {fmt(requiredBuffer)} | Available: {fmt(totalLiquid)}
            </p>
          </div>
        )}
      </Section>

      {/* Waterfalls */}
      <Section title="Waterfalls">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-zinc-500 mb-1">Sell ({data.sellWaterfall.length} entries)</p>
            {data.sellWaterfall.map((e, i) => (
              <p key={i} className={`text-zinc-700 ${e.excluded ? "line-through opacity-50" : ""}`}>
                {i + 1}. {e.productName} — {Math.round(e.maxPct * 100)}%
                {e.excluded && <span className="ml-1 text-xs text-red-500">(excluded)</span>}
              </p>
            ))}
            {data.sellWaterfall.length === 0 && <p className="text-zinc-400">None configured</p>}
          </div>
          <div>
            <p className="text-zinc-500 mb-1">Buy ({data.buyWaterfall.length} entries)</p>
            {data.buyWaterfall.map((e, i) => (
              <p key={i} className={`text-zinc-700 ${e.excluded ? "line-through opacity-50" : ""}`}>
                {i + 1}. {e.productName} — {Math.round(e.maxPct * 100)}%
                {e.excluded && <span className="ml-1 text-xs text-red-500">(excluded)</span>}
              </p>
            ))}
            {data.buyWaterfall.length === 0 && <p className="text-zinc-400">None configured</p>}
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Min trade amount: {fmt(parseFloat(data.minTradeAmount) || 0)}
        </p>
      </Section>

      <p className="text-xs text-zinc-400">
        Click Confirm to finish. You can edit all settings from the client detail page.
      </p>
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass-card p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-zinc-900">{value}</p>
      {sub && <p className="text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <h3 className="text-sm font-medium text-zinc-900">
        {title}{count !== undefined && <span className="ml-1 text-zinc-400">({count})</span>}
      </h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}
