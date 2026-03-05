"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createScenarioAction } from "./actions";

type Scenario = {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  shockCount: number;
  runCount: number;
  lastRunAt: string | null;
};

export function ScenarioListClient({ scenarios }: { scenarios: Scenario[] }) {
  const [state, formAction, pending] = useActionState(createScenarioAction, null);

  return (
    <div>
      {/* Create form */}
      <form action={formAction} className="mt-6 flex items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Scenario name
          </label>
          <input
            name="name"
            required
            className="mt-1 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="e.g. GFC-style"
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
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Create scenario
        </button>
      </form>
      {state?.error && (
        <p className="mt-2 text-sm text-red-600">{state.error}</p>
      )}

      {/* Scenario list */}
      {scenarios.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-400">
          No scenarios yet. Create one above.
        </p>
      ) : (
        <table className="mt-8 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="pb-2 font-medium text-zinc-500">Scenario</th>
              <th className="pb-2 font-medium text-zinc-500">Created by</th>
              <th className="pb-2 text-right font-medium text-zinc-500">Shocks</th>
              <th className="pb-2 text-right font-medium text-zinc-500">Runs</th>
              <th className="pb-2 font-medium text-zinc-500">Last run</th>
              <th className="pb-2 font-medium text-zinc-500"></th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s) => (
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
                <td className="py-2 text-zinc-600 dark:text-zinc-400">
                  {s.createdBy}
                </td>
                <td className="py-2 text-right text-zinc-600 dark:text-zinc-400">
                  {s.shockCount}
                </td>
                <td className="py-2 text-right text-zinc-600 dark:text-zinc-400">
                  {s.runCount}
                </td>
                <td className="py-2 text-zinc-600 dark:text-zinc-400">
                  {s.lastRunAt ?? "—"}
                </td>
                <td className="py-2 text-right">
                  <Link
                    href={`/admin/stests/${s.id}`}
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
