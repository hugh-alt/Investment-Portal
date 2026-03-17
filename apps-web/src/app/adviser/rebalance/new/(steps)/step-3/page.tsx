"use client";

import { useState, useEffect } from "react";
import { useRebalanceWizard } from "../../wizard-context";
import { checkLiquidityAction } from "../../wizard-actions";

const money = (v: number) => "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const pct = (v: number) => (v * 100).toFixed(1) + "%";

export default function Step3Page() {
  const { data, update } = useRebalanceWizard();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalTradeValue = data.trades.reduce((s, t) => s + t.amount, 0) / 2;

  // Auto-check on mount or when includeSleeve changes
  useEffect(() => {
    if (data.planId) {
      runCheck();
    }
    async function runCheck() {
      setChecking(true);
      const tradeVal = data.trades.reduce((s, t) => s + t.amount, 0) / 2;
      const result = await checkLiquidityAction(data.clientId, tradeVal, data.includeSleeve);
      setChecking(false);
      if (result.error) return;
      update({
        liquidityChecked: true,
        liquidityBuckets: result.buckets ?? [],
        totalLiquid: result.totalLiquid ?? 0,
        sleeveLiquid: result.sleeveLiquid ?? 0,
        nonSleeveLiquid: result.nonSleeveLiquid ?? 0,
        totalTradeValue: tradeVal,
        liquidityOk: result.liquidityOk ?? true,
        liquidityWarnings: result.warnings ?? [],
      });
    }
  }, [data.planId, data.includeSleeve]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data.planId) {
    return <p className="text-sm text-zinc-500">Complete Step 1 first.</p>;
  }

  async function handleCheck() {
    setChecking(true);
    setError(null);
    const result = await checkLiquidityAction(data.clientId, totalTradeValue, data.includeSleeve);
    setChecking(false);
    if (result.error) {
      setError(result.error);
    } else {
      update({
        liquidityChecked: true,
        liquidityBuckets: result.buckets ?? [],
        totalLiquid: result.totalLiquid ?? 0,
        sleeveLiquid: result.sleeveLiquid ?? 0,
        nonSleeveLiquid: result.nonSleeveLiquid ?? 0,
        totalTradeValue,
        liquidityOk: result.liquidityOk ?? true,
        liquidityWarnings: result.warnings ?? [],
      });
    }
  }

  const hasSleeve = data.sleeveLiquid > 0;

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="flex gap-4 text-sm flex-wrap">
        <div className="glass-card px-4 py-3">
          <p className="text-xs text-zinc-500">Available Liquid Assets</p>
          <p className="font-medium text-zinc-900">{money(data.totalLiquid)}</p>
        </div>
        {hasSleeve && (
          <>
            <div className="glass-card px-4 py-3">
              <p className="text-xs text-zinc-500">Non-Sleeve Liquid</p>
              <p className="font-medium text-zinc-900">{money(data.nonSleeveLiquid)}</p>
            </div>
            <div className="glass-card px-4 py-3">
              <p className="text-xs text-zinc-500">Sleeve Liquid</p>
              <p className="font-medium text-blue-600">{money(data.sleeveLiquid)}</p>
            </div>
          </>
        )}
        <div className="glass-card px-4 py-3">
          <p className="text-xs text-zinc-500">Est. Trade Volume</p>
          <p className="font-medium text-zinc-900">{money(totalTradeValue)}</p>
        </div>
        <div className="glass-card px-4 py-3">
          <p className="text-xs text-zinc-500">Status</p>
          <p className={`font-medium ${data.liquidityOk ? "text-emerald-600" : "text-amber-600"}`}>
            {data.liquidityChecked ? (data.liquidityOk ? "Feasible" : "Constrained") : "Checking..."}
          </p>
        </div>
      </div>

      {/* Liquidity ladder with sleeve breakdown */}
      {data.liquidityBuckets.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-100">
                <th className="px-4 py-2 text-left font-medium text-zinc-600">Horizon</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-600">Gross Value</th>
                {hasSleeve && (
                  <>
                    <th className="px-4 py-2 text-right font-medium text-zinc-600">Non-Sleeve</th>
                    <th className="px-4 py-2 text-right font-medium text-blue-600">Sleeve</th>
                  </>
                )}
                <th className="px-4 py-2 text-right font-medium text-zinc-600">Stressed Value</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-600">% of Portfolio</th>
                <th className="px-4 py-2 text-center font-medium text-zinc-600">Gated</th>
              </tr>
            </thead>
            <tbody>
              {data.liquidityBuckets.map((b, i) => (
                <tr key={i} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-2 font-medium text-zinc-900">{b.horizonLabel}</td>
                  <td className="px-4 py-2 text-right text-zinc-700">{money(b.grossValue)}</td>
                  {hasSleeve && (
                    <>
                      <td className="px-4 py-2 text-right text-zinc-500">{money(b.nonSleeveValue ?? 0)}</td>
                      <td className="px-4 py-2 text-right text-blue-600">{money(b.sleeveValue ?? 0)}</td>
                    </>
                  )}
                  <td className="px-4 py-2 text-right text-zinc-700">{money(b.stressedValue)}</td>
                  <td className="px-4 py-2 text-right text-zinc-500">{pct(b.pctOfPortfolio)}</td>
                  <td className="px-4 py-2 text-center">
                    {b.gatedCount > 0 ? (
                      <span className="text-amber-600">{b.gatedCount}</span>
                    ) : (
                      <span className="text-zinc-400">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sleeve mode indicator */}
      {hasSleeve && (
        <div className={`rounded-lg border p-3 ${data.includeSleeve ? "border-blue-200 bg-blue-50" : "border-zinc-200 bg-zinc-50"}`}>
          <p className="text-xs font-medium text-zinc-700">
            {data.includeSleeve
              ? `Sleeve included: ${money(data.sleeveLiquid)} from sleeve contributing to trade capacity.`
              : `Sleeve excluded: ${money(data.sleeveLiquid)} in sleeve ring-fenced, not available for rebalance.`}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">Toggle in Step 2 to change.</p>
        </div>
      )}

      {/* Warnings */}
      {data.liquidityWarnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-1">
          <p className="text-sm font-medium text-amber-700">Liquidity Notes</p>
          {data.liquidityWarnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-600">{w}</p>
          ))}
        </div>
      )}

      {data.liquidityChecked && data.liquidityOk && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-medium text-emerald-700">Liquidity looks good.</p>
          <p className="mt-1 text-xs text-emerald-600">Available liquid assets can support the proposed trades. Click Next to review.</p>
        </div>
      )}

      <button
        onClick={handleCheck}
        disabled={checking}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 cursor-pointer disabled:opacity-50"
      >
        {checking ? "Checking..." : "Re-check Liquidity"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
