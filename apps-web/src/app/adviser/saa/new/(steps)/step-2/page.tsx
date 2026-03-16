"use client";

import { useState, useEffect } from "react";
import { useSAAWizard } from "../../wizard-context";
import { loadTaxonomyTree, type TaxonomyTree } from "../../wizard-actions";

const pct = (v: number) => (v * 100).toFixed(1);

export default function Step2Page() {
  const { data, update } = useSAAWizard();
  const [tree, setTree] = useState<TaxonomyTree>([]);
  const [loading, setLoading] = useState(true);

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
        Please complete Step 1 first to create the SAA draft.
      </p>
    );
  }

  if (loading) {
    return <p className="text-sm text-zinc-400">Loading taxonomy tree...</p>;
  }

  const allNodes = tree.flatMap((rb) => rb.children);
  const total = allNodes.reduce((s, n) => s + (data.weights[n.id] ?? 0), 0);
  const totalValid = Math.abs(total - 1) <= 0.005;

  function handleWeightChange(nodeId: string, value: string) {
    const num = parseFloat(value);
    const w = isNaN(num) ? 0 : num / 100;
    update({ weights: { ...data.weights, [nodeId]: w } });
  }

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-zinc-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-100">
              <th className="px-4 py-3 text-left font-medium text-zinc-600">
                Asset Class
              </th>
              <th className="w-32 px-2 py-3 text-right font-medium text-zinc-600">
                Target (%)
              </th>
            </tr>
          </thead>
          <tbody>
            {tree.map((rb) => {
              const bucketTotal = rb.children.reduce(
                (s, c) => s + (data.weights[c.id] ?? 0),
                0,
              );
              return (
                <BucketGroup
                  key={rb.id}
                  bucket={rb}
                  bucketTotal={bucketTotal}
                  weights={data.weights}
                  onWeightChange={handleWeightChange}
                />
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-zinc-200 bg-zinc-50">
              <td className="px-4 py-3 font-medium text-zinc-900">Total</td>
              <td
                className={`px-2 py-3 text-right font-medium ${
                  totalValid ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {pct(total)}%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {!totalValid && total > 0 && (
        <p className="mt-2 text-sm text-red-600">
          Weights must sum to 100% (currently {pct(total)}%)
        </p>
      )}
    </div>
  );
}

function BucketGroup({
  bucket,
  bucketTotal,
  weights,
  onWeightChange,
}: {
  bucket: TaxonomyTree[number];
  bucketTotal: number;
  weights: Record<string, number>;
  onWeightChange: (nodeId: string, value: string) => void;
}) {
  return (
    <>
      <tr className="border-b border-zinc-100 bg-zinc-50">
        <td className="px-4 py-2 font-medium text-zinc-900">
          {bucket.name}
        </td>
        <td className="px-2 py-2 text-right text-sm text-zinc-500">
          {pct(bucketTotal)}%
        </td>
      </tr>
      {bucket.children.map((child) => (
        <tr key={child.id} className="border-b border-zinc-100 last:border-0">
          <td className="py-2 pl-8 pr-4 text-zinc-600">{child.name}</td>
          <td className="px-2 py-2 text-right">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={pct(weights[child.id] ?? 0)}
              onChange={(e) => onWeightChange(child.id, e.target.value)}
              className="w-24 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </td>
        </tr>
      ))}
    </>
  );
}
