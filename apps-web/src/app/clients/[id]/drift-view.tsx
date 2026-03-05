"use client";

import type { DriftResult } from "@/lib/drift";

const pct = (v: number) => (v * 100).toFixed(1) + "%";

const driftColor = (drift: number) => {
  const abs = Math.abs(drift);
  if (abs < 0.02) return "text-zinc-600 dark:text-zinc-400";
  if (drift > 0) return "text-red-600 dark:text-red-400";
  return "text-blue-600 dark:text-blue-400";
};

export function DriftView({ drift }: { drift: DriftResult }) {
  if (drift.rows.length === 0) {
    return <p className="mt-2 text-sm text-zinc-400">No drift data.</p>;
  }

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
            <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
              Asset Class
            </th>
            <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">
              Current
            </th>
            <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">
              Target
            </th>
            <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">
              Range
            </th>
            <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">
              Drift
            </th>
            <th className="w-16 px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {drift.rows.map((r) => (
            <tr
              key={r.nodeId}
              className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
            >
              <td className="px-4 py-2">
                <div className="text-zinc-900 dark:text-zinc-100">
                  {r.nodeName}
                </div>
                {r.riskBucketName && (
                  <div className="text-xs text-zinc-400">
                    {r.riskBucketName}
                  </div>
                )}
              </td>
              <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400">
                {pct(r.currentWeight)}
              </td>
              <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400">
                {pct(r.targetWeight)}
              </td>
              <td className="px-4 py-2 text-right text-xs text-zinc-500">
                {pct(r.minWeight)}–{pct(r.maxWeight)}
              </td>
              <td className={`px-4 py-2 text-right font-medium ${driftColor(r.drift)}`}>
                {r.drift > 0 ? "+" : ""}
                {pct(r.drift)}
              </td>
              <td className="px-4 py-2 text-center">
                {r.toleranceStatus === "within" ? (
                  <span title="Within tolerance">&#x2705;</span>
                ) : (
                  <span
                    className="cursor-help"
                    title={r.toleranceStatus === "below_min" ? "Below minimum" : "Above maximum"}
                  >
                    &#x26A0;&#xFE0F;
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
            <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
              Total
            </td>
            <td className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">
              {pct(drift.totalCurrentWeight)}
            </td>
            <td className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">
              {pct(drift.totalTargetWeight)}
            </td>
            <td className="px-4 py-3" />
            <td className="px-4 py-3 text-right font-medium text-zinc-500">
              max {pct(drift.maxAbsDrift)}
            </td>
            <td className="px-4 py-3 text-center text-xs text-zinc-500">
              {drift.breachCount > 0 ? (
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  {drift.breachCount} breach{drift.breachCount > 1 ? "es" : ""}
                </span>
              ) : (
                <span className="text-green-600 dark:text-green-400">OK</span>
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
