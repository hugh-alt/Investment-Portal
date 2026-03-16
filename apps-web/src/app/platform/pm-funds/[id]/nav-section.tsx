"use client";

import { useActionState, useTransition } from "react";
import { addFundNAVPointAction, deleteFundNAVPointAction, type AddNavState } from "../actions";
import { fmtNav } from "@/lib/pm-fund-truth";

type NavRow = {
  id: string;
  navDate: string;
  navAmount: number;
  currency: string;
};

export function NAVSection({
  fundId,
  currency,
  navPoints,
}: {
  fundId: string;
  currency: string;
  navPoints: NavRow[];
}) {
  const [state, formAction, pending] = useActionState<AddNavState | null, FormData>(
    addFundNAVPointAction,
    null,
  );
  const [isDeleting, startTransition] = useTransition();

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteFundNAVPointAction(id);
    });
  };

  return (
    <div className="mt-3">
      {navPoints.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="pb-2 text-left font-medium text-zinc-500">Date</th>
              <th className="pb-2 text-right font-medium text-zinc-500">NAV (4dp)</th>
              <th className="pb-2 text-right font-medium text-zinc-500"></th>
            </tr>
          </thead>
          <tbody>
            {navPoints.map((n) => (
              <tr key={n.id} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="py-2 text-zinc-600 dark:text-zinc-400">{n.navDate}</td>
                <td className="py-2 text-right font-mono text-zinc-900 dark:text-zinc-100">
                  {fmtNav(n.navAmount, n.currency)}
                </td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => handleDelete(n.id)}
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
        <input type="hidden" name="currency" value={currency} />
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Date</label>
          <input
            name="navDate"
            type="date"
            required
            className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">NAV Amount (4dp precision)</label>
          <input
            name="navAmount"
            type="number"
            step="0.0001"
            required
            className="mt-1 w-40 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Add NAV point
        </button>
      </form>
      {state?.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
      {state?.success && <p className="mt-1 text-xs text-green-600">NAV point added</p>}
    </div>
  );
}
