"use client";

import { memo } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import type { AllocationResult } from "@/lib/allocation";
import type { DriftResult } from "@/lib/drift";
import type { LadderBucket } from "@/lib/liquidity-profile";
import type { PMCommitmentSummary, ProductHolding, SleeveAllocationData } from "@/lib/allocation-chart-data";
import { PM_FUNDED_COLOR, PM_UNFUNDED_COLOR } from "@/lib/allocation-chart-data";
import { AllocationChart } from "./allocation-chart";

const money = (v: number) => "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const pct = (v: number) => (v * 100).toFixed(1) + "%";

// ── Types for dashboard props ────────────────────────────

export type DashboardProps = {
  clientName: string;
  totalValue: number;
  // Allocation
  allocation: AllocationResult | null;
  productHoldings: ProductHolding[];
  pmCommitments: PMCommitmentSummary[];
  sleeveAllocationData: SleeveAllocationData | null;
  // Drift
  drift: DriftResult | null;
  saaName: string | null;
  // Liquidity
  liquidityBuckets: LadderBucket[];
  totalPortfolioValue: number;
  // Sleeve health
  sleeveHealth: {
    sleeveName: string;
    liquidBucketValue: number;
    requiredBuffer: number;
    severity: "OK" | "WARN" | "CRITICAL";
    cashBufferPct: number;
    totalUnfunded: number;
    pmExposure: number;
  } | null;
  // PM Projections
  pmProjections: {
    fundName: string;
    projectedCalls: { month: string; amount: number }[];
  }[];
};

function ClientDashboardInner(props: DashboardProps) {
  const {
    totalValue,
    allocation,
    productHoldings,
    pmCommitments,
    sleeveAllocationData,
    drift,
    saaName,
    liquidityBuckets,
    sleeveHealth,
    pmProjections,
  } = props;

  return (
    <div className="space-y-6 mt-6">
      {/* ── Summary Cards ──────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Portfolio Value" value={money(totalValue)} />
        <SummaryCard
          label="Drift"
          value={drift ? `${drift.breachCount} breach${drift.breachCount !== 1 ? "es" : ""}` : "No SAA"}
          color={drift ? (drift.breachCount === 0 ? "emerald" : "red") : "zinc"}
        />
        <SummaryCard
          label="Sleeve Health"
          value={sleeveHealth?.severity ?? "No Sleeve"}
          color={sleeveHealth ? (sleeveHealth.severity === "OK" ? "emerald" : sleeveHealth.severity === "WARN" ? "amber" : "red") : "zinc"}
        />
        <SummaryCard
          label="Liquid Assets"
          value={liquidityBuckets.length > 0
            ? money(liquidityBuckets.reduce((s, b) => s + b.grossValue, 0))
            : "—"}
        />
      </div>

      {/* ── Chart Grid ─────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 1. Portfolio Allocation (sunburst/treemap) */}
        <ChartPanel title="Portfolio Allocation" colSpan={allocation ? 2 : 1}>
          {allocation ? (
            <AllocationChart
              allocation={allocation}
              productHoldings={productHoldings}
              pmCommitments={pmCommitments}
              sleeveData={sleeveAllocationData}
            />
          ) : (
            <EmptyState text="No allocation data. Check taxonomy mappings." />
          )}
        </ChartPanel>

        {/* 2. Drift vs SAA */}
        <ChartPanel title={saaName ? `Drift vs SAA: ${saaName}` : "Drift vs SAA"}>
          {drift && drift.rows.length > 0 ? (
            <DriftChart drift={drift} />
          ) : (
            <EmptyState text={saaName ? "No drift — portfolio matches SAA." : "No SAA assigned to this client."} />
          )}
        </ChartPanel>

        {/* 3. Liquidity Ladder */}
        <ChartPanel title="Liquidity Ladder">
          {liquidityBuckets.length > 0 ? (
            <LiquidityChart buckets={liquidityBuckets} />
          ) : (
            <EmptyState text="No liquidity profile data available." />
          )}
        </ChartPanel>

        {/* 4. PM Projections */}
        <ChartPanel title="PM Call Projections">
          {pmProjections.length > 0 ? (
            <PMProjectionChart projections={pmProjections} />
          ) : (
            <EmptyState text="No PM commitments with projection data." />
          )}
        </ChartPanel>

        {/* 5. Sleeve Buffer Health */}
        <ChartPanel title="Sleeve Buffer Health">
          {sleeveHealth ? (
            <SleeveHealthPanel health={sleeveHealth} />
          ) : (
            <EmptyState text="No PM sleeve configured for this client." />
          )}
        </ChartPanel>
      </div>
    </div>
  );
}

