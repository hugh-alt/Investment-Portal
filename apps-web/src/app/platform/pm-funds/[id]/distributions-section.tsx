"use client";

import { useState, useActionState, useTransition } from "react";
import {
  addDistributionEventAction,
  deleteDistributionEventAction,
  recalculateAllocationsAction,
  type AddDistributionState,
} from "../actions";
import { fmtPct } from "@/lib/pm-fund-truth";

type AllocationRow = {
  id: string;
  clientName: string;
  adviserName: string;
  wealthGroup: string;
  commitmentAmount: number;
  fundedAmount: number;
  amount: number;
  pctOfCommitment: number | null;
};

type DistEventRow = {
  id: string;
  eventDate: string;
  totalAmount: number;
  currency: string;
  basis: string;
  notes: string | null;
  allocations: AllocationRow[];
};

const amountFmt = (v: number, currency: string) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(v);

const basisLabel: Record<string, string> = {
  PRO_RATA_COMMITMENT: "Pro-rata commitment",
  PRO_RATA_PAIDIN: "Pro-rata paid-in",
};

export function DistributionsSection({
  fundId,
  currency,
  events,
}: {
  fundId: string;
  currency: string;
  events: DistEventRow[];
}) {
  const [state, formAction, pending] = useActionState<AddDistributionState | null, FormData>(
    addDistributionEventAction,
    null,
  );
  const [isDeleting, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteDistributionEventAction(id);
    });
  };

  const handleRecalculate = (id: string) => {
    startTransition(async () => {
      await recalculateAllocationsAction(id);
    });
  };

  return (
    <div className="mt-3">
      {events.length > 0 && (
        <div className="space-y-3">
          {events.map((evt) => (
            <div key={evt.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setExpandedId(expandedId === evt.id ? null : evt.id)}
                    className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                  >
                    {expandedId === evt.id ? "[-]" : "[+]"}
                  </button>
                  <div>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {amountFmt(evt.totalAmount, evt.currency)}
                    </span>
                    <span className="ml-2 text-xs text-zinc-400">
                      {evt.eventDate} · {basisLabel[evt.basis] ?? evt.basis}
                    </span>
                    {evt.notes && <span className="ml-2 text-xs text-zinc-400">· {evt.notes}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRecalculate(evt.id)}
                    disabled={isDeleting}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    Recalculate
                  </button>
                  <button
                    onClick={() => handleDelete(evt.id)}
                    disabled={isDeleting}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {expandedId === evt.id && evt.allocations.length > 0 && (
                <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-zinc-400">
                        <th className="pb-1 text-left font-medium">Client</th>
                        <th className="pb-1 text-left font-medium">Adviser</th>
                        <th className="pb-1 text-left font-medium">Wealth Group</th>
                        <th className="pb-1 text-right font-medium">Commitment</th>
                        <th className="pb-1 text-right font-medium">Paid-in</th>
                        <th className="pb-1 text-right font-medium">Allocation</th>
                        <th className="pb-1 text-right font-medium">% of Commit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evt.allocations.map((a) => (
                        <tr key={a.id} className="border-t border-zinc-100 dark:border-zinc-800">
                          <td className="py-1 text-zinc-700 dark:text-zinc-300">{a.clientName}</td>
                          <td className="py-1 text-zinc-500">{a.adviserName}</td>
                          <td className="py-1 text-zinc-500">{a.wealthGroup}</td>
                          <td className="py-1 text-right text-zinc-500">{amountFmt(a.commitmentAmount, evt.currency)}</td>
                          <td className="py-1 text-right text-zinc-500">{amountFmt(a.fundedAmount, evt.currency)}</td>
                          <td className="py-1 text-right font-medium text-zinc-900 dark:text-zinc-100">
                            {amountFmt(a.amount, evt.currency)}
                          </td>
                          <td className="py-1 text-right text-zinc-500">
                            {a.pctOfCommitment != null ? fmtPct(a.pctOfCommitment) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-zinc-200 dark:border-zinc-700">
                        <td colSpan={5} className="py-1 text-right font-medium text-zinc-600 dark:text-zinc-400">Total</td>
                        <td className="py-1 text-right font-medium text-zinc-900 dark:text-zinc-100">
                          {amountFmt(evt.allocations.reduce((s, a) => s + a.amount, 0), evt.currency)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {expandedId === evt.id && evt.allocations.length === 0 && (
                <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
                  <p className="text-xs text-zinc-400">No commitments found for allocation.</p>
                </div>
              )}
            </div>
          ))}
        </div>
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
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Total Amount</label>
          <input
            name="totalAmount"
            type="number"
            step="0.01"
            required
            className="mt-1 w-36 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Basis</label>
          <select
            name="basis"
            className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="PRO_RATA_COMMITMENT">Pro-rata commitment</option>
            <option value="PRO_RATA_PAIDIN">Pro-rata paid-in</option>
          </select>
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
          Add distribution
        </button>
      </form>
      {state?.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
      {state?.success && <p className="mt-1 text-xs text-green-600">Distribution added with allocations</p>}
    </div>
  );
}
