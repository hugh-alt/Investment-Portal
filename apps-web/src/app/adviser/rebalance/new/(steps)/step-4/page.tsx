"use client";

import { useState, useMemo } from "react";
import { useRebalanceWizard } from "../../wizard-context";
import { saveAmendedTradesAction } from "../../wizard-actions";
import { HighchartsWrapper } from "@/components/highcharts-wrapper";
import type { TradeRow } from "../../wizard-config";
import type Highcharts from "highcharts";

const money = (v: number) => "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v: number) => (v * 100).toFixed(1) + "%";

let nextTempId = 1;

export default function Step4Page() {
  const { data, update } = useRebalanceWizard();
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ error?: string; success?: boolean } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Add-trade form state
  const [newSide, setNewSide] = useState<"SELL" | "BUY">("BUY");
  const [newProductId, setNewProductId] = useState("");
  const [newAmount, setNewAmount] = useState("");

  // ── Advanced SAA table: projected after-trade weights ───
  const projectedDrift = useMemo(() => {
    return data.afterDrift;
  }, [data.afterDrift]);

  if (!data.planId) {
    return <p className="text-sm text-zinc-500">Complete Step 1 first.</p>;
  }

  const trades = data.trades;
  const sells = trades.filter((t) => t.side === "SELL");
  const buys = trades.filter((t) => t.side === "BUY");
  const totalSell = sells.reduce((s, t) => s + t.amount, 0);
  const totalBuy = buys.reduce((s, t) => s + t.amount, 0);

  // Sleeve grouping
  const sleeveTrades = trades.filter((t) => t.isSleeve);
  const portfolioTrades = trades.filter((t) => !t.isSleeve);
  const hasSleeveTrades = data.includeSleeve && sleeveTrades.length > 0;

  // Before vs After drift chart
  const chartOptions: Highcharts.Options = {
    chart: { type: "bar", height: Math.max(200, data.beforeDrift.length * 40 + 80) },
    title: { text: "Drift: Before vs After Rebalance" },
    xAxis: {
      categories: data.beforeDrift.map((d) => d.nodeName),
      labels: { style: { fontSize: "11px" } },
    },
    yAxis: {
      title: { text: "Drift from Target (%)" },
      labels: { format: "{value}%" },
      plotLines: [{ value: 0, width: 1, color: "#71717a" }],
    },
    tooltip: { valueSuffix: "%", valueDecimals: 1 },
    plotOptions: { bar: { grouping: true, borderRadius: 2 } },
    series: [
      { name: "Before", type: "bar", data: data.beforeDrift.map((d) => +(d.drift * 100).toFixed(1)), color: "#ef4444" },
      { name: "After", type: "bar", data: data.afterDrift.map((d) => +(d.drift * 100).toFixed(1)), color: "#22c55e" },
    ],
  };

  // ── Trade editing handlers ──────────────────────────────

  function updateTradeAmount(id: string, amount: number) {
    const updated = trades.map((t) => t.id === id ? { ...t, amount: Math.max(0, amount) } : t);
    update({ trades: updated, tradesAmended: true });
  }

  function updateTradeSide(id: string, side: string) {
    const updated = trades.map((t) => t.id === id ? { ...t, side } : t);
    update({ trades: updated, tradesAmended: true });
  }

  function removeTrade(id: string) {
    update({ trades: trades.filter((t) => t.id !== id), tradesAmended: true });
  }

  function addTrade() {
    if (!newProductId || !newAmount) return;
    const amt = parseFloat(newAmount);
    if (isNaN(amt) || amt <= 0) return;
    const product = data.availableProducts.find((p) => p.id === newProductId);
    if (!product) return;

    const trade: TradeRow = {
      id: `temp-${nextTempId++}`,
      productId: product.id,
      productName: product.name,
      side: newSide,
      amount: amt,
      reason: "Manual addition",
      isSleeve: false,
    };
    update({ trades: [...trades, trade], tradesAmended: true });
    setNewProductId("");
    setNewAmount("");
  }

  function revertTrades() {
    update({ trades: data.originalTrades, tradesAmended: false });
  }

  async function handleSave() {
    setSaving(true);
    setSaveResult(null);
    const validTrades = trades.filter((t) => t.amount > 0);
    const result = await saveAmendedTradesAction(data.planId, data.clientId, validTrades);
    setSaving(false);
    setSaveResult(result);
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="flex gap-4 text-sm flex-wrap">
        <div className="glass-card px-4 py-3">
          <p className="text-xs text-zinc-500">Sells</p>
          <p className="font-medium text-red-600">{sells.length} trades / {money(totalSell)}</p>
        </div>
        <div className="glass-card px-4 py-3">
          <p className="text-xs text-zinc-500">Buys</p>
          <p className="font-medium text-emerald-600">{buys.length} trades / {money(totalBuy)}</p>
        </div>
        <div className="glass-card px-4 py-3">
          <p className="text-xs text-zinc-500">Breaches</p>
          <p className="font-medium text-zinc-900">{data.breachesBefore} → {data.breachesAfter}</p>
        </div>
        {data.tradesAmended && (
          <div className="glass-card px-4 py-3 border-amber-200">
            <p className="text-xs text-amber-600">Amended</p>
            <p className="text-xs font-medium text-amber-700">Trades modified by adviser</p>
          </div>
        )}
      </div>

      {/* Before/after chart */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <HighchartsWrapper options={chartOptions} />
      </div>

      {/* Sleeve trades section */}
      {hasSleeveTrades && (
        <TradeTable
          title="Sleeve Trades"
          subtitle="Trades involving sleeve liquid positions."
          trades={sleeveTrades}
          onUpdateAmount={updateTradeAmount}
          onUpdateSide={updateTradeSide}
          onRemove={removeTrade}
          highlight="blue"
        />
      )}

      {/* Portfolio trades section */}
      <TradeTable
        title={hasSleeveTrades ? "Portfolio Trades" : "Proposed Trades"}
        subtitle={hasSleeveTrades ? "Trades in the main portfolio (outside sleeve)." : "Edit amounts, add/remove trades, or change side."}
        trades={hasSleeveTrades ? portfolioTrades : trades}
        onUpdateAmount={updateTradeAmount}
        onUpdateSide={updateTradeSide}
        onRemove={removeTrade}
      />

      {/* Add trade form */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <p className="mb-3 text-sm font-medium text-zinc-700">Add Trade</p>
        <div className="flex gap-3 flex-wrap">
          <select
            value={newSide}
            onChange={(e) => setNewSide(e.target.value as "BUY" | "SELL")}
            className="w-24 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none"
          >
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
          <select
            value={newProductId}
            onChange={(e) => setNewProductId(e.target.value)}
            className="flex-1 min-w-[200px] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none"
          >
            <option value="">Select product...</option>
            {data.availableProducts.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="100"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            placeholder="Amount ($)"
            className="w-36 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none"
          />
          <button
            onClick={addTrade}
            disabled={!newProductId || !newAmount}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 cursor-pointer disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </div>

      {/* Save / revert */}
      <div className="flex gap-2 items-center">
        {data.tradesAmended && (
          <>
            <button
              onClick={handleSave}
              disabled={saving || trades.filter((t) => t.amount > 0).length === 0}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 cursor-pointer disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save Amended Trades"}
            </button>
            <button
              onClick={revertTrades}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 cursor-pointer"
            >
              Revert to Original
            </button>
          </>
        )}
        {saveResult?.success && <p className="text-sm text-emerald-600">Saved.</p>}
        {saveResult?.error && <p className="text-sm text-red-600">{saveResult.error}</p>}
      </div>

      {/* Advanced accordion: full SAA table */}
      <div className="border border-zinc-200 rounded-lg">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
        >
          <span>Advanced: Full SAA Allocation Table</span>
          <span className="text-zinc-400">{showAdvanced ? "−" : "+"}</span>
        </button>
        {showAdvanced && (
          <div className="border-t border-zinc-200 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-100">
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Node</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600">Target</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600">Min</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600">Max</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600">Before</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600">After</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600">Diff to Target</th>
                </tr>
              </thead>
              <tbody>
                {data.beforeDrift.map((before) => {
                  const after = projectedDrift.find((a) => a.nodeId === before.nodeId);
                  const afterWeight = after?.currentWeight ?? before.currentWeight;
                  const diffToTarget = afterWeight - before.targetWeight;
                  const withinBands = afterWeight >= before.minWeight - 0.0005 && afterWeight <= before.maxWeight + 0.0005;
                  return (
                    <tr key={before.nodeId} className="border-b border-zinc-100 last:border-0">
                      <td className="px-3 py-1.5 font-medium text-zinc-900">{before.nodeName}</td>
                      <td className="px-3 py-1.5 text-right text-zinc-500">{pct(before.targetWeight)}</td>
                      <td className="px-3 py-1.5 text-right text-zinc-400">{pct(before.minWeight)}</td>
                      <td className="px-3 py-1.5 text-right text-zinc-400">{pct(before.maxWeight)}</td>
                      <td className="px-3 py-1.5 text-right text-zinc-700">{pct(before.currentWeight)}</td>
                      <td className={`px-3 py-1.5 text-right font-medium ${withinBands ? "text-emerald-600" : "text-red-600"}`}>
                        {pct(afterWeight)}
                      </td>
                      <td className={`px-3 py-1.5 text-right ${Math.abs(diffToTarget) < 0.001 ? "text-zinc-400" : diffToTarget > 0 ? "text-amber-600" : "text-blue-600"}`}>
                        {diffToTarget >= 0 ? "+" : ""}{pct(diffToTarget)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-zinc-400">
        Trades respect a $500 minimum trade amount. Click Next to proceed to approval.
      </p>
    </div>
  );
}

function TradeTable({
  title,
  subtitle,
  trades,
  onUpdateAmount,
  onUpdateSide,
  onRemove,
  highlight,
}: {
  title: string;
  subtitle: string;
  trades: TradeRow[];
  onUpdateAmount: (id: string, amount: number) => void;
  onUpdateSide: (id: string, side: string) => void;
  onRemove: (id: string) => void;
  highlight?: "blue";
}) {
  if (trades.length === 0) return null;

  const sells = trades.filter((t) => t.side === "SELL");
  const buys = trades.filter((t) => t.side === "BUY");
  const borderClass = highlight === "blue" ? "border-blue-200" : "border-zinc-200";

  return (
    <div>
      <h3 className="text-sm font-medium text-zinc-900">{title}</h3>
      <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
      <div className={`mt-2 overflow-hidden rounded-lg border ${borderClass}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-100">
              <th className="w-24 px-4 py-2 text-left font-medium text-zinc-600">Side</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Product</th>
              <th className="w-40 px-4 py-2 text-right font-medium text-zinc-600">Amount ($)</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Reason</th>
              <th className="w-16 px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {[...sells, ...buys].map((t) => (
              <tr key={t.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-2">
                  <select
                    value={t.side}
                    onChange={(e) => onUpdateSide(t.id, e.target.value)}
                    className={`w-20 rounded border border-zinc-300 px-2 py-1 text-xs font-medium ${
                      t.side === "SELL" ? "text-red-600" : "text-emerald-600"
                    } focus:border-amber-500 focus:outline-none bg-white`}
                  >
                    <option value="SELL">SELL</option>
                    <option value="BUY">BUY</option>
                  </select>
                </td>
                <td className="px-4 py-2 text-zinc-900">{t.productName}</td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={t.amount}
                    onChange={(e) => onUpdateAmount(t.id, parseFloat(e.target.value) || 0)}
                    className="w-32 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-sm text-zinc-900 focus:border-amber-500 focus:outline-none"
                  />
                </td>
                <td className="px-4 py-2 text-xs text-zinc-500">{t.reason}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => onRemove(t.id)} className="text-red-500 hover:text-red-700 text-xs cursor-pointer">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
