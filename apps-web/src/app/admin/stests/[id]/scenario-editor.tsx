"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import {
  upsertShockAction,
  deleteShockAction,
  runScenarioAction,
  deleteScenarioAction,
} from "@/app/admin/stress-tests/actions";

const pct = (v: number) => (v * 100).toFixed(1) + "%";

type Shock = {
  id: string;
  taxonomyNodeId: string;
  nodeName: string;
  nodeType: string;
  shockPct: number;
};

type Node = {
  id: string;
  label: string;
  nodeType: string;
};

type ResultDetail = {
  details: { nodeName: string; weight: number; shockPct: number; contribution: number; source: string }[];
  unmappedPct: number;
};

type RunResult = {
  runAt: string;
  runBy: string;
  results: {
    clientId: string;
    clientName: string;
    adviserName: string;
    adviserId: string;
    estimatedImpactPct: number;
    details: ResultDetail;
  }[];
};

export function ScenarioEditor({
  scenarioId,
  shocks,
  nodes,
  latestRun,
  advisers,
}: {
  scenarioId: string;
  shocks: Shock[];
  nodes: Node[];
  latestRun: RunResult | null;
  advisers: { id: string; name: string }[];
}) {
  const [shockState, shockAction, shockPending] = useActionState(upsertShockAction, null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [adviserFilter, setAdviserFilter] = useState("ALL");
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setRunError(null);
    const result = await runScenarioAction(scenarioId);
    if (result?.error) setRunError(result.error);
    setRunning(false);
  };

  const handleDeleteShock = async (shockId: string) => {
    await deleteShockAction(scenarioId, shockId);
  };

  const handleDeleteScenario = async () => {
    if (!confirm("Delete this scenario and all its runs?")) return;
    await deleteScenarioAction(scenarioId);
  };

  // Nodes not yet shocked
  const shockedNodeIds = new Set(shocks.map((s) => s.taxonomyNodeId));
  const availableNodes = nodes.filter((n) => !shockedNodeIds.has(n.id));

  const filteredResults = latestRun?.results.filter((r) => {
    if (adviserFilter !== "ALL" && r.adviserId !== adviserFilter) return false;
    return true;
  });

  // Summary stats
  const worstImpact = latestRun
    ? Math.min(...latestRun.results.map((r) => r.estimatedImpactPct))
    : 0;
  const avgImpact = latestRun && latestRun.results.length > 0
    ? latestRun.results.reduce((s, r) => s + r.estimatedImpactPct, 0) / latestRun.results.length
    : 0;
  const avgUnmapped = latestRun && latestRun.results.length > 0
    ? latestRun.results.reduce((s, r) => s + r.details.unmappedPct, 0) / latestRun.results.length
    : 0;

  return (
    <div>
      {/* Shock table */}
      <div className="mt-6">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Shocks
        </h2>

        {shocks.length > 0 ? (
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="pb-2 font-medium text-zinc-500">Node</th>
                <th className="pb-2 font-medium text-zinc-500">Type</th>
                <th className="pb-2 text-right font-medium text-zinc-500">Shock</th>
                <th className="pb-2 font-medium text-zinc-500"></th>
              </tr>
            </thead>
            <tbody>
              {shocks.map((s) => (
                <tr key={s.id} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-2 text-zinc-900 dark:text-zinc-100">{s.nodeName}</td>
                  <td className="py-2 text-xs text-zinc-400">{s.nodeType}</td>
                  <td className={`py-2 text-right font-medium ${s.shockPct < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                    {s.shockPct > 0 ? "+" : ""}{pct(s.shockPct)}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => handleDeleteShock(s.id)}
                      className="text-xs text-zinc-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-3 text-sm text-zinc-400">No shocks defined yet.</p>
        )}

        {/* Add shock form */}
        {availableNodes.length > 0 && (
          <form action={shockAction} className="mt-4 flex items-end gap-3">
            <input type="hidden" name="scenarioId" value={scenarioId} />
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Taxonomy node
              </label>
              <select
                name="taxonomyNodeId"
                required
                className="mt-1 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {availableNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label} ({n.nodeType})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Shock % (e.g. -30 for -30%)
              </label>
              <input
                name="shockPct"
                type="number"
                step="0.01"
                required
                placeholder="-30"
                className="mt-1 w-24 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <button
              type="submit"
              disabled={shockPending}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Add shock
            </button>
          </form>
        )}
        {shockState?.error && (
          <p className="mt-2 text-sm text-red-600">{shockState.error}</p>
        )}
      </div>

      {/* Run button */}
      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={handleRun}
          disabled={running || shocks.length === 0}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {running ? "Running..." : "Run scenario"}
        </button>
        <button
          onClick={handleDeleteScenario}
          className="text-sm text-zinc-400 hover:text-red-600"
        >
          Delete scenario
        </button>
        {runError && <p className="text-sm text-red-600">{runError}</p>}
      </div>

      {/* Results */}
      {latestRun && (
        <div className="mt-8">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
            Latest Results
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            Run at {latestRun.runAt} by {latestRun.runBy}
          </p>

          {/* Summary */}
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Worst impact</p>
              <p className="mt-1 text-xl font-semibold text-red-600 dark:text-red-400">{pct(worstImpact)}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Avg impact</p>
              <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">{pct(avgImpact)}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Avg unmapped</p>
              <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">{pct(avgUnmapped)}</p>
            </div>
          </div>

          {/* Filter */}
          <div className="mt-4 flex items-center gap-4">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">
              Adviser
              <select
                value={adviserFilter}
                onChange={(e) => setAdviserFilter(e.target.value)}
                className="ml-2 rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="ALL">All</option>
                {advisers.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Results table */}
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="pb-2 font-medium text-zinc-500">Client</th>
                <th className="pb-2 font-medium text-zinc-500">Adviser</th>
                <th className="pb-2 text-right font-medium text-zinc-500">Impact</th>
                <th className="pb-2 text-right font-medium text-zinc-500">Unmapped</th>
                <th className="pb-2 font-medium text-zinc-500"></th>
              </tr>
            </thead>
            <tbody>
              {filteredResults?.map((r) => (
                <>
                  <tr
                    key={r.clientId}
                    className="cursor-pointer border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                    onClick={() =>
                      setExpandedClient(
                        expandedClient === r.clientId ? null : r.clientId,
                      )
                    }
                  >
                    <td className="py-2 text-zinc-900 dark:text-zinc-100">
                      {r.clientName}
                    </td>
                    <td className="py-2 text-zinc-600 dark:text-zinc-400">
                      {r.adviserName}
                    </td>
                    <td className={`py-2 text-right font-medium ${r.estimatedImpactPct < -0.1 ? "text-red-600 dark:text-red-400" : r.estimatedImpactPct < 0 ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"}`}>
                      {pct(r.estimatedImpactPct)}
                    </td>
                    <td className="py-2 text-right text-zinc-400">
                      {r.details.unmappedPct > 0 ? pct(r.details.unmappedPct) : "—"}
                    </td>
                    <td className="py-2 text-right">
                      <Link
                        href={`/clients/${r.clientId}`}
                        className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                  {expandedClient === r.clientId && (
                    <tr key={`${r.clientId}-detail`} className="border-b border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
                      <td colSpan={5} className="px-4 py-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-zinc-400">
                              <th className="pb-1 text-left font-medium">Node</th>
                              <th className="pb-1 text-right font-medium">Weight</th>
                              <th className="pb-1 text-right font-medium">Shock</th>
                              <th className="pb-1 text-right font-medium">Contribution</th>
                              <th className="pb-1 text-left font-medium">Source</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.details.details.map((d, i) => (
                              <tr key={i}>
                                <td className="py-0.5 text-zinc-700 dark:text-zinc-300">{d.nodeName}</td>
                                <td className="py-0.5 text-right text-zinc-500">{pct(d.weight)}</td>
                                <td className={`py-0.5 text-right ${d.shockPct < 0 ? "text-red-500" : d.shockPct > 0 ? "text-green-500" : "text-zinc-400"}`}>
                                  {d.shockPct !== 0 ? pct(d.shockPct) : "—"}
                                </td>
                                <td className={`py-0.5 text-right ${d.contribution < 0 ? "text-red-500" : "text-zinc-400"}`}>
                                  {d.contribution !== 0 ? pct(d.contribution) : "—"}
                                </td>
                                <td className="py-0.5 text-zinc-400">{d.source}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6">
        <Link
          href="/admin/stress-tests"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
        >
          Back to scenarios
        </Link>
      </div>
    </div>
  );
}
