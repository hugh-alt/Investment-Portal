"use client";

import { useState, useActionState } from "react";
import { setMappingAction, type MapState } from "./actions";

type NodeOption = {
  id: string;
  name: string;
  nodeType: string;
  riskBucket: string | null;
};

type ProductRow = {
  id: string;
  name: string;
  type: string;
};

const TYPE_COLORS: Record<string, string> = {
  DIRECT: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  ETF: "bg-blue-50 text-blue-600 dark:bg-blue-900 dark:text-blue-300",
  FUND: "bg-green-50 text-green-600 dark:bg-green-900 dark:text-green-300",
  MANAGED_PORTFOLIO: "bg-purple-50 text-purple-600 dark:bg-purple-900 dark:text-purple-300",
};

export function MappingTable({
  taxonomyId,
  products,
  nodes,
  currentMappings,
}: {
  taxonomyId: string;
  products: ProductRow[];
  nodes: NodeOption[];
  currentMappings: Record<string, string>;
}) {
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  const filtered = products.filter((p) => {
    if (typeFilter !== "ALL" && p.type !== typeFilter) return false;
    if (filter && !p.name.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  const types = Array.from(new Set(products.map((p) => p.type)));
  const unmappedCount = products.filter((p) => !currentMappings[p.id]).length;

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search products..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        >
          <option value="ALL">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>{t.replace("_", " ")}</option>
          ))}
        </select>
        {unmappedCount > 0 && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900 dark:text-amber-300">
            {unmappedCount} unmapped
          </span>
        )}
      </div>

      <table className="mt-4 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="pb-2 font-medium text-zinc-500">Product</th>
            <th className="pb-2 font-medium text-zinc-500">Type</th>
            <th className="pb-2 font-medium text-zinc-500">Mapped to</th>
            <th className="pb-2 font-medium text-zinc-500 w-16"></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => (
            <MappingRow
              key={p.id}
              product={p}
              taxonomyId={taxonomyId}
              nodes={nodes}
              currentNodeId={currentMappings[p.id] ?? null}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MappingRow({
  product,
  taxonomyId,
  nodes,
  currentNodeId,
}: {
  product: ProductRow;
  taxonomyId: string;
  nodes: NodeOption[];
  currentNodeId: string | null;
}) {
  const [selectedNodeId, setSelectedNodeId] = useState(currentNodeId ?? "__none__");
  const isDirty = selectedNodeId !== (currentNodeId ?? "__none__");

  const initial: MapState = {};
  const [state, formAction, pending] = useActionState(setMappingAction, initial);

  // Group nodes by risk bucket
  const grouped = new Map<string, NodeOption[]>();
  for (const n of nodes) {
    const key = n.riskBucket ?? "Other";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(n);
  }

  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800">
      <td className="py-2 text-zinc-900 dark:text-zinc-100">{product.name}</td>
      <td className="py-2">
        <span className={`rounded px-1.5 py-0.5 text-xs ${TYPE_COLORS[product.type] ?? ""}`}>
          {product.type.replace("_", " ")}
        </span>
      </td>
      <td className="py-2">
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="taxonomyId" value={taxonomyId} />
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="nodeId" value={selectedNodeId} />
          <select
            value={selectedNodeId}
            onChange={(e) => setSelectedNodeId(e.target.value)}
            className={`rounded border px-2 py-1 text-sm ${
              selectedNodeId === "__none__"
                ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300"
                : "border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            }`}
          >
            <option value="__none__">— Unmapped —</option>
            {Array.from(grouped.entries()).map(([bucket, bucketNodes]) => (
              <optgroup key={bucket} label={bucket}>
                {bucketNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {isDirty && (
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-zinc-900 px-2 py-1 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              {pending ? "..." : "Save"}
            </button>
          )}
          {state.error && <span className="text-xs text-red-600">{state.error}</span>}
        </form>
      </td>
      <td className="py-2">
        {!currentNodeId && (
          <span className="text-xs text-amber-600">unmapped</span>
        )}
      </td>
    </tr>
  );
}
