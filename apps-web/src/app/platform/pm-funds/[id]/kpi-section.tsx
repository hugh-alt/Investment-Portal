"use client";

import { useActionState, useTransition } from "react";
import { addFundKpiPointAction, deleteFundKpiPointAction, type AddKpiState } from "../actions";
import { fmt4dp } from "@/lib/pm-fund-truth";

type KpiRow = {
  id: string;
  kpiDate: string;
  tvpi: number;
  rvpi: number;
  dpi: number;
  moic: number;
};

export function KpiSection({
  fundId,
  kpiPoints,
}: {
  fundId: string;
  kpiPoints: KpiRow[];
}) {
  const [state, formAction, pending] = useActionState<AddKpiState | null, FormData>(
    addFundKpiPointAction,
    null,
  );
  const [isDeleting, startTransition] = useTransition();

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteFundKpiPointAction(id);
    });
  };

  return (
    <div className="mt-3">
      {kpiPoints.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="pb-2 text-left font-medium text-zinc-500">Date</th>
              <th className="pb-2 text-right font-medium text-zinc-500">TVPI</th>
              <th className="pb-2 text-right font-medium text-zinc-500">RVPI</th>
              <th className="pb-2 text-right font-medium text-zinc-500">DPI</th>
              <th className="pb-2 text-right font-medium text-zinc-500">MOIC</th>
              <th className="pb-2 text-right font-medium text-zinc-500"></th>
            </tr>
          </thead>
          <tbody>
            {kpiPoints.map((k) => (
              <tr key={k.id} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="py-2 text-zinc-600 dark:text-zinc-400">{k.kpiDate}</td>
                <td className="py-2 text-right font-mono text-zinc-900 dark:text-zinc-100">{fmt4dp(k.tvpi)}</td>
                <td className="py-2 text-right font-mono text-zinc-900 dark:text-zinc-100">{fmt4dp(k.rvpi)}</td>
                <td className="py-2 text-right font-mono text-zinc-900 dark:text-zinc-100">{fmt4dp(k.dpi)}</td>
                <td className="py-2 text-right font-mono text-zinc-900 dark:text-zinc-100">{fmt4dp(k.moic)}</td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => handleDelete(k.id)}
                    disabled={isDeleting}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form action={formAction} className="mt-3 flex items-end gap-3 flex-wrap">
        <input type="hidden" name="fundId" value={fundId} />
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Date</label>
          <input
            name="kpiDate"
            type="date"
            required
            className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">TVPI</label>
          <input name="tvpi" type="number" step="0.0001" required
            className="mt-1 w-24 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">RVPI</label>
          <input name="rvpi" type="number" step="0.0001" required
            className="mt-1 w-24 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">DPI</label>
          <input name="dpi" type="number" step="0.0001" required
            className="mt-1 w-24 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">MOIC</label>
          <input name="moic" type="number" step="0.0001" required
            className="mt-1 w-24 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Add KPI
        </button>
      </form>
      {state?.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
      {state?.success && <p className="mt-1 text-xs text-green-600">KPI point added</p>}
    </div>
  );
}
