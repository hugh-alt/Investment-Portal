"use client";

import { useState, useEffect, useMemo } from "react";
import { useSleeveWizard } from "../../wizard-context";
import { loadClientHoldings, addLiquidPositionsAction } from "../../wizard-actions";
import type { LiquidEntry, LiquidBucketMode } from "../../wizard-config";
import {
  mirrorPortfolioWeights,
  ensureCashEntries,
  validateWeightSum,
  weightsToDollars,
  isCashProduct,
  type WeightedEntry,
} from "@/lib/sleeve-liquid-bucket";

const fmt = (v: number) =>
  "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function Step2Page() {
  const { data, update } = useSleeveWizard();
  const [holdings, setHoldings] = useState<{ productId: string; productName: string; marketValue: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null);

  useEffect(() => {
    if (!data.clientId) return;
    loadClientHoldings(data.clientId).then((h) => { setHoldings(h); setLoading(false); });
  }, [data.clientId]);

  // Derive weighted entries from current liquid positions or holdings
  const weightedEntries: WeightedEntry[] = useMemo(() => {
    if (data.liquidPositions.length > 0) {
      return ensureCashEntries(
        data.liquidPositions.map((p) => ({
          productId: p.productId,
          productName: p.productName,
          weightPct: p.weightPct,
        })),
      );
    }
    return ensureCashEntries([]);
  }, [data.liquidPositions]);

  if (!data.sleeveId) {
    return <p className="text-sm text-zinc-500">Complete Step 1 first.</p>;
  }

  function handleMirror() {
    const mirrored = mirrorPortfolioWeights(holdings);
    const positions: LiquidEntry[] = mirrored.map((e) => {
      const h = holdings.find((h) => h.productId === e.productId);
      return {
        productId: e.productId,
        productName: e.productName,
        marketValue: h?.marketValue ?? 0,
        weightPct: e.weightPct,
      };
    });
    update({ liquidPositions: positions, liquidBucketMode: "MIRROR" as LiquidBucketMode });
  }

  function handleCustom() {
    update({ liquidBucketMode: "CUSTOM" as LiquidBucketMode });
  }

  function updateWeight(productId: string, newWeight: number) {
    const updated = data.liquidPositions.map((p) =>
      p.productId === productId ? { ...p, weightPct: newWeight } : p,
    );
    // Ensure cash entries still present
    const cashNeeded = ensureCashEntries(
      updated.map((p) => ({ productId: p.productId, productName: p.productName, weightPct: p.weightPct })),
    );
    // Merge any new cash entries
    const existing = new Set(updated.map((p) => p.productId));
    for (const ce of cashNeeded) {
      if (!existing.has(ce.productId)) {
        updated.push({ productId: ce.productId, productName: ce.productName, marketValue: 0, weightPct: ce.weightPct });
      }
    }
    update({ liquidPositions: updated });
  }

  function removePosition(productId: string) {
    if (isCashProduct(productId)) return; // Can't remove cash
    update({ liquidPositions: data.liquidPositions.filter((p) => p.productId !== productId) });
  }

  const validationError = data.liquidPositions.length > 0 ? validateWeightSum(weightedEntries) : null;

  // Compute total liquid bucket value
  const totalLiquid = data.liquidPositions.reduce((s, p) => s + p.marketValue, 0);

  async function handleSave() {
    if (validationError) return;
    setSaving(true);
    setResult(null);
    // Convert weights to market values for saving
    const totalBucket = totalLiquid > 0 ? totalLiquid : data.portfolioValue * (parseFloat(data.targetPct) / 100 || 0.15);
    const dollarPositions = weightsToDollars(weightedEntries, totalBucket);
    const toSave: LiquidEntry[] = dollarPositions.map((d) => ({
      ...d,
      weightPct: weightedEntries.find((e) => e.productId === d.productId)?.weightPct ?? 0,
    }));
    const res = await addLiquidPositionsAction(data.sleeveId, data.clientId, toSave);
    setSaving(false);
    setResult(res);
  }

  return (
    <div className="space-y-5">
      {/* Mode toggle */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-2">Allocation Mode</label>
        <div className="flex gap-3">
          <button
            onClick={handleMirror}
            disabled={loading || holdings.length === 0}
            className={`flex-1 rounded-lg border p-3 text-sm text-left transition-colors cursor-pointer disabled:cursor-not-allowed ${
              data.liquidBucketMode === "MIRROR"
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            <span className="font-medium block">Mirror Portfolio</span>
            <span className="text-xs text-zinc-500">Replicate current holdings proportionally.</span>
          </button>
          <button
            onClick={handleCustom}
            className={`flex-1 rounded-lg border p-3 text-sm text-left transition-colors cursor-pointer ${
              data.liquidBucketMode === "CUSTOM"
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            <span className="font-medium block">Custom Allocation</span>
            <span className="text-xs text-zinc-500">Set weights manually for each position.</span>
          </button>
        </div>
      </div>

      {/* Align to rebalance toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={data.alignToRebalance}
          onChange={(e) => update({ alignToRebalance: e.target.checked })}
          className="h-4 w-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
        />
        <div>
          <span className="text-sm font-medium text-zinc-700">Align to rebalance</span>
          <p className="text-xs text-zinc-500">Update liquid bucket weights when portfolio is rebalanced.</p>
        </div>
      </label>

      {loading && <p className="text-sm text-zinc-400">Loading client holdings...</p>}

      {/* Weight allocation table */}
      {data.liquidPositions.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-100">
                <th className="px-4 py-2 text-left font-medium text-zinc-600">Product</th>
                <th className="w-28 px-4 py-2 text-right font-medium text-zinc-600">Weight (%)</th>
                <th className="w-32 px-4 py-2 text-right font-medium text-zinc-600">Est. Value</th>
                <th className="w-16 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {weightedEntries.map((entry) => {
                const isCash = isCashProduct(entry.productId);
                const estValue = totalLiquid > 0 ? totalLiquid * (entry.weightPct / 100) : 0;
                return (
                  <tr key={entry.productId} className={`border-b border-zinc-100 last:border-0 ${isCash ? "bg-blue-50/30" : ""}`}>
                    <td className="px-4 py-2 text-zinc-900">
                      {entry.productName}
                      {isCash && <span className="ml-1 text-xs text-blue-500">(cash)</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        min="0" max="100" step="0.5"
                        value={entry.weightPct}
                        onChange={(e) => updateWeight(entry.productId, parseFloat(e.target.value) || 0)}
                        className="w-20 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-sm text-zinc-900 focus:border-amber-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-500">
                      {estValue > 0 ? fmt(estValue) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {!isCash && (
                        <button onClick={() => removePosition(entry.productId)} className="text-red-500 hover:text-red-700 text-xs cursor-pointer">
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-200 bg-zinc-50">
                <td className="px-4 py-2 font-medium text-zinc-900">Total</td>
                <td className="px-4 py-2 text-right font-medium text-zinc-900">
                  {weightedEntries.reduce((s, e) => s + e.weightPct, 0).toFixed(1)}%
                </td>
                <td className="px-4 py-2 text-right font-medium text-zinc-900">
                  {totalLiquid > 0 ? fmt(totalLiquid) : "—"}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Validation warning */}
      {validationError && (
        <p className="text-sm text-red-600">{validationError}</p>
      )}

      {/* Save */}
      {data.liquidPositions.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !!validationError}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 cursor-pointer disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Positions"}
          </button>
          {result?.success && <p className="text-sm text-emerald-600">Saved.</p>}
          {result?.error && <p className="text-sm text-red-600">{result.error}</p>}
        </div>
      )}

      {data.liquidPositions.length === 0 && !loading && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center">
          <p className="text-sm text-zinc-500">
            {holdings.length > 0
              ? "Click \"Mirror Portfolio\" to start with your current holdings, or \"Custom\" to build from scratch."
              : "No holdings found for this client. Use Custom mode to add positions manually."}
          </p>
        </div>
      )}
    </div>
  );
}
