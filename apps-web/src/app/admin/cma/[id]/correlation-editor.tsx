"use client";

import { useState, useMemo } from "react";
import {
  buildCorrelationMatrix,
  validateCorrelationMatrix,
  repairToNearestPSD,
  generateTypicalCorrelations,
} from "@/lib/cma";
import type { CorrelationEntry } from "@/lib/cma";
import { saveCorrelationsAction } from "@/app/admin/cma/actions";

type Node = { id: string; label: string };

export function CorrelationEditor({
  cmaSetId,
  nodes,
  initialCorrelations,
}: {
  cmaSetId: string;
  nodes: Node[];
  initialCorrelations: CorrelationEntry[];
}) {
  const [entries, setEntries] = useState<CorrelationEntry[]>(initialCorrelations);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const nodeIds = useMemo(() => nodes.map((n) => n.id), [nodes]);
  const nodeNames = useMemo(() => nodes.map((n) => n.label), [nodes]);

  const matrix = useMemo(
    () => buildCorrelationMatrix(nodeIds, entries),
    [nodeIds, entries],
  );

  const validation = useMemo(
    () => validateCorrelationMatrix(matrix),
    [matrix],
  );

  const getCorr = (i: number, j: number): string => {
    if (i === j) return "1.0000";
    return matrix[i][j].toFixed(4);
  };

  const setCorr = (i: number, j: number, value: string) => {
    const v = parseFloat(value);
    if (isNaN(v)) return;
    const clamped = Math.max(-1, Math.min(1, v));

    // Update entries: remove old, add new (upper triangle only)
    const a = i < j ? nodeIds[i] : nodeIds[j];
    const b = i < j ? nodeIds[j] : nodeIds[i];

    setEntries((prev) => {
      const filtered = prev.filter(
        (e) => !(e.nodeIdA === a && e.nodeIdB === b) && !(e.nodeIdA === b && e.nodeIdB === a),
      );
      if (clamped !== 0) {
        filtered.push({ nodeIdA: a, nodeIdB: b, corr: clamped });
      }
      return filtered;
    });
  };

  const applyPreset = (preset: "identity" | "typical") => {
    if (preset === "identity") {
      setEntries([]);
    } else {
      setEntries(generateTypicalCorrelations(nodeIds, nodeNames));
    }
    setMessage(null);
  };

  const handleRepair = () => {
    const repaired = repairToNearestPSD(matrix);
    const newEntries: CorrelationEntry[] = [];
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const corr = Math.round(repaired[i][j] * 10000) / 10000;
        if (corr !== 0) {
          newEntries.push({ nodeIdA: nodeIds[i], nodeIdB: nodeIds[j], corr });
        }
      }
    }
    setEntries(newEntries);
    setMessage({ type: "ok", text: "Matrix repaired to nearest PSD" });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const result = await saveCorrelationsAction(cmaSetId, entries);
    setSaving(false);
    if (result.error) {
      setMessage({ type: "err", text: result.error });
    } else {
      setMessage({ type: "ok", text: "Correlations saved" });
    }
  };

  if (nodes.length < 2) {
    return (
      <p className="mt-2 text-sm text-zinc-400">
        Add at least 2 assumptions to define correlations.
      </p>
    );
  }

  return (
    <div>
      {/* Presets */}
      <div className="mt-3 flex items-center gap-3">
        <span className="text-xs font-medium text-zinc-500">Presets:</span>
        <button
          onClick={() => applyPreset("identity")}
          className="rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
        >
          Identity (0 off-diagonal)
        </button>
        <button
          onClick={() => applyPreset("typical")}
          className="rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
        >
          Typical
        </button>
        {!validation.isPSD && (
          <button
            onClick={handleRepair}
            className="rounded bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-300"
          >
            Repair to nearest PSD
          </button>
        )}
      </div>

      {/* Matrix grid */}
      <div className="mt-3 overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th className="pb-1 pr-2 text-left font-medium text-zinc-500"></th>
              {nodes.map((n) => (
                <th
                  key={n.id}
                  className="pb-1 px-1 text-center font-medium text-zinc-500 max-w-[80px] truncate"
                  title={n.label}
                >
                  {n.label.length > 12 ? n.label.slice(0, 10) + "..." : n.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nodes.map((rowNode, i) => (
              <tr key={rowNode.id}>
                <td
                  className="pr-2 py-0.5 font-medium text-zinc-600 dark:text-zinc-400 max-w-[120px] truncate"
                  title={rowNode.label}
                >
                  {rowNode.label.length > 16 ? rowNode.label.slice(0, 14) + "..." : rowNode.label}
                </td>
                {nodes.map((colNode, j) => (
                  <td key={colNode.id} className="px-0.5 py-0.5">
                    {i === j ? (
                      <div className="w-16 rounded bg-zinc-100 px-1 py-1 text-center font-mono text-zinc-400 dark:bg-zinc-800">
                        1.0000
                      </div>
                    ) : i < j ? (
                      <input
                        type="number"
                        step="0.01"
                        min="-1"
                        max="1"
                        value={getCorr(i, j)}
                        onChange={(e) => setCorr(i, j, e.target.value)}
                        className="w-16 rounded border border-zinc-300 px-1 py-1 text-center font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    ) : (
                      <div className="w-16 rounded bg-zinc-50 px-1 py-1 text-center font-mono text-zinc-400 dark:bg-zinc-800/50">
                        {getCorr(i, j)}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Validation status */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
        <span className={validation.isSymmetric ? "text-green-600" : "text-red-600"}>
          Symmetric: {validation.isSymmetric ? "pass" : "fail"}
        </span>
        <span className={validation.isPSD ? "text-green-600" : "text-red-600"}>
          PSD: {validation.isPSD ? "pass" : "fail"}
        </span>
        <span className="text-zinc-500">
          Coverage: {(validation.coveragePct * 100).toFixed(0)}%
        </span>
      </div>

      {!validation.isPSD && (
        <p className="mt-1 text-xs text-red-600">
          Matrix is not positive semi-definite. Cannot set CMA set to ACTIVE until repaired.
        </p>
      )}

      {/* Save */}
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {saving ? "Saving..." : "Save correlations"}
        </button>
        {message && (
          <span className={message.type === "ok" ? "text-xs text-green-600" : "text-xs text-red-600"}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
