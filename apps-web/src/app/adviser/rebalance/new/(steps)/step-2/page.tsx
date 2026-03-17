"use client";

import { useRebalanceWizard } from "../../wizard-context";
import { HighchartsWrapper } from "@/components/highcharts-wrapper";
import type Highcharts from "highcharts";

const pct = (v: number) => (v * 100).toFixed(1) + "%";
const money = (v: number) => "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function Step2Page() {
  const { data, update } = useRebalanceWizard();

  if (!data.planId) {
    return <p className="text-sm text-zinc-500">Complete Step 1 first.</p>;
  }

  const drift = data.beforeDrift;
  const breaches = drift.filter((d) => d.status !== "within");
  const hasSleeve = data.sleeveSummary !== null;

  // Build Highcharts column chart: current vs target allocation
  const chartOptions: Highcharts.Options = {
    chart: { type: "column", height: 280 },
    title: { text: "Current vs Target Allocation" },
    xAxis: {
      categories: drift.map((d) => d.nodeName),
      labels: { style: { fontSize: "11px" } },
    },
    yAxis: {
      title: { text: "Weight (%)" },
      labels: { format: "{value}%" },
      max: Math.max(...drift.map((d) => Math.max(d.currentWeight, d.targetWeight, d.maxWeight))) * 110,
    },
    tooltip: { valueSuffix: "%", valueDecimals: 1 },
    plotOptions: {
      column: { grouping: true, borderRadius: 3 },
    },
    series: [
      {
        name: "Current",
        type: "column",
        data: drift.map((d) => +(d.currentWeight * 100).toFixed(1)),
        color: "#3b82f6",
      },
      {
        name: "Target",
        type: "column",
        data: drift.map((d) => +(d.targetWeight * 100).toFixed(1)),
        color: "#a1a1aa",
      },
    ],
  };

  return (
    <div className="space-y-5">
      {/* Sleeve include/exclude control — always visible */}
      <div className={`rounded-lg border p-4 ${hasSleeve ? (data.includeSleeve ? "border-amber-300 bg-amber-50" : "border-zinc-200 bg-zinc-50") : "border-zinc-200 bg-zinc-50"}`}>
        {hasSleeve ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-900">PM Sleeve: {data.sleeveSummary!.sleeveName}</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {data.includeSleeve
                  ? "Sleeve liquid positions are included in this rebalance."
                  : "Sleeve liquid positions are ring-fenced and excluded from this rebalance."}
              </p>
            </div>
            <button
              onClick={() => update({ includeSleeve: !data.includeSleeve, liquidityChecked: false })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                data.includeSleeve ? "bg-amber-500" : "bg-zinc-300"
              }`}
              role="switch"
              aria-checked={data.includeSleeve}
              aria-label="Include sleeve in rebalance"
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  data.includeSleeve ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-zinc-500">No PM Sleeve</p>
            <p className="text-xs text-zinc-400">This client does not have a PM sleeve configured.</p>
          </div>
        )}
      </div>

      {/* Sleeve summary cards (when included) */}
      {hasSleeve && data.includeSleeve && data.sleeveSummary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="glass-card px-3 py-2">
            <p className="text-xs text-zinc-500">Sleeve</p>
            <p className="text-sm font-medium text-zinc-900">{data.sleeveSummary.sleeveName}</p>
          </div>
          <div className="glass-card px-3 py-2">
            <p className="text-xs text-zinc-500">Liquid Bucket</p>
            <p className="text-sm font-medium text-zinc-900">{money(data.sleeveSummary.liquidBucketValue)}</p>
          </div>
          <div className="glass-card px-3 py-2">
            <p className="text-xs text-zinc-500">PM Exposure</p>
            <p className="text-sm font-medium text-zinc-900">{money(data.sleeveSummary.pmExposure)}</p>
          </div>
          <div className="glass-card px-3 py-2">
            <p className="text-xs text-zinc-500">Buffer Status</p>
            <p className={`text-sm font-medium ${
              data.sleeveSummary.warningStatus === "OK" ? "text-emerald-600"
                : data.sleeveSummary.warningStatus === "WARN" ? "text-amber-600" : "text-red-600"
            }`}>
              {data.sleeveSummary.warningStatus}
            </p>
          </div>
        </div>
      )}

      {/* Summary bar */}
      <div className="flex gap-4 text-sm">
        <div className="glass-card px-4 py-3">
          <p className="text-xs text-zinc-500">Portfolio Value</p>
          <p className="font-medium text-zinc-900">{money(data.totalPortfolioValue)}</p>
        </div>
        <div className="glass-card px-4 py-3">
          <p className="text-xs text-zinc-500">Breaches</p>
          <p className={`font-medium ${breaches.length > 0 ? "text-red-600" : "text-emerald-600"}`}>
            {breaches.length}
          </p>
        </div>
        <div className="glass-card px-4 py-3">
          <p className="text-xs text-zinc-500">Worst Drift</p>
          <p className="font-medium text-zinc-900">
            {drift.length > 0
              ? pct(drift.reduce((worst, d) => Math.abs(d.drift) > Math.abs(worst) ? d.drift : worst, 0))
              : "—"}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <HighchartsWrapper options={chartOptions} />
      </div>

      {/* Drift table */}
      <div className="overflow-hidden rounded-lg border border-zinc-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-100">
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Node</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Current</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Target</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Min</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Max</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Drift</th>
              <th className="px-4 py-2 text-center font-medium text-zinc-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {drift.map((d) => (
              <tr key={d.nodeId} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-2 font-medium text-zinc-900">{d.nodeName}</td>
                <td className="px-4 py-2 text-right text-zinc-700">{pct(d.currentWeight)}</td>
                <td className="px-4 py-2 text-right text-zinc-500">{pct(d.targetWeight)}</td>
                <td className="px-4 py-2 text-right text-zinc-400">{pct(d.minWeight)}</td>
                <td className="px-4 py-2 text-right text-zinc-400">{pct(d.maxWeight)}</td>
                <td className={`px-4 py-2 text-right font-medium ${d.status === "within" ? "text-zinc-500" : "text-red-600"}`}>
                  {d.drift >= 0 ? "+" : ""}{pct(d.drift)}
                </td>
                <td className="px-4 py-2 text-center">
                  {d.status === "within" ? (
                    <span className="inline-block rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">OK</span>
                  ) : d.status === "above_max" ? (
                    <span className="inline-block rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Over</span>
                  ) : (
                    <span className="inline-block rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Under</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-400">
        {breaches.length === 0
          ? "All nodes are within tolerance. No rebalancing needed."
          : `${breaches.length} node${breaches.length > 1 ? "s" : ""} outside tolerance bands. Click Next to check liquidity.`}
      </p>
    </div>
  );
}
