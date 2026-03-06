"use client";

import { useState, useTransition } from "react";
import { setClientCMASelectionAction } from "./actions";
import type { CMAResult } from "@/lib/cma";

type CMASetOption = {
  id: string;
  name: string;
  status: string;
  isDefault: boolean;
};

type Props = {
  clientId: string;
  selectedCmaSetId: string | null;
  activeCmaSets: CMASetOption[];
  portfolioResult: CMAResult;
  saaResult: CMAResult | null;
  saaName: string | null;
  cmaSetName: string;
  compareResult: CMAResult | null;
  compareCmaSetName: string | null;
  compareSaaResult: CMAResult | null;
};

const pctFmt = (v: number) => (v * 100).toFixed(1) + "%";

function OutcomeCard({
  title,
  result,
  weightLabel,
}: {
  title: string;
  result: CMAResult;
  weightLabel: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {title}
      </h3>
      <div className="mt-3 flex gap-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Exp. Return</p>
          <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            {pctFmt(result.expectedReturnPct)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Risk (vol)</p>
          <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            {pctFmt(result.riskProxyPct)}
          </p>
        </div>
      </div>
      {result.missingCoveragePct > 0.005 && (
        <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
          Missing CMA coverage: {pctFmt(result.missingCoveragePct)}
        </p>
      )}
      <table className="mt-3 w-full text-xs">
        <thead>
          <tr className="text-zinc-400">
            <th className="pb-1 text-left font-medium">Node</th>
            <th className="pb-1 text-right font-medium">{weightLabel}</th>
            <th className="pb-1 text-right font-medium">Return</th>
            <th className="pb-1 text-right font-medium">Vol</th>
          </tr>
        </thead>
        <tbody>
          {result.details.map((d) => (
            <tr key={d.nodeId}>
              <td className={`py-0.5 ${d.hasCMA ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400 italic"}`}>
                {d.nodeName}{!d.hasCMA && " *"}
              </td>
              <td className="py-0.5 text-right text-zinc-500">{pctFmt(d.weight)}</td>
              <td className="py-0.5 text-right text-zinc-500">{d.hasCMA ? pctFmt(d.expReturnPct) : "—"}</td>
              <td className="py-0.5 text-right text-zinc-500">{d.hasCMA ? pctFmt(d.volPct) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ExpectedOutcomesView({
  clientId,
  selectedCmaSetId,
  activeCmaSets,
  portfolioResult,
  saaResult,
  saaName,
  cmaSetName,
  compareResult,
  compareCmaSetName,
  compareSaaResult,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [showCompare, setShowCompare] = useState(!!compareResult);

  const handleCmaChange = (cmaSetId: string) => {
    const value = cmaSetId === "__default__" ? null : cmaSetId;
    startTransition(async () => {
      await setClientCMASelectionAction(clientId, value);
    });
  };

  const defaultSet = activeCmaSets.find((s) => s.isDefault);

  return (
    <div>
      {/* CMA selector */}
      <div className="mt-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            CMA Case:
          </label>
          <select
            value={selectedCmaSetId ?? "__default__"}
            onChange={(e) => handleCmaChange(e.target.value)}
            disabled={isPending}
            className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="__default__">
              {defaultSet ? `${defaultSet.name} (firm default)` : "Firm default"}
            </option>
            {activeCmaSets
              .filter((s) => !s.isDefault)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </div>
        {defaultSet && selectedCmaSetId && (
          <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={showCompare}
              onChange={(e) => setShowCompare(e.target.checked)}
              className="rounded border-zinc-300"
            />
            Compare with firm default
          </label>
        )}
        {isPending && <span className="text-xs text-zinc-400">Updating...</span>}
      </div>

      <p className="mt-2 text-xs text-zinc-400">
        Based on: {cmaSetName}
      </p>

      {/* Primary results */}
      <div className={`mt-3 grid gap-4 ${saaResult ? "grid-cols-2" : "grid-cols-1"}`}>
        <OutcomeCard title="Current Portfolio" result={portfolioResult} weightLabel="Weight" />
        {saaResult && (
          <OutcomeCard title={`SAA: ${saaName}`} result={saaResult} weightLabel="Target" />
        )}
      </div>

      {/* Compare results */}
      {showCompare && compareResult && compareCmaSetName && (
        <div className="mt-4">
          <p className="text-xs font-medium text-zinc-500">
            Comparison: {compareCmaSetName} (firm default)
          </p>
          <div className={`mt-2 grid gap-4 ${compareSaaResult ? "grid-cols-2" : "grid-cols-1"}`}>
            <OutcomeCard title="Current Portfolio" result={compareResult} weightLabel="Weight" />
            {compareSaaResult && (
              <OutcomeCard title={`SAA: ${saaName}`} result={compareSaaResult} weightLabel="Target" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
