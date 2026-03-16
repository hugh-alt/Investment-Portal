"use client";

import { useActionState, useTransition } from "react";
import { addFundCloseAction, deleteFundCloseAction, type AddCloseState } from "../actions";

type CloseRow = {
  id: string;
  closeType: string;
  closeDate: string;
  capitalRaised: number | null;
  notes: string | null;
};

const closeTypeLabel: Record<string, string> = {
  FIRST: "First",
  SECOND: "Second",
  FINAL: "Final",
  OTHER: "Other",
};

const amountFmt = (v: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(v);

export function ClosesSection({ fundId, closes }: { fundId: string; closes: CloseRow[] }) {
  const [state, formAction, pending] = useActionState<AddCloseState | null, FormData>(
    addFundCloseAction,
    null,
  );
  const [isDeleting, startTransition] = useTransition();

  const handleDelete = (closeId: string) => {
    startTransition(async () => {
      await deleteFundCloseAction(closeId);
    });
  };

  return (
    <div className="mt-3">
      {closes.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="pb-2 text-left font-medium text-zinc-500">Type</th>
              <th className="pb-2 text-left font-medium text-zinc-500">Date</th>
              <th className="pb-2 text-right font-medium text-zinc-500">Capital Raised</th>
              <th className="pb-2 text-left font-medium text-zinc-500">Notes</th>
              <th className="pb-2 text-right font-medium text-zinc-500"></th>
            </tr>
          </thead>
          <tbody>
            {closes.map((c) => (
              <tr key={c.id} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="py-2 text-zinc-900 dark:text-zinc-100">
                  {closeTypeLabel[c.closeType] ?? c.closeType}
                </td>
                <td className="py-2 text-zinc-600 dark:text-zinc-400">{c.closeDate}</td>
                <td className="py-2 text-right text-zinc-600 dark:text-zinc-400">
                  {c.capitalRaised != null ? amountFmt(c.capitalRaised) : "—"}
                </td>
                <td className="py-2 text-xs text-zinc-400">{c.notes ?? ""}</td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => handleDelete(c.id)}
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
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Type</label>
          <select
            name="closeType"
            required
            className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="FIRST">First</option>
            <option value="SECOND">Second</option>
            <option value="FINAL">Final</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Date</label>
          <input
            name="closeDate"
            type="date"
            required
            className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Capital Raised</label>
          <input
            name="capitalRaised"
            type="number"
            step="1"
            className="mt-1 w-32 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Notes</label>
          <input
            name="notes"
            className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="Optional"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Add close
        </button>
      </form>
      {state?.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
      {state?.success && <p className="mt-1 text-xs text-green-600">Close added</p>}
    </div>
  );
}
