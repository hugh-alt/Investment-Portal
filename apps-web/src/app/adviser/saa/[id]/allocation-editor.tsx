"use client";

import { useState, useActionState } from "react";
import { saveAllocationsAction, type SaveAllocState } from "../actions";

type TreeNode = {
  id: string;
  name: string;
  children: { id: string; name: string }[];
};

const pct = (v: number) => (v * 100).toFixed(1);

export function AllocationEditor({
  saaId,
  tree,
  initial,
  initialMin,
  initialMax,
}: {
  saaId: string;
  tree: TreeNode[];
  initial: Record<string, number>;
  initialMin: Record<string, number>;
  initialMax: Record<string, number>;
}) {
  const [weights, setWeights] = useState<Record<string, number>>(initial);
  const [mins, setMins] = useState<Record<string, number>>(initialMin);
  const [maxs, setMaxs] = useState<Record<string, number>>(initialMax);
  const [tolerance, setTolerance] = useState("2.0");
  const [state, action, pending] = useActionState<SaveAllocState, FormData>(
    saveAllocationsAction,
    {},
  );

  const allNodes = tree.flatMap((rb) => rb.children);
  const total = allNodes.reduce((s, n) => s + (weights[n.id] ?? 0), 0);
  const totalValid = Math.abs(total - 1) <= 0.005;

  // Validate min ≤ target ≤ max for each node
  const bandErrors: string[] = [];
  for (const n of allNodes) {
    const t = weights[n.id] ?? 0;
    const lo = mins[n.id] ?? 0;
    const hi = maxs[n.id] ?? 0;
    if (lo > t + 0.0005) bandErrors.push(`${n.name}: min > target`);
    if (hi < t - 0.0005) bandErrors.push(`${n.name}: max < target`);
    if (lo < -0.0005 || hi > 1.0005) bandErrors.push(`${n.name}: out of 0–100% range`);
  }

  const isValid = totalValid && bandErrors.length === 0;

  function handleWeightChange(nodeId: string, value: string) {
    const num = parseFloat(value);
    setWeights((prev) => ({ ...prev, [nodeId]: isNaN(num) ? 0 : num / 100 }));
  }

  function handleMinChange(nodeId: string, value: string) {
    const num = parseFloat(value);
    setMins((prev) => ({ ...prev, [nodeId]: isNaN(num) ? 0 : num / 100 }));
  }

  function handleMaxChange(nodeId: string, value: string) {
    const num = parseFloat(value);
    setMaxs((prev) => ({ ...prev, [nodeId]: isNaN(num) ? 0 : num / 100 }));
  }

  function applyToleranceToAll() {
    const band = parseFloat(tolerance) / 100;
    if (isNaN(band)) return;
    const newMins: Record<string, number> = {};
    const newMaxs: Record<string, number> = {};
    for (const n of allNodes) {
      const t = weights[n.id] ?? 0;
      newMins[n.id] = Math.max(0, t - band);
      newMaxs[n.id] = Math.min(1, t + band);
    }
    setMins(newMins);
    setMaxs(newMaxs);
  }

  const allocations = allNodes
    .filter((n) => (weights[n.id] ?? 0) > 0)
    .map((n) => ({
      nodeId: n.id,
      targetWeight: weights[n.id],
      minWeight: mins[n.id] ?? 0,
      maxWeight: maxs[n.id] ?? 0,
    }));

  return (
    <div className="mt-6">
      {/* Default tolerance band control */}
      <div className="mb-4 flex items-end gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <label
            htmlFor="tolerance"
            className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Default tolerance band
          </label>
          <div className="mt-1 flex items-center gap-1">
            <span className="text-sm text-zinc-500">±</span>
            <input
              id="tolerance"
              type="number"
              step="0.5"
              min="0"
              max="50"
              value={tolerance}
              onChange={(e) => setTolerance(e.target.value)}
              className="w-16 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <span className="text-sm text-zinc-500">%</span>
          </div>
        </div>
        <button
          type="button"
          onClick={applyToleranceToAll}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Apply to all
        </button>
      </div>

      <form action={action}>
        <input type="hidden" name="saaId" value={saaId} />
        <input
          type="hidden"
          name="allocations"
          value={JSON.stringify(allocations)}
        />

        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
                <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
                  Asset Class
                </th>
                <th className="w-24 px-2 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">
                  Min (%)
                </th>
                <th className="w-24 px-2 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">
                  Target (%)
                </th>
                <th className="w-24 px-2 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">
                  Max (%)
                </th>
              </tr>
            </thead>
            <tbody>
              {tree.map((rb) => (
                <RiskBucketGroup
                  key={rb.id}
                  bucket={rb}
                  weights={weights}
                  mins={mins}
                  maxs={maxs}
                  onWeightChange={handleWeightChange}
                  onMinChange={handleMinChange}
                  onMaxChange={handleMaxChange}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                  Total
                </td>
                <td className="px-2 py-3" />
                <td
                  className={`px-2 py-3 text-right font-medium ${
                    totalValid
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {pct(total)}%
                </td>
                <td className="px-2 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>

        {!totalValid && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            Weights must sum to 100% (currently {pct(total)}%)
          </p>
        )}

        {bandErrors.length > 0 && (
          <div className="mt-2 text-sm text-red-600 dark:text-red-400">
            {bandErrors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        )}

        {state.error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}

        {state.success && (
          <p className="mt-2 text-sm text-green-600 dark:text-green-400">
            Allocations saved.
          </p>
        )}

        <button
          type="submit"
          disabled={pending || !isValid}
          className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Saving..." : "Save Allocations"}
        </button>
      </form>
    </div>
  );
}

function RiskBucketGroup({
  bucket,
  weights,
  mins,
  maxs,
  onWeightChange,
  onMinChange,
  onMaxChange,
}: {
  bucket: TreeNode;
  weights: Record<string, number>;
  mins: Record<string, number>;
  maxs: Record<string, number>;
  onWeightChange: (nodeId: string, value: string) => void;
  onMinChange: (nodeId: string, value: string) => void;
  onMaxChange: (nodeId: string, value: string) => void;
}) {
  const bucketTotal = bucket.children.reduce(
    (s, c) => s + (weights[c.id] ?? 0),
    0,
  );

  return (
    <>
      <tr className="border-b border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
        <td className="px-4 py-2 font-medium text-zinc-900 dark:text-zinc-100">
          {bucket.name}
        </td>
        <td className="px-2 py-2" />
        <td className="px-2 py-2 text-right text-sm text-zinc-500">
          {pct(bucketTotal)}%
        </td>
        <td className="px-2 py-2" />
      </tr>
      {bucket.children.map((child) => (
        <tr
          key={child.id}
          className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
        >
          <td className="py-2 pl-8 pr-4 text-zinc-600 dark:text-zinc-400">
            {child.name}
          </td>
          <td className="px-2 py-2 text-right">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={pct(mins[child.id] ?? 0)}
              onChange={(e) => onMinChange(child.id, e.target.value)}
              className="w-20 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </td>
          <td className="px-2 py-2 text-right">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={pct(weights[child.id] ?? 0)}
              onChange={(e) => onWeightChange(child.id, e.target.value)}
              className="w-20 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </td>
          <td className="px-2 py-2 text-right">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={pct(maxs[child.id] ?? 0)}
              onChange={(e) => onMaxChange(child.id, e.target.value)}
              className="w-20 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </td>
        </tr>
      ))}
    </>
  );
}
