"use client";

import { useActionState, useTransition } from "react";
import Link from "next/link";
import { createCMASetAction, setDefaultCMASetAction, updateCMASetStatusAction } from "./actions";
import { formatDate } from "@/lib/format";

type CMASetRow = {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  status: string;
  effectiveDate: string | null;
  createdBy: string;
  assumptionCount: number;
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  ACTIVE: "bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-300",
  RETIRED: "bg-orange-50 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
};

export function CMAListClient({ cmaSets }: { cmaSets: CMASetRow[] }) {
  const [state, formAction, pending] = useActionState(createCMASetAction, null);
  const [isPending, startTransition] = useTransition();

  const handleSetDefault = (id: string) => {
    startTransition(async () => {
      await setDefaultCMASetAction(id);
    });
  };

  const handleStatusChange = (id: string, status: string) => {
    startTransition(async () => {
      await updateCMASetStatusAction(id, status);
    });
  };

  return (
    <div>
      {/* Create form */}
      <form action={formAction} className="mt-6 flex items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Set name
          </label>
          <input
            name="name"
            required
            className="mt-1 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="e.g. 2026 Base Case"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Description (optional)
          </label>
          <input
            name="description"
            className="mt-1 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="Brief description"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Effective date (optional)
          </label>
          <input
            name="effectiveDate"
            type="date"
            className="mt-1 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Risk-free rate %
          </label>
          <input
            name="riskFreeRatePct"
            type="number"
            step="0.1"
            defaultValue="3.0"
            className="mt-1 w-20 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Add CMA set
        </button>
      </form>
      {state?.error && (
        <p className="mt-2 text-sm text-red-600">{state.error}</p>
      )}

      {/* CMA sets list */}
      {cmaSets.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-400">
          No CMA sets yet. Create one above.
        </p>
      ) : (
        <table className="mt-8 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="pb-2 font-medium text-zinc-500">Name</th>
              <th className="pb-2 font-medium text-zinc-500">Status</th>
              <th className="pb-2 font-medium text-zinc-500">Effective</th>
              <th className="pb-2 font-medium text-zinc-500">Created by</th>
              <th className="pb-2 text-right font-medium text-zinc-500">Assumptions</th>
              <th className="pb-2 font-medium text-zinc-500">Default</th>
              <th className="pb-2 font-medium text-zinc-500"></th>
            </tr>
          </thead>
          <tbody>
            {cmaSets.map((s) => (
              <tr
                key={s.id}
                className="border-b border-zinc-100 dark:border-zinc-800"
              >
                <td className="py-2">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {s.name}
                  </span>
                  {s.description && (
                    <span className="ml-2 text-xs text-zinc-400">
                      {s.description}
                    </span>
                  )}
                </td>
                <td className="py-2">
                  <select
                    value={s.status}
                    onChange={(e) => handleStatusChange(s.id, e.target.value)}
                    disabled={isPending}
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_COLORS[s.status] ?? ""}`}
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="ACTIVE">Active</option>
                    <option value="RETIRED">Retired</option>
                  </select>
                </td>
                <td className="py-2 text-xs text-zinc-500">
                  {s.effectiveDate ? formatDate(s.effectiveDate) : "—"}
                </td>
                <td className="py-2 text-zinc-600 dark:text-zinc-400">
                  {s.createdBy}
                </td>
                <td className="py-2 text-right text-zinc-600 dark:text-zinc-400">
                  {s.assumptionCount}
                </td>
                <td className="py-2">
                  {s.isDefault ? (
                    <span className="rounded bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                      Default
                    </span>
                  ) : s.status === "ACTIVE" ? (
                    <button
                      onClick={() => handleSetDefault(s.id)}
                      disabled={isPending}
                      className="text-xs text-zinc-400 hover:text-zinc-900 disabled:opacity-50 dark:hover:text-zinc-300"
                    >
                      Set as default
                    </button>
                  ) : (
                    <span className="text-xs text-zinc-300 dark:text-zinc-600">—</span>
                  )}
                </td>
                <td className="py-2 text-right">
                  <Link
                    href={`/admin/cma/${s.id}`}
                    className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
