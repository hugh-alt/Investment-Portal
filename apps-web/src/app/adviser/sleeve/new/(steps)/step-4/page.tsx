"use client";

import { useState } from "react";
import { useSleeveWizard } from "../../wizard-context";
import { updateBufferAction } from "../../wizard-actions";

const fmt = (v: number) =>
  "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function Step4Page() {
  const { data, update } = useSleeveWizard();
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!data.sleeveId) {
    return <p className="text-sm text-zinc-500">Complete Step 1 first.</p>;
  }

  const totalUnfunded = data.commitments.reduce((s, c) => s + c.commitmentAmount, 0);
  const bufferPct = parseFloat(data.bufferPctOfUnfunded) || 0;
  const requiredLiquidity = data.bufferMethod === "VS_UNFUNDED_PCT"
    ? totalUnfunded * (bufferPct / 100)
    : 0;
  const totalLiquid = data.liquidPositions.reduce((s, p) => s + p.marketValue, 0);

  async function handleSave() {
    setSaving(true);
    setResult(null);
    const res = await updateBufferAction(
      data.sleeveId,
      data.clientId,
      data.bufferMethod,
      (parseFloat(data.bufferPctOfUnfunded) || 10) / 100,
      parseInt(data.bufferMonthsForward) || 6,
    );
    setSaving(false);
    setResult(res);
  }

  return (
    <div className="space-y-5">
      {/* Reframed header */}
      <div>
        <h3 className="text-sm font-medium text-zinc-900">When should we warn you?</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Set a warning threshold so you get alerted before liquidity runs low.
          This doesn&apos;t prevent trading — it raises an alert when the buffer drops below your threshold.
        </p>
      </div>

      {/* Buffer method */}
      <div>
        <label className="block text-sm font-medium text-zinc-700">Warning Basis</label>
        <div className="mt-2 flex gap-3">
          {(["VS_UNFUNDED_PCT", "VS_PROJECTED_CALLS"] as const).map((method) => (
            <label
              key={method}
              className={`flex-1 cursor-pointer rounded-lg border p-3 text-sm transition-colors ${
                data.bufferMethod === method
                  ? "border-amber-300 bg-amber-50 text-amber-700"
                  : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              <input
                type="radio"
                name="bufferMethod"
                value={method}
                checked={data.bufferMethod === method}
                onChange={() => update({ bufferMethod: method })}
                className="sr-only"
              />
              <span className="font-medium">
                {method === "VS_UNFUNDED_PCT" ? "% of Unfunded" : "Projected Calls"}
              </span>
              <p className="mt-1 text-xs text-zinc-500">
                {method === "VS_UNFUNDED_PCT"
                  ? "Warn when buffer falls below a % of total unfunded commitments."
                  : "Warn when buffer won't cover projected calls over a forward period."}
              </p>
            </label>
          ))}
        </div>
      </div>

      {data.bufferMethod === "VS_UNFUNDED_PCT" ? (
        <div>
          <label htmlFor="buffer-pct-unfunded" className="block text-sm font-medium text-zinc-700">
            Warning Threshold (% of Unfunded)
          </label>
          <p className="text-xs text-zinc-500 mb-1">Default: 10% of total unfunded commitments.</p>
          <div className="mt-1 flex items-center gap-2">
            <input
              id="buffer-pct-unfunded"
              type="number"
              min="0" max="100" step="1"
              value={data.bufferPctOfUnfunded}
              onChange={(e) => update({ bufferPctOfUnfunded: e.target.value })}
              className="w-24 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none"
            />
            <span className="text-sm text-zinc-500">%</span>
          </div>
        </div>
      ) : (
        <div>
          <label htmlFor="months-forward" className="block text-sm font-medium text-zinc-700">
            Months Forward
          </label>
          <p className="text-xs text-zinc-500 mb-1">Warn if projected calls in this window exceed available liquidity.</p>
          <div className="mt-1 flex items-center gap-2">
            <input
              id="months-forward"
              type="number"
              min="1" max="36" step="1"
              value={data.bufferMonthsForward}
              onChange={(e) => update({ bufferMonthsForward: e.target.value })}
              className="w-24 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none"
            />
            <span className="text-sm text-zinc-500">months</span>
          </div>
        </div>
      )}

      {/* Preview */}
      {data.bufferMethod === "VS_UNFUNDED_PCT" && totalUnfunded > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-sm font-medium text-zinc-700">Warning Preview</p>
          <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-zinc-500">Total Unfunded</p>
              <p className="font-medium text-zinc-900">{fmt(totalUnfunded)}</p>
            </div>
            <div>
              <p className="text-zinc-500">Warning Threshold</p>
              <p className="font-medium text-zinc-900">{fmt(requiredLiquidity)}</p>
            </div>
            <div>
              <p className="text-zinc-500">Liquid Bucket</p>
              <p className={`font-medium ${totalLiquid >= requiredLiquidity ? "text-emerald-600" : "text-red-600"}`}>
                {fmt(totalLiquid)}
              </p>
            </div>
          </div>
          <p className={`mt-2 text-xs font-medium ${
            totalLiquid >= requiredLiquidity ? "text-emerald-600" : "text-amber-600"
          }`}>
            {totalLiquid >= requiredLiquidity
              ? "OK — liquid bucket is above warning threshold."
              : `Would trigger a warning — ${fmt(requiredLiquidity - totalLiquid)} below threshold.`}
          </p>
        </div>
      )}

      {data.commitmentsSkipped && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-700">
            No commitments added — warning threshold will be recalculated when you add fund commitments.
          </p>
        </div>
      )}

      {/* Advanced: projected calls accordion */}
      <div className="border border-zinc-200 rounded-lg">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
        >
          <span>Advanced: Projected Calls</span>
          <span className="text-zinc-400">{showAdvanced ? "−" : "+"}</span>
        </button>
        {showAdvanced && (
          <div className="border-t border-zinc-200 px-4 py-3">
            <p className="text-xs text-zinc-500">
              Projected call amounts are derived from fund projection templates attached to each commitment.
              Add commitments in Step 3 and assign projection scenarios from the client detail page.
            </p>
            {data.commitments.length > 0 ? (
              <div className="mt-2 space-y-1">
                {data.commitments.map((c, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-zinc-600">{c.fundName}</span>
                    <span className="text-zinc-900">${c.commitmentAmount.toLocaleString()} committed</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-zinc-400">No commitments to project from.</p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 cursor-pointer disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save Warning Config"}
        </button>
        {result?.success && <p className="text-sm text-emerald-600">Saved.</p>}
        {result?.error && <p className="text-sm text-red-600">{result.error}</p>}
      </div>
    </div>
  );
}
