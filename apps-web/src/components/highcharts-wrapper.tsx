"use client";

import { useRef, memo } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

/**
 * Thin reusable wrapper around Highcharts.
 * Usage: <HighchartsWrapper options={chartOptions} />
 *
 * No charts are rendered yet — this wires the library for Phase 1+.
 */
interface HighchartsWrapperProps {
  options: Highcharts.Options;
  className?: string;
}

function HighchartsWrapperInner({ options, className }: HighchartsWrapperProps) {
  const chartRef = useRef<HighchartsReact.RefObject>(null);

  // Apply light theme defaults
  const mergedOptions: Highcharts.Options = {
    chart: {
      backgroundColor: "transparent",
      style: { fontFamily: "'IBM Plex Sans', system-ui, sans-serif" },
      ...options.chart,
    },
    credits: { enabled: false },
    title: {
      style: { color: "#18181B", fontSize: "14px", fontWeight: "600" },
      ...options.title,
    },
    legend: {
      itemStyle: { color: "#71717A", fontWeight: "400" },
      itemHoverStyle: { color: "#18181B" },
      ...options.legend,
    },
    xAxis: {
      labels: { style: { color: "#71717A" } },
      gridLineColor: "#E4E4E7",
      lineColor: "#D4D4D8",
      ...(Array.isArray(options.xAxis) ? {} : options.xAxis),
    },
    yAxis: {
      labels: { style: { color: "#71717A" } },
      gridLineColor: "#E4E4E7",
      ...(Array.isArray(options.yAxis) ? {} : options.yAxis),
    },
    tooltip: {
      backgroundColor: "#FFFFFF",
      borderColor: "#E4E4E7",
      style: { color: "#18181B" },
      ...options.tooltip,
    },
    plotOptions: options.plotOptions,
    series: options.series,
  };

  return (
    <div className={className}>
      <HighchartsReact
        highcharts={Highcharts}
        options={mergedOptions}
        ref={chartRef}
      />
    </div>
  );
}

export const HighchartsWrapper = memo(HighchartsWrapperInner);
