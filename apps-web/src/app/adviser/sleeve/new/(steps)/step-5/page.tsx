"use client";

import { useState } from "react";
import { useSleeveWizard } from "../../wizard-context";
import { updateWaterfallsAction } from "../../wizard-actions";
import type { WaterfallEntry } from "../../wizard-config";
import { reorderArray, isCashProduct, ensureCashEntries } from "@/lib/sleeve-liquid-bucket";

export default function Step5Page() {
  const { data, update } = useSleeveWizard();
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null);

  if (!data.sleeveId) {
    return <p className="text-sm text-zinc-500">Complete Step 1 first.</p>;
  }

  const availableProducts = data.liquidPositions;

  function autoPopulate() {
    // Ensure cash products are included in waterfall
    const cashEntries = ensureCashEntries(
      availableProducts.map((p) => ({ productId: p.productId, productName: p.productName, weightPct: 0 })),
    );
    const entries: WaterfallEntry[] = cashEntries.map((p) => ({
      productId: p.productId, productName: p.productName, maxPct: 1, excluded: false,
    }));
    update({ sellWaterfall: entries, buyWaterfall: entries });
  }

  function moveSell(index: number, direction: "up" | "down") {
    update({ sellWaterfall: reorderArray(data.sellWaterfall, index, direction) });
  }

  function moveBuy(index: number, direction: "up" | "down") {
    update({ buyWaterfall: reorderArray(data.buyWaterfall, index, direction) });
  }

  function toggleSellExcluded(index: number) {
    const updated = [...data.sellWaterfall];
    updated[index] = { ...updated[index], excluded: !updated[index].excluded };
    update({ sellWaterfall: updated });
  }

  function toggleBuyExcluded(index: number) {
    const updated = [...data.buyWaterfall];
    updated[index] = { ...updated[index], excluded: !updated[index].excluded };
    update({ buyWaterfall: updated });
  }

  function updateSellEntry(index: number, maxPct: number) {
    const updated = [...data.sellWaterfall];
    updated[index] = { ...updated[index], maxPct };
    update({ sellWaterfall: updated });
  }

  function updateBuyEntry(index: number, maxPct: number) {
    const updated = [...data.buyWaterfall];
    updated[index] = { ...updated[index], maxPct };
    update({ buyWaterfall: updated });
  }

  function removeSellEntry(index: number) {
    update({ sellWaterfall: data.sellWaterfall.filter((_, i) => i !== index) });
  }

  function removeBuyEntry(index: number) {
    update({ buyWaterfall: data.buyWaterfall.filter((_, i) => i !== index) });
  }

  async function handleSave() {
    setSaving(true);
    setResult(null);
    const res = await updateWaterfallsAction(
      data.sleeveId,
      data.clientId,
      data.sellWaterfall,
      data.buyWaterfall,
      parseFloat(data.minTradeAmount) || 1000,
    );
    setSaving(false);
    setResult(res);
  }

  return (
    <div className="space-y-6">
      {data.sellWaterfall.length === 0 && data.buyWaterfall.length === 0 && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center">
          <p className="text-sm text-zinc-500">No waterfall entries yet.</p>
          <button
            onClick={autoPopulate}
            disabled={availableProducts.length === 0}
            className="mt-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:bg-zinc-300 cursor-pointer disabled:cursor-not-allowed"
          >
            Auto-populate from liquid positions
          </button>
        </div>
      )}

      {/* Warning text */}
      {(data.sellWaterfall.length > 0 || data.buyWaterfall.length > 0) && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs text-blue-700">
            Use the arrows to reorder priority. Toggle &quot;Do not sell/buy&quot; to exclude a position from automatic trades.
            Cash products are included in both waterfalls by default.
          </p>
        </div>
      )}

      {/* Sell waterfall */}
      <WaterfallTable
        title="Sell Waterfall"
        subtitle="Priority order for selling when raising liquidity."
        entries={data.sellWaterfall}
        onUpdatePct={updateSellEntry}
        onRemove={removeSellEntry}
        onMove={moveSell}
        onToggleExcluded={toggleSellExcluded}
        pctLabel="Max Sell %"
        excludeLabel="Do not sell"
      />

      {/* Buy waterfall */}
      <WaterfallTable
        title="Buy Waterfall"
        subtitle="Priority order for buying when investing excess liquidity."
        entries={data.buyWaterfall}
        onUpdatePct={updateBuyEntry}
        onRemove={removeBuyEntry}
        onMove={moveBuy}
        onToggleExcluded={toggleBuyExcluded}
        pctLabel="Max Buy %"
        excludeLabel="Do not buy"
      />

      {/* Min trade amount */}
      <div>
        <label htmlFor="min-trade" className="block text-sm font-medium text-zinc-700">
          Minimum Trade Amount ($)
        </label>
        <input
          id="min-trade"
          type="number"
          min="0"
          step="100"
          value={data.minTradeAmount}
          onChange={(e) => update({ minTradeAmount: e.target.value })}
          className="mt-1 w-40 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 cursor-pointer disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save Waterfalls"}
        </button>
        {result?.success && <p className="text-sm text-emerald-600">Saved.</p>}
        {result?.error && <p className="text-sm text-red-600">{result.error}</p>}
      </div>
    </div>
  );
}

