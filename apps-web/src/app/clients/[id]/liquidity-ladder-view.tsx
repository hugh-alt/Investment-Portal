"use client";

import type { LadderBucket } from "@/lib/liquidity-profile";

const pct = (v: number) => (v * 100).toFixed(1) + "%";
const fmt = (v: number) =>
  "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const SOURCE_COLORS: Record<string, string> = {
  PRODUCT_OVERRIDE: "bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  TAXONOMY_DEFAULT: "bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-300",
  ASSUMED: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
};

type ExposureRow = {
  productId: string;
  productName: string;
  marketValue: number;
  profile: {
    tier: string;
    horizonDays: number;
    stressedHaircutPct: number;
    gateOrSuspendRisk: boolean;
    source: string;
  };
};

function tierLabel(tier: string, horizonDays: number): string {
  if (tier === "LOCKED") return `Locked ${horizonDays}d`;
  return tier;
}

export function LiquidityLadderView({
  buckets,
  totalPortfolioValue,
  assumedCount,
  gatedCount,
  exposures,
}: {
  buckets: LadderBucket[];
  totalPortfolioValue: number;
  assumedCount: number;
  gatedCount: number;
  exposures: ExposureRow[];
}) {
  if (buckets.length === 0) {
    return <p className="text-sm text-zinc-400">No holdings to analyze.</p>;
  }

  return (
    <div>
      {assumedCount > 0 && (
        <p className="mb-3 rounded bg-yellow-50 px-3 py-2 text-sm text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
          {assumedCount} product{assumedCount > 1 ? "s" : ""} using assumed liquidity profile (no override or taxonomy default found).
        </p>
      )}

      {gatedCount > 0 && (
        <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900 dark:text-red-300">
          {gatedCount} product{gatedCount > 1 ? "s" : ""} flagged as Gated/Suspendable — redemption may be restricted.
        </p>
      )}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="pb-2 font-medium text-zinc-500">Horizon</th>
            <th className="pb-2 text-right font-medium text-zinc-500">Gross value</th>
            <th className="pb-2 text-right font-medium text-zinc-500">Stressed value</th>
            <th className="pb-2 text-right font-medium text-zinc-500">% of portfolio</th>
            <th className="pb-2 text-right font-medium text-zinc-500">Cumulative</th>
            <th className="pb-2 text-right font-medium text-zinc-500">Cum. %</th>
            <th className="pb-2 text-right font-medium text-zinc-500">Gated</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.horizonLabel} className="border-b border-zinc-100 dark:border-zinc-800">
              <td className="py-2 font-medium text-zinc-900 dark:text-zinc-100">
                {b.horizonLabel}
              </td>
              <td className="py-2 text-right text-zinc-600 dark:text-zinc-400">
                {fmt(b.grossValue)}
              </td>
              <td className="py-2 text-right text-zinc-600 dark:text-zinc-400">
                {fmt(b.stressedValue)}
              </td>
              <td className="py-2 text-right text-zinc-600 dark:text-zinc-400">
                {pct(b.pctOfPortfolio)}
              </td>
              <td className="py-2 text-right font-medium text-zinc-900 dark:text-zinc-100">
                {fmt(b.cumulativeStressedValue)}
              </td>
              <td className="py-2 text-right font-medium text-zinc-900 dark:text-zinc-100">
                {pct(b.cumulativePct)}
              </td>
              <td className="py-2 text-right">
                {b.gatedCount > 0 ? (
                  <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900 dark:text-red-300">
                    {b.gatedCount}
                  </span>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-zinc-300 dark:border-zinc-700">
            <td className="py-2 font-medium text-zinc-900 dark:text-zinc-100">Total</td>
            <td className="py-2 text-right font-medium text-zinc-900 dark:text-zinc-100">
              {fmt(totalPortfolioValue)}
            </td>
            <td colSpan={5} />
          </tr>
        </tfoot>
      </table>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200">
          Exposure detail ({exposures.length} products)
        </summary>
        <table className="mt-2 w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="pb-1 font-medium text-zinc-500">Product</th>
              <th className="pb-1 text-right font-medium text-zinc-500">Value</th>
              <th className="pb-1 font-medium text-zinc-500">Tier</th>
              <th className="pb-1 text-right font-medium text-zinc-500">Horizon</th>
              <th className="pb-1 text-right font-medium text-zinc-500">Haircut</th>
              <th className="pb-1 font-medium text-zinc-500">Source</th>
              <th className="pb-1 font-medium text-zinc-500">Risk</th>
            </tr>
          </thead>
          <tbody>
            {exposures.map((e) => (
              <tr key={e.productId} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="py-1 text-zinc-900 dark:text-zinc-100">{e.productName}</td>
                <td className="py-1 text-right text-zinc-600 dark:text-zinc-400">{fmt(e.marketValue)}</td>
                <td className="py-1 text-zinc-600 dark:text-zinc-400">
                  {tierLabel(e.profile.tier, e.profile.horizonDays)}
                </td>
                <td className="py-1 text-right text-zinc-600 dark:text-zinc-400">{e.profile.horizonDays}d</td>
                <td className="py-1 text-right text-zinc-600 dark:text-zinc-400">{pct(e.profile.stressedHaircutPct)}</td>
                <td className="py-1">
                  <span className={`rounded px-1 py-0.5 text-xs ${SOURCE_COLORS[e.profile.source] ?? ""}`}>
                    {e.profile.source === "PRODUCT_OVERRIDE" ? "Override" : e.profile.source === "TAXONOMY_DEFAULT" ? "Taxonomy" : "Assumed"}
                  </span>
                </td>
                <td className="py-1">
                  {e.profile.gateOrSuspendRisk && (
                    <span className="rounded bg-red-50 px-1 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900 dark:text-red-300">
                      Gated/Suspendable
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
