"use client";

import { useTransition } from "react";
import {
  setTaxonomyLiquidityDefaultAction,
  removeTaxonomyLiquidityDefaultAction,
} from "./actions";

type NodeData = {
  id: string;
  name: string;
  nodeType: string;
  parentId: string | null;
  currentDefault: {
    tier: string;
    horizonDays: number;
    stressedHaircutPct: number;
  } | null;
};

const TIERS = [
  { value: "LISTED", label: "Listed" },
  { value: "FUND_LIQUID", label: "Fund Liquid" },
  { value: "FUND_SEMI_LIQUID", label: "Fund Semi-Liquid" },
  { value: "PRIVATE", label: "Private" },
  { value: "LOCKED", label: "Locked" },
];

const TIER_COLORS: Record<string, string> = {
  LISTED: "bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-300",
  FUND_LIQUID: "bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  FUND_SEMI_LIQUID: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  PRIVATE: "bg-orange-50 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  LOCKED: "bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-300",
};

function NodeRow({ node, taxonomyId }: { node: NodeData; taxonomyId: string }) {
  const [isPending, startTransition] = useTransition();

  const indent = node.parentId ? "pl-8" : "pl-2";
  const isRisk = node.nodeType === "RISK";

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await setTaxonomyLiquidityDefaultAction(taxonomyId, node.id, formData);
    });
  }

  function handleRemove() {
    startTransition(async () => {
      await removeTaxonomyLiquidityDefaultAction(taxonomyId, node.id);
    });
  }

  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800">
      <td className={`py-3 ${indent}`}>
        <span className={`text-zinc-900 dark:text-zinc-100 ${isRisk ? "font-medium" : ""}`}>
          {node.name}
        </span>
        <span className="ml-2 text-xs text-zinc-400">{node.nodeType}</span>
      </td>
      <td className="py-3">
        {node.currentDefault ? (
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${TIER_COLORS[node.currentDefault.tier] ?? ""}`}>
            {node.currentDefault.tier}
          </span>
        ) : (
          <span className="text-xs text-zinc-400">None</span>
        )}
      </td>
      <td className="py-3 text-sm text-zinc-600 dark:text-zinc-400">
        {node.currentDefault ? `${node.currentDefault.horizonDays}d` : "—"}
      </td>
      <td className="py-3 text-sm text-zinc-600 dark:text-zinc-400">
        {node.currentDefault
          ? `${(node.currentDefault.stressedHaircutPct * 100).toFixed(0)}%`
          : "—"}
      </td>
      <td className="py-3">
        <form action={handleSubmit} className="flex items-center gap-2">
          <select
            name="tier"
            defaultValue={node.currentDefault?.tier ?? "LISTED"}
            className="rounded border border-zinc-300 px-1.5 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          >
            {TIERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            name="horizonDays"
            type="number"
            defaultValue={node.currentDefault?.horizonDays ?? 2}
            min={0}
            className="w-16 rounded border border-zinc-300 px-1.5 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="Days"
          />
          <input
            name="stressedHaircutPct"
            type="number"
            step="0.1"
            defaultValue={
              node.currentDefault
                ? (node.currentDefault.stressedHaircutPct * 100).toFixed(1)
                : "0"
            }
            min={0}
            max={100}
            className="w-16 rounded border border-zinc-300 px-1.5 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="Haircut%"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isPending ? "…" : "Set"}
          </button>
          {node.currentDefault && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={isPending}
              className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400"
            >
              Remove
            </button>
          )}
        </form>
      </td>
    </tr>
  );
}

export function LiquidityDefaultsForm({
  taxonomyId,
  nodes,
}: {
  taxonomyId: string;
  nodes: NodeData[];
}) {
  // Sort: risk buckets first, then children under each
  const riskBuckets = nodes.filter((n) => !n.parentId || n.nodeType === "RISK");
  const sorted: NodeData[] = [];
  for (const rb of riskBuckets) {
    sorted.push(rb);
    const children = nodes.filter((n) => n.parentId === rb.id);
    sorted.push(...children);
  }

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-zinc-200 dark:border-zinc-800">
          <th className="pb-2 font-medium text-zinc-500">Node</th>
          <th className="pb-2 font-medium text-zinc-500">Current tier</th>
          <th className="pb-2 font-medium text-zinc-500">Horizon</th>
          <th className="pb-2 font-medium text-zinc-500">Haircut</th>
          <th className="pb-2 font-medium text-zinc-500">Set default</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((node) => (
          <NodeRow key={node.id} node={node} taxonomyId={taxonomyId} />
        ))}
      </tbody>
    </table>
  );
}