function WaterfallTable({
  title,
  subtitle,
  entries,
  onUpdatePct,
  onRemove,
  onMove,
  onToggleExcluded,
  pctLabel,
  excludeLabel,
}: {
  title: string;
  subtitle: string;
  entries: WaterfallEntry[];
  onUpdatePct: (index: number, pct: number) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: "up" | "down") => void;
  onToggleExcluded: (index: number) => void;
  pctLabel: string;
  excludeLabel: string;
}) {
  if (entries.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-medium text-zinc-900">{title}</h3>
      <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
      <div className="mt-2 overflow-hidden rounded-lg border border-zinc-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-100">
              <th className="w-10 px-3 py-2 text-left font-medium text-zinc-500">#</th>
              <th className="w-16 px-2 py-2 text-center font-medium text-zinc-500">Order</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Product</th>
              <th className="w-24 px-3 py-2 text-center font-medium text-zinc-600">{excludeLabel}</th>
              <th className="w-32 px-4 py-2 text-right font-medium text-zinc-600">{pctLabel}</th>
              <th className="w-16 px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => {
              const isCash = isCashProduct(entry.productId);
              return (
                <tr key={i} className={`border-b border-zinc-100 last:border-0 ${entry.excluded ? "opacity-50" : ""} ${isCash ? "bg-blue-50/30" : ""}`}>
                  <td className="px-3 py-2 text-zinc-400">{i + 1}</td>
                  <td className="px-2 py-2 text-center">
                    <div className="flex justify-center gap-1">
                      <button
                        onClick={() => onMove(i, "up")}
                        disabled={i === 0}
                        className="text-zinc-400 hover:text-zinc-700 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed text-xs"
                        title="Move up"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => onMove(i, "down")}
                        disabled={i === entries.length - 1}
                        className="text-zinc-400 hover:text-zinc-700 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed text-xs"
                        title="Move down"
                      >
                        ▼
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-zinc-900">
                    {entry.productName}
                    {isCash && <span className="ml-1 text-xs text-blue-500">(cash)</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={entry.excluded}
                      onChange={() => onToggleExcluded(i)}
                      className="h-4 w-4 rounded border-zinc-300 text-red-500 focus:ring-red-400"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      min="0" max="100" step="5"
                      value={Math.round(entry.maxPct * 100)}
                      onChange={(e) => onUpdatePct(i, (parseFloat(e.target.value) || 0) / 100)}
                      disabled={entry.excluded}
                      className="w-20 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-sm text-zinc-900 focus:border-amber-500 focus:outline-none disabled:bg-zinc-100 disabled:text-zinc-400"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => onRemove(i)} className="text-red-500 hover:text-red-700 text-xs cursor-pointer">
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
