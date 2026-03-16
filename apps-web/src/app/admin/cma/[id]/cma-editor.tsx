"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  upsertAssumptionAction,
  deleteAssumptionAction,
  setDefaultCMASetAction,
  deleteCMASetAction,
  updateRiskFreeRateAction,
  updateCMASetStatusWithValidationAction,
} from "@/app/admin/cma/actions";
import { CorrelationEditor } from "./correlation-editor";
import type { CorrelationEntry } from "@/lib/cma";

const pct = (v: number) => (v * 100).toFixed(1) + "%";

type Assumption = {
  id: string;
  taxonomyNodeId: string;
  nodeName: string;
  nodeType: string;
  expReturnPct: number;
  volPct: number;
  incomeYieldPct: number;
};

type Node = {
  id: string;
  label: string;
  nodeType: string;
};

export function CMASetEditor({
  cmaSetId,
  isDefault,
  status,
  assumptions,
  nodes,
  riskFreeRatePct,
  correlations,
}: {
  cmaSetId: string;
  isDefault: boolean;
  status: string;
  assumptions: Assumption[];
  nodes: Node[];
  riskFreeRatePct: number;
  correlations: CorrelationEntry[];
}) {
  const [state, formAction, pending] = useActionState(upsertAssumptionAction, null);
  const [rfRate, setRfRate] = useState((riskFreeRatePct * 100).toFixed(1));
  const [statusError, setStatusError] = useState<string | null>(null);

  const handleDelete = async (assumptionId: string) => {
    await deleteAssumptionAction(cmaSetId, assumptionId);
  };

  const handleSetDefault = async () => {
    await setDefaultCMASetAction(cmaSetId);
  };

  const handleDeleteSet = async () => {
    if (!confirm("Delete this CMA set and all assumptions?")) return;
    await deleteCMASetAction(cmaSetId);
  };

  const handleRfRateChange = async () => {
    const val = parseFloat(rfRate);
    if (!isNaN(val)) {
      await updateRiskFreeRateAction(cmaSetId, val);
    }
  };

  const assignedNodeIds = new Set(assumptions.map((a) => a.taxonomyNodeId));
  const availableNodes = nodes.filter((n) => !assignedNodeIds.has(n.id));

  return (
    <div>
      {/* Risk-free rate */}
      <div className="mt-4 flex items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Risk-free rate %
          </label>
          <input
            type="number"
            step="0.1"
            value={rfRate}
            onChange={(e) => setRfRate(e.target.value)}
            className="mt-1 w-24 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <button
          onClick={handleRfRateChange}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Update
        </button>
        <span className="text-xs text-zinc-400">Used for Sharpe ratio calculation</span>
      </div>

      {/* Assumptions table */}
      <div className="mt-6">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Assumptions
        </h2>

        {assumptions.length > 0 ? (
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="pb-2 font-medium text-zinc-500">Node</th>
                <th className="pb-2 font-medium text-zinc-500">Type</th>
                <th className="pb-2 text-right font-medium text-zinc-500">Exp. Return</th>
                <th className="pb-2 text-right font-medium text-zinc-500">Volatility</th>
                <th className="pb-2 text-right font-medium text-zinc-500">Income Yield</th>
                <th className="pb-2 font-medium text-zinc-500"></th>
              </tr>
            </thead>
            <tbody>
              {assumptions.map((a) => (
                <tr key={a.id} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-2 text-zinc-900 dark:text-zinc-100">{a.nodeName}</td>
                  <td className="py-2 text-xs text-zinc-400">{a.nodeType}</td>
                  <td className="py-2 text-right font-medium text-zinc-900 dark:text-zinc-100">
                    {pct(a.expReturnPct)}
                  </td>
                  <td className="py-2 text-right text-zinc-600 dark:text-zinc-400">
                    {pct(a.volPct)}
                  </td>
                  <td className="py-2 text-right text-zinc-600 dark:text-zinc-400">
                    {pct(a.incomeYieldPct)}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => handleDelete(a.id)}
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
          <p className="mt-3 text-sm text-zinc-400">No assumptions defined yet.</p>
        )}

        {/* Add assumption form */}
        {availableNodes.length > 0 && (
          <form action={formAction} className="mt-4 flex items-end gap-3">
            <input type="hidden" name="cmaSetId" value={cmaSetId} />
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
                Exp. Return %
              </label>
              <input
                name="expReturnPct"
                type="number"
                step="0.1"
                required
                placeholder="8.0"
                className="mt-1 w-20 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Volatility %
              </label>
              <input
                name="volPct"
                type="number"
                step="0.1"
                required
                placeholder="16.0"
                className="mt-1 w-20 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Income %
              </label>
              <input
                name="incomeYieldPct"
                type="number"
                step="0.1"
                placeholder="3.0"
                className="mt-1 w-20 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Add
            </button>
          </form>
        )}
        {state?.error && (
          <p className="mt-2 text-sm text-red-600">{state.error}</p>
        )}
      </div>

      {/* Correlations */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Correlation Matrix
        </h2>
        <p className="mt-1 text-xs text-zinc-400">
          Define pairwise correlations between asset classes. Missing pairs default to 0.
        </p>
        <CorrelationEditor
          cmaSetId={cmaSetId}
          nodes={assumptions.map((a) => ({
            id: a.taxonomyNodeId,
            label: a.nodeName,
          }))}
          initialCorrelations={correlations}
        />
      </div>

      {/* Status change with PSD validation */}
      {status !== "ACTIVE" && (
        <div className="mt-6">
          <button
            onClick={async () => {
              setStatusError(null);
              const result = await updateCMASetStatusWithValidationAction(cmaSetId, "ACTIVE");
              if (result.error) setStatusError(result.error);
            }}
            className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600"
          >
            Set as ACTIVE
          </button>
          {statusError && (
            <p className="mt-1 text-xs text-red-600">{statusError}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex items-center gap-4">
        {!isDefault && (
          <button
            onClick={handleSetDefault}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Set as firm default
          </button>
        )}
        <button
          onClick={handleDeleteSet}
          className="text-sm text-zinc-400 hover:text-red-600"
        >
          Delete CMA set
        </button>
      </div>

      <div className="mt-6">
        <Link
          href="/admin/cma"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
        >
          Back to CMA sets
        </Link>
      </div>
    </div>
  );
}
