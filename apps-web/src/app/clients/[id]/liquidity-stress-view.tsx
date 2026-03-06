"use client";

type HorizonResult = {
  horizonDays: number;
  availableLiquidity: number;
  requiredLiquidity: number;
  coverageRatio: number;
  shortfall: number;
  status: string;
  details: {
    pmCallsWithinHorizon: number;
    bufferRequirement: number;
    extraDemandPct: number;
    extraDemandAmount: number;
    foreignCurrencyCalls: { currency: string; amount: number }[];
  };
};

type Props = {
  scenarioName: string;
  horizons: HorizonResult[];
  hasForeignCurrency: boolean;
};

const fmt = (v: number) =>
  "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const SEVERITY_COLORS: Record<string, string> = {
  OK: "bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-300",
  WARN: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  CRITICAL: "bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export function LiquidityStressView({ scenarioName, horizons, hasForeignCurrency }: Props) {
  if (horizons.length === 0) {
    return <p className="text-sm text-zinc-400">No stress results available. Run a scenario from Governance.</p>;
  }

  return (
    <div>
      <p className="text-xs text-zinc-400">Scenario: {scenarioName}</p>

      {hasForeignCurrency && (
        <p className="mt-1 rounded bg-yellow-50 px-2 py-1 text-xs text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
          Some PM calls are in non-AUD currencies. FX conversion is not modelled — foreign-currency demands are shown separately.
        </p>
      )}

      {/* Coverage cards */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        {horizons.map((h) => (
          <div key={h.horizonDays} className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{h.horizonDays}d</span>
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${SEVERITY_COLORS[h.status]}`}>
                {h.status}
              </span>
            </div>
            <div className="mt-2">
              <p className="text-xs text-zinc-500">Coverage</p>
              <p className={`text-lg font-semibold ${h.status === "CRITICAL" ? "text-red-600 dark:text-red-400" : h.status === "WARN" ? "text-yellow-600 dark:text-yellow-400" : "text-zinc-900 dark:text-zinc-100"}`}>
                {h.coverageRatio >= 999 ? "n/a" : (h.coverageRatio * 100).toFixed(0) + "%"}
              </p>
            </div>
            {h.shortfall > 0 && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                Shortfall: {fmt(h.shortfall)}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Breakdown table */}
      <table className="mt-4 w-full text-left text-xs">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="pb-1 font-medium text-zinc-500">Horizon</th>
            <th className="pb-1 text-right font-medium text-zinc-500">Available (stressed)</th>
            <th className="pb-1 text-right font-medium text-zinc-500">PM Calls</th>
            <th className="pb-1 text-right font-medium text-zinc-500">Buffer</th>
            <th className="pb-1 text-right font-medium text-zinc-500">Extra shock</th>
            <th className="pb-1 text-right font-medium text-zinc-500">Total required</th>
          </tr>
        </thead>
        <tbody>
          {horizons.map((h) => (
            <tr key={h.horizonDays} className="border-b border-zinc-100 dark:border-zinc-800">
              <td className="py-1.5 text-zinc-700 dark:text-zinc-300">{h.horizonDays}d</td>
              <td className="py-1.5 text-right text-zinc-600 dark:text-zinc-400">{fmt(h.availableLiquidity)}</td>
              <td className="py-1.5 text-right text-zinc-600 dark:text-zinc-400">{h.details.pmCallsWithinHorizon > 0 ? fmt(h.details.pmCallsWithinHorizon) : "—"}</td>
              <td className="py-1.5 text-right text-zinc-600 dark:text-zinc-400">{h.details.bufferRequirement > 0 ? fmt(h.details.bufferRequirement) : "—"}</td>
              <td className="py-1.5 text-right text-zinc-600 dark:text-zinc-400">
                {(h.details.extraDemandPct + h.details.extraDemandAmount) > 0
                  ? fmt(h.details.extraDemandPct + h.details.extraDemandAmount)
                  : "—"}
              </td>
              <td className="py-1.5 text-right font-medium text-zinc-900 dark:text-zinc-100">{fmt(h.requiredLiquidity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Foreign currency calls */}
      {horizons.some((h) => h.details.foreignCurrencyCalls.length > 0) && (
        <div className="mt-3">
          <p className="text-xs font-medium text-zinc-500">Non-AUD PM calls (not included in coverage):</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {horizons.flatMap((h) =>
              h.details.foreignCurrencyCalls.map((fc) => (
                <span key={`${h.horizonDays}-${fc.currency}`} className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {fc.currency}: {fmt(fc.amount)} ({h.horizonDays}d)
                </span>
              )),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
