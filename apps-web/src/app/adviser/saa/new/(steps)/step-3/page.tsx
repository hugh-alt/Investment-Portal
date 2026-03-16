"use client";

import { useState, useEffect } from "react";
import { useSAAWizard } from "../../wizard-context";
import {
  loadTaxonomyTree,
  saveWizardAllocationsAction,
  type TaxonomyTree,
} from "../../wizard-actions";

const pct = (v: number) => (v * 100).toFixed(1);

export default function Step3Page() {
  const { data, update } = useSAAWizard();
  const [tree, setTree] = useState<TaxonomyTree>([]);
  const [loading, setLoading] = useState(true);
  const [tolerance, setTolerance] = useState("2.0");
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ error?: string; success?: boolean } | null>(null);

  useEffect(() => {
    if (!data.taxonomyId) return;
    loadTaxonomyTree(data.taxonomyId).then((t) => {
      setTree(t);
      setLoading(false);
    });
  }, [data.taxonomyId]);

  if (!data.saaId) {
    return (
      <p className="text-sm text-zinc-500">
        Please complete Step 1 first.
      </p>
    );
  }

  if (loading) {
    return <p className="text-sm text-zinc-400">Loading...</p>;
  }

  const allNodes = tree.flatMap((rb) => rb.children);

  // Validation
  const bandErrors: string[] = [];
  for (const n of allNodes) {
    const t = data.weights[n.id] ?? 0;
    if (t === 0) continue;
    const lo = data.mins[n.id] ?? 0;
    const hi = data.maxs[n.id] ?? 0;
    if (lo > t + 0.0005) bandErrors.push(`${n.name}: min > target`);
    if (hi < t - 0.0005) bandErrors.push(`${n.name}: max < target`);
    if (lo < -0.0005 || hi > 1.0005) bandErrors.push(`${n.name}: out of 0-100% range`);
  }

  function applyToleranceToAll() {
    const band = parseFloat(tolerance) / 100;
    if (isNaN(band)) return;
    const newMins: Record<string, number> = {};
    const newMaxs: Record<string, number> = {};
    for (const n of allNodes) {
      const t = data.weights[n.id] ?? 0;
      newMins[n.id] = Math.max(0, t - band);
      newMaxs[n.id] = Math.min(1, t + band);
    }
    update({ mins: newMins, maxs: newMaxs });
  }

  function handleMinChange(nodeId: string, value: string) {
    const num = parseFloat(value);
    update({ mins: { ...data.mins, [nodeId]: isNaN(num) ? 0 : num / 100 } });
  }

  function handleMaxChange(nodeId: string, value: string) {
    const num = parseFloat(value);
    update({ maxs: { ...data.maxs, [nodeId]: isNaN(num) ? 0 : num / 100 } });
  }

  async function handleSave() {
    setSaving(true);
    setSaveResult(null);
    const allocations = allNodes
      .filter((n) => (data.weights[n.id] ?? 0) > 0)
      .map((n) => ({
        nodeId: n.id,
        targetWeight: data.weights[n.id],
        minWeight: data.mins[n.id] ?? 0,
        maxWeight: data.maxs[n.id] ?? 0,
      }));

    const result = await saveWizardAllocationsAction(data.saaId, allocations);
    setSaving(false);
    setSaveResult(result);
  }

  return (
    <div>
      {/* Tolerance band control */}
      <div className="mb-4 flex items-end gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
        <div>
          <label htmlFor="tolerance-band" className="block text-xs font-medium text-zinc-600">
            Global tolerance band
          </label>
          <div className="mt-1 flex items-center gap-1">
            <span className="text-sm text-zinc-500">&#177;</span>
            <input
              id="tolerance-band"
              type="number"
              step="0.5"
              min="0"
              max="50"
              value={tolerance}
              onChange={(e) => setTolerance(e.target.value)}
              className="w-16 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-sm text-zinc-900 focus:border-amber-500 focus:outline-none"
            />
            <span className="text-sm text-zinc-500">%</span>
          </div>
        </div>
        <button
          type="button"
          onClick={applyToleranceToAll}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
        >
          Apply to all
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-zinc-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-100">
              <th className="px-4 py-3 text-left font-medium text-zinc-600">Asset Class</th>
              <th className="w-24 px-2 py-3 text-right font-medium text-zinc-600">Min (%)</th>
              <th className="w-24 px-2 py-3 text-right font-medium text-zinc-600">Target (%)</th>
              <th className="w-24 px-2 py-3 text-right font-medium text-zinc-600">Max (%)</th>
            </tr>
          </thead>
          <tbody>
            {tree.map((rb) => (
              <ToleranceBucketGroup
                key={rb.id}
                bucket={rb}
                weights={data.weights}
                mins={data.mins}
                maxs={data.maxs}
                onMinChange={handleMinChange}
                onMaxChange={handleMaxChange}
              />
            ))}
          </tbody>
        </table>
      </div>

      {bandErrors.length > 0 && (
        <div className="mt-2 text-sm text-red-600">
          {bandErrors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </div>
      )}

      {/* Save button */}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || bandErrors.length > 0}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors disabled:bg-zinc-300 disabled:text-zinc-500 cursor-pointer disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save Allocations"}
        </button>

        {saveResult?.success && (
          <p className="text-sm text-emerald-600">Saved. Click Next to assign clients.</p>
        )}
        {saveResult?.error && (
          <p className="text-sm text-red-600">{saveResult.error}</p>
        )}
      </div>
    </div>
  );
}

function ToleranceBucketGroup({
  bucket,
  weights,
  mins,
  maxs,
  onMinChange,
  onMaxChange,
}: {
  bucket: TaxonomyTree[number];
  weights: Record<string, number>;
  mins: Record<string, number>;
  maxs: Record<string, number>;
  onMinChange: (nodeId: string, value: string) => void;
  onMaxChange: (nodeId: string, value: string) => void;
}) {
  const bucketTotal = bucket.children.reduce(
    (s, c) => s + (weights[c.id] ?? 0),
    0,
  );

  return (
    <>
      <tr className="border-b border-zinc-100 bg-zinc-50">
        <td className="px-4 py-2 font-medium text-zinc-900">{bucket.name}</td>
        <td className="px-2 py-2" />
        <td className="px-2 py-2 text-right text-sm text-zinc-500">{pct(bucketTotal)}%</td>
        <td className="px-2 py-2" />
      </tr>
      {bucket.children.map((child) => {
        const t = weights[child.id] ?? 0;
        if (t === 0) return null;
        return (
          <tr key={child.id} className="border-b border-zinc-100 last:border-0">
            <td className="py-2 pl-8 pr-4 text-zinc-600">{child.name}</td>
            <td className="px-2 py-2 text-right">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={pct(mins[child.id] ?? 0)}
                onChange={(e) => onMinChange(child.id, e.target.value)}
                className="w-20 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-sm text-zinc-900 focus:border-amber-500 focus:outline-none"
              />
            </td>
            <td className="px-2 py-2 text-right text-zinc-500">
              {pct(t)}%
            </td>
            <td className="px-2 py-2 text-right">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={pct(maxs[child.id] ?? 0)}
                onChange={(e) => onMaxChange(child.id, e.target.value)}
                className="w-20 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-sm text-zinc-900 focus:border-amber-500 focus:outline-none"
              />
            </td>
          </tr>
        );
      })}
    </>
  );
}
