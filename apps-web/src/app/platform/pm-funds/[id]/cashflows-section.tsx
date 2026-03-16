"use client";

import { useActionState, useTransition } from "react";
import { addFundCallEventAction, deleteFundCashflowEventAction, type AddCallState } from "../actions";
import { fmtPct } from "@/lib/pm-fund-truth";

type CallRow = {
  id: string;
  eventDate: string;
  callPct: number | null;
  amount: number | null;
  currency: string;
  notes: string | null;
};

export function CallsSection({
  fundId,
  currency,
  calls,
}: {
  fundId: string;
  currency: string;
  calls: CallRow[];
}) {
  const [state, formAction, pending] = useActionState<AddCallState | null, FormData>(
    addFundCallEventAction,
    null,
  );
  const [isDeleting, startTransition] = useTransition();

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteFundCashflowEventAction(id);
    });
  };

  return (
    <div className="mt-3">
      {calls.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="pb-2 text-left font-medium text-zinc-500">Date</th>
              <th className="pb-2 text-right font-medium text-zinc-500">Call %</th>
              <th className="pb-2 text-left font-medium text-zinc-500">Notes</th>
              <th className="pb-2 text-right font-medium text-zinc-500"></th>
            </tr>
          </thead>
          <tbody>
            {calls.map((c) => (
              <tr key={c.id} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="py-2 text-zinc-600 dark:text-zinc-400">{c.eventDate}</td>
                <td className="py-2 text-right text-zinc-900 dark:text-zinc-100">
                  {c.callPct != null ? fmtPct(c.callPct) : c.amount != null ? `${currency} ${c.amount.toLocaleString()}` : "—"}
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
        <input type="hidden" name="currency" value={currency} />
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Date</label>
          <input
            name="eventDate"
            type="date"
            required
            className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Call % of commitment</label>
          <input
            name="callPct"
            type="number"
            step="0.01"
            required
            placeholder="e.g. 2.50"
            className="mt-1 w-28 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
          Add call
        </button>
      </form>
      {state?.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
      {state?.success && <p className="mt-1 text-xs text-green-600">Call added</p>}
    </div>
  );
}
