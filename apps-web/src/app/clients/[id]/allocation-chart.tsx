"use client";

import { useState, useRef, useEffect, memo } from "react";
import Highcharts from "highcharts";
import SunburstModule from "highcharts/modules/sunburst";
import TreemapModule from "highcharts/modules/treemap";
import HighchartsReact from "highcharts-react-official";
import type { AllocationResult } from "@/lib/allocation";
import {
  buildSunburstByAssetClass,
  buildSunburstByProduct,
  buildTreemapData,
  PM_FUNDED_COLOR,
  PM_UNFUNDED_COLOR,
  type PMCommitmentSummary,
  type ProductHolding,
  type SleeveAllocationData,
} from "@/lib/allocation-chart-data";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof SunburstModule === "function") (SunburstModule as any)(Highcharts);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof TreemapModule === "function") (TreemapModule as any)(Highcharts);

const money = (v: number) =>
  "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

type ViewMode = "asset_class" | "product";
type ChartMode = "radial" | "tree";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function chartTooltip(this: any) {
  const point = this.point ?? {};
  const val = point.value ?? this.value ?? 0;
  const custom = point.custom;
  const pctStr = custom?.pctOfTotal ? `(${(custom.pctOfTotal * 100).toFixed(1)}%)` : "";
  let label = "";
  if (custom?.isFunded) label = ' <span style="color:#7c3aed">Funded</span>';
  if (custom?.isUnfunded) label = ' <span style="color:#ddd6fe">Unfunded</span>';
  return `<b>${point.name ?? ""}</b>${label}<br/>${money(val)} ${pctStr}`;
}

function AllocationChartInner({
  allocation,
  productHoldings,
  pmCommitments,
  sleeveData,
}: {
  allocation: AllocationResult;
  productHoldings: ProductHolding[];
  pmCommitments: PMCommitmentSummary[];
  sleeveData: SleeveAllocationData | null;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("asset_class");
  const [chartMode, setChartMode] = useState<ChartMode>("radial");
  const chartRef = useRef<HighchartsReact.RefObject>(null);

  useEffect(() => {
    const timer = setTimeout(() => chartRef.current?.chart?.reflow(), 50);
    return () => clearTimeout(timer);
  }, [viewMode, chartMode]);

  if (allocation.totalValue === 0 && (!sleeveData || sleeveData.liquidBucketValue === 0)) {
    return <p className="text-sm text-zinc-400">No holdings to chart.</p>;
  }

  const hasPM = pmCommitments.length > 0;

  let options: Highcharts.Options;

  if (chartMode === "radial") {
    const data = viewMode === "asset_class"
      ? buildSunburstByAssetClass(allocation, pmCommitments, sleeveData)
      : buildSunburstByProduct(allocation, productHoldings, pmCommitments, sleeveData);

    options = {
      chart: { height: 420, backgroundColor: "transparent", style: { fontFamily: "'IBM Plex Sans', system-ui, sans-serif" } },
      credits: { enabled: false },
      title: { text: undefined },
      tooltip: { useHTML: true, backgroundColor: "#FFFFFF", borderColor: "#E4E4E7", style: { color: "#18181B" }, formatter: chartTooltip },
      series: [{
        type: "sunburst" as unknown as string,
        data: data.map((p) => ({ id: p.id, parent: p.parent, name: p.name, value: p.value, color: p.color, custom: p.custom })),
        allowDrillToNode: true,
        cursor: "pointer",
        borderWidth: 1.5,
        borderColor: "#ffffff",
        levels: [
          { level: 1, colorByPoint: true, dataLabels: { enabled: true, style: { fontSize: "12px", fontWeight: "600" } } },
          { level: 2, colorByPoint: true },
          { level: 3, colorVariation: { key: "brightness", to: 0.15 } },
          { level: 4, colorVariation: { key: "brightness", to: 0.3 } },
        ],
      } as Highcharts.SeriesOptionsType],
    };
  } else {
    const data = buildTreemapData(allocation, productHoldings, pmCommitments, sleeveData);
    options = {
      chart: { height: 420, backgroundColor: "transparent", style: { fontFamily: "'IBM Plex Sans', system-ui, sans-serif" } },
      credits: { enabled: false },
      title: { text: undefined },
      tooltip: { useHTML: true, backgroundColor: "#FFFFFF", borderColor: "#E4E4E7", style: { color: "#18181B" }, formatter: chartTooltip },
      series: [{
        type: "treemap",
        layoutAlgorithm: "squarified",
        allowDrillToNode: true,
        alternateStartingDirection: true,
        borderWidth: 2,
        borderColor: "#ffffff",
        data: data.map((p) => ({ id: p.id, parent: p.parent, name: p.name, value: p.value, color: p.color, custom: p.custom })),
        levels: [
          { level: 1, borderWidth: 4, dataLabels: { enabled: true, style: { fontSize: "13px", fontWeight: "700" } } },
          { level: 2, borderWidth: 2, dataLabels: { enabled: true, style: { fontSize: "11px", fontWeight: "500" } } },
          { level: 3, dataLabels: { enabled: false } },
        ],
      } as Highcharts.SeriesOptionsType],
    };
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex rounded-lg border border-zinc-200 overflow-hidden">
          <ToggleBtn active={viewMode === "asset_class"} onClick={() => setViewMode("asset_class")}>View by Asset Class</ToggleBtn>
          <ToggleBtn active={viewMode === "product"} onClick={() => setViewMode("product")}>View by Product</ToggleBtn>
        </div>
        <div className="flex rounded-lg border border-zinc-200 overflow-hidden">
          <ToggleBtn active={chartMode === "radial"} onClick={() => setChartMode("radial")}>Radial</ToggleBtn>
          <ToggleBtn active={chartMode === "tree"} onClick={() => setChartMode("tree")}>Tree</ToggleBtn>
        </div>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white p-2">
        <HighchartsReact key={`${chartMode}-${viewMode}`} highcharts={Highcharts} options={options} ref={chartRef} />
      </div>
      {hasPM && (
        <div className="flex gap-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: PM_FUNDED_COLOR }} />
            PM Funded
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: PM_UNFUNDED_COLOR }} />
            PM Unfunded
          </span>
        </div>
      )}
    </div>
  );
}

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${active ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}
    >
      {children}
    </button>
  );
}

export const AllocationChart = memo(AllocationChartInner);