export const ClientDashboard = memo(ClientDashboardInner);

// ── Sub-components ───────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-600",
    red: "text-red-600",
    amber: "text-amber-600",
    zinc: "text-zinc-500",
  };
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${colorMap[color ?? ""] ?? "text-zinc-900"}`}>{value}</p>
    </div>
  );
}

function ChartPanel({ title, children, colSpan }: { title: string; children: React.ReactNode; colSpan?: number }) {
  return (
    <div className={`rounded-lg border border-zinc-200 bg-white p-4 ${colSpan === 2 ? "lg:col-span-2" : ""}`}>
      <h3 className="text-sm font-semibold text-zinc-900 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-48 text-sm text-zinc-400">
      {text}
    </div>
  );
}

// ── Drift bar chart ──────────────────────────────────────

function DriftChart({ drift }: { drift: DriftResult }) {
  const rows = drift.rows;
  const options: Highcharts.Options = {
    chart: { type: "bar", height: Math.max(180, rows.length * 32 + 60), backgroundColor: "transparent", style: { fontFamily: "'IBM Plex Sans', system-ui, sans-serif" } },
    credits: { enabled: false },
    title: { text: undefined },
    xAxis: { categories: rows.map((r) => r.nodeName), labels: { style: { fontSize: "11px", color: "#71717a" } } },
    yAxis: {
      title: { text: "Drift (%)" },
      labels: { format: "{value}%", style: { color: "#71717a" } },
      plotLines: [{ value: 0, width: 1, color: "#a1a1aa" }],
    },
    tooltip: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: function (this: any) {
        const r = rows[this.point.index];
        return `<b>${r.nodeName}</b><br/>Current: ${pct(r.currentWeight)}<br/>Target: ${pct(r.targetWeight)}<br/>Drift: ${r.drift >= 0 ? "+" : ""}${pct(r.drift)}`;
      },
    },
    legend: { enabled: false },
    plotOptions: {
      bar: {
        borderRadius: 2,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        colorByPoint: true as any,
      },
    },
    series: [{
      type: "bar",
      name: "Drift",
      data: rows.map((r) => ({
        y: +(r.drift * 100).toFixed(2),
        color: r.toleranceStatus === "within" ? "#a1a1aa" : r.drift > 0 ? "#ef4444" : "#3b82f6",
      })),
    }],
  };

  return <HighchartsReact highcharts={Highcharts} options={options} />;
}

// ── Liquidity ladder stacked bar ─────────────────────────

function LiquidityChart({ buckets }: { buckets: LadderBucket[] }) {
  const options: Highcharts.Options = {
    chart: { type: "column", height: 240, backgroundColor: "transparent", style: { fontFamily: "'IBM Plex Sans', system-ui, sans-serif" } },
    credits: { enabled: false },
    title: { text: undefined },
    xAxis: { categories: buckets.map((b) => b.horizonLabel), labels: { style: { fontSize: "10px", color: "#71717a" } } },
    yAxis: { title: { text: "Value ($)" }, labels: { style: { color: "#71717a" } } },
    tooltip: {
      shared: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: function (this: any) {
        const b = buckets[this.points?.[0]?.point?.index ?? 0];
        if (!b) return "";
        return `<b>${b.horizonLabel}</b><br/>Gross: ${money(b.grossValue)}<br/>Stressed: ${money(b.stressedValue)}<br/>Cumulative: ${pct(b.cumulativePct)}`;
      },
    },
    plotOptions: { column: { borderRadius: 3, groupPadding: 0.15 } },
    series: [
      { type: "column", name: "Gross", data: buckets.map((b) => b.grossValue), color: "#3b82f6" },
      { type: "column", name: "Stressed", data: buckets.map((b) => b.stressedValue), color: "#93c5fd" },
    ],
  };

  return <HighchartsReact highcharts={Highcharts} options={options} />;
}

// ── PM Call Projection line chart ────────────────────────

function PMProjectionChart({ projections }: { projections: { fundName: string; projectedCalls: { month: string; amount: number }[] }[] }) {
  const colors = ["#8b5cf6", "#3b82f6", "#f59e0b", "#ef4444", "#22c55e"];
  const allMonths = [...new Set(projections.flatMap((p) => p.projectedCalls.map((c) => c.month)))].sort();
  if (allMonths.length === 0) return <EmptyState text="No projection data." />;

  const options: Highcharts.Options = {
    chart: { type: "area", height: 240, backgroundColor: "transparent", style: { fontFamily: "'IBM Plex Sans', system-ui, sans-serif" } },
    credits: { enabled: false },
    title: { text: undefined },
    xAxis: { categories: allMonths.map((m) => m.slice(0, 7)), labels: { style: { fontSize: "9px", color: "#71717a" }, step: Math.max(1, Math.floor(allMonths.length / 8)) } },
    yAxis: { title: { text: "Call Amount ($)" }, labels: { style: { color: "#71717a" } } },
    plotOptions: { area: { stacking: "normal", lineWidth: 1.5, fillOpacity: 0.15 } },
    series: projections.map((p, i) => ({
      type: "area" as const,
      name: p.fundName,
      data: allMonths.map((m) => p.projectedCalls.find((c) => c.month === m)?.amount ?? 0),
      color: colors[i % colors.length],
    })),
  };

  return <HighchartsReact highcharts={Highcharts} options={options} />;
}

// ── Sleeve Buffer Health gauge ───────────────────────────

function SleeveHealthPanel({ health }: { health: NonNullable<DashboardProps["sleeveHealth"]> }) {
  const ratio = health.requiredBuffer > 0 ? health.liquidBucketValue / health.requiredBuffer : 999;
  const barPct = Math.min(100, ratio * 100);
  const barColor = health.severity === "OK" ? "bg-emerald-500" : health.severity === "WARN" ? "bg-amber-500" : "bg-red-500";
  const textColor = health.severity === "OK" ? "text-emerald-600" : health.severity === "WARN" ? "text-amber-600" : "text-red-600";

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="text-center">
        <p className={`text-3xl font-bold ${textColor}`}>{health.severity}</p>
        <p className="text-xs text-zinc-500 mt-1">{health.sleeveName}</p>
      </div>

      {/* Buffer bar */}
      <div>
        <div className="flex justify-between text-xs text-zinc-500 mb-1">
          <span>Liquid Bucket</span>
          <span>Required Buffer</span>
        </div>
        <div className="h-4 w-full rounded-full bg-zinc-200 overflow-hidden">
          <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${barPct}%` }} />
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-zinc-700 font-medium">{money(health.liquidBucketValue)}</span>
          <span className="text-zinc-500">{money(health.requiredBuffer)}</span>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <p className="text-zinc-500">Buffer %</p>
          <p className="font-medium text-zinc-900">{pct(health.cashBufferPct)}</p>
        </div>
        <div>
          <p className="text-zinc-500">Unfunded</p>
          <p className="font-medium text-zinc-900">{money(health.totalUnfunded)}</p>
        </div>
        <div>
          <p className="text-zinc-500">PM Exposure</p>
          <p className="font-medium text-zinc-900">{money(health.pmExposure)}</p>
        </div>
      </div>
    </div>
  );
}
