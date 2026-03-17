"use client";

import type { DriftResult } from "@/lib/drift";
import { useTabSwitch } from "./client-tabs";

const pct = (v: number) => (v * 100).toFixed(1) + "%";

export function DriftBreachSummary({ drift }: { drift: DriftResult | null }) {
  const switchTab = useTabSwitch();

  if (!drift) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-zinc-700">Drift Summary</h3>
        </div>
        <p className="text-sm text-zinc-400">No SAA assigned. Assign one in the SAA tab to see drift analysis.</p>
        {switchTab && (
          <button onClick={() => switchTab("saa")} className="mt-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 cursor-pointer">
            Go to SAA tab &rarr;
          </button>
        )}
      </div>
    );
  }

  const breaches = drift.rows.filter((r) => r.toleranceStatus !== "within");

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-zinc-700">Drift Summary</h3>
        {switchTab && (
          <button onClick={() => switchTab("saa")} className="text-xs font-medium text-zinc-500 hover:text-zinc-900 cursor-pointer">
            View full drift report &rarr;
          </button>
        )}
      </div>

      {breaches.length === 0 ? (
        <div className="flex items-center gap-2 py-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-xs">&#x2713;</span>
          <p className="text-sm text-emerald-700 font-medium">No drift breaches</p>
          <p className="text-xs text-zinc-400 ml-2">All allocations are within tolerance bands.</p>
        </div>
      ) : (
        <div>
          <p className="text-xs text-zinc-500 mb-2">
            {breaches.length} allocation{breaches.length !== 1 ? "s" : ""} outside permitted range
          </p>
          <div className="overflow-hidden rounded-lg border border-zinc-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">Asset Class</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">Current</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">Range</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">Drift</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-zinc-500">Issue</th>
                </tr>
              </thead>
              <tbody>
                {breaches.map((r) => (
                  <tr key={r.nodeId} className="border-b border-zinc-100 last:border-0">
                    <td className="px-3 py-2">
                      <span className="text-zinc-900 font-medium">{r.nodeName}</span>
                      {r.riskBucketName && <span className="text-xs text-zinc-400 ml-1">({r.riskBucketName})</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-600">{pct(r.currentWeight)}</td>
                    <td className="px-3 py-2 text-right text-xs text-zinc-400">{pct(r.minWeight)}–{pct(r.maxWeight)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${r.drift > 0 ? "text-red-600" : "text-blue-600"}`}>
                      {r.drift > 0 ? "+" : ""}{pct(r.drift)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        r.toleranceStatus === "above_max" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
                      }`}>
                        {r.toleranceStatus === "above_max" ? "Over" : "Under"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
