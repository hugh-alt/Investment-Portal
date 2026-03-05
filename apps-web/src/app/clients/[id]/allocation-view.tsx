"use client";

import type { AllocationResult } from "@/lib/allocation";

const fmt = (v: number) =>
  "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pct = (v: number) => (v * 100).toFixed(1) + "%";

const BUCKET_COLORS: Record<string, string> = {
  Growth: "bg-blue-500",
  Defensive: "bg-green-500",
};

export function AllocationView({ allocation }: { allocation: AllocationResult }) {
  if (allocation.totalValue === 0) {
    return <p className="mt-4 text-sm text-zinc-400">No holdings to allocate.</p>;
  }

  return (
    <div className="mt-6">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
        Allocation
      </h2>

      {/* Risk bucket summary bar */}
      <div className="mt-3 flex h-6 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        {allocation.buckets.map((b) => (
          <div
            key={b.riskBucketId}
            className={`${BUCKET_COLORS[b.riskBucketName] ?? "bg-zinc-400"} transition-all`}
            style={{ width: `${b.pctOfTotal * 100}%` }}
            title={`${b.riskBucketName}: ${pct(b.pctOfTotal)}`}
          />
        ))}
        {allocation.unmapped.length > 0 && (
          <div
            className="bg-amber-400 dark:bg-amber-600"
            style={{
              width: `${(allocation.unmapped.reduce((s, u) => s + u.marketValue, 0) / allocation.totalValue) * 100}%`,
            }}
            title="Unmapped"
          />
        )}
      </div>

      {/* Bucket breakdown */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {allocation.buckets.map((b) => (
          <div
            key={b.riskBucketId}
            className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="flex items-baseline justify-between">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                {b.riskBucketName}
              </h3>
              <span className="text-sm text-zinc-500">
                {pct(b.pctOfTotal)} &middot; {fmt(b.totalValue)}
              </span>
            </div>
            <div className="mt-2 flex flex-col gap-1">
              {b.assetClasses.map((ac) => (
                <div key={ac.nodeId} className="flex justify-between text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {ac.nodeName}
                  </span>
                  <span className="text-zinc-900 dark:text-zinc-100">
                    {pct(ac.pctOfTotal)} &middot; {fmt(ac.totalValue)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Unmapped */}
      {allocation.unmapped.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <h3 className="text-sm font-medium text-amber-700 dark:text-amber-300">
            Unmapped holdings ({allocation.unmapped.length})
          </h3>
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            These products have no taxonomy mapping. Ask your admin to assign them.
          </p>
          <div className="mt-2 flex flex-col gap-1">
            {allocation.unmapped.map((u) => (
              <div key={u.productId} className="flex justify-between text-sm">
                <span className="text-amber-700 dark:text-amber-300">
                  {u.productName}
                </span>
                <span className="text-amber-600 dark:text-amber-400">
                  {fmt(u.marketValue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
