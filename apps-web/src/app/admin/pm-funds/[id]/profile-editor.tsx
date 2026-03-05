"use client";

import { useState, useActionState } from "react";
import { saveProfileAction, type SaveProfileState } from "../actions";
import type { CurvePoint } from "@/lib/pm-curves";

export function ProfileEditor({
  fundId,
  initialCallCurve,
  initialDistCurve,
}: {
  fundId: string;
  initialCallCurve: CurvePoint[];
  initialDistCurve: CurvePoint[];
}) {
  const [callCurve, setCallCurve] = useState<CurvePoint[]>(initialCallCurve);
  const [distCurve, setDistCurve] = useState<CurvePoint[]>(initialDistCurve);
  const [state, action, pending] = useActionState<SaveProfileState, FormData>(
    saveProfileAction,
    {},
  );

  function updateCallPct(index: number, value: string) {
    setCallCurve((prev) =>
      prev.map((r, i) => (i === index ? { ...r, cumPct: parseFloat(value) || 0 } : r)),
    );
  }

  function updateDistPct(index: number, value: string) {
    setDistCurve((prev) =>
      prev.map((r, i) => (i === index ? { ...r, cumPct: parseFloat(value) || 0 } : r)),
    );
  }

  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="fundId" value={fundId} />
      <input type="hidden" name="projectedCallPctCurveJson" value={JSON.stringify(callCurve)} />
      <input type="hidden" name="projectedDistPctCurveJson" value={JSON.stringify(distCurve)} />

      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
              <th className="px-3 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400">Month</th>
              <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">Cum Call %</th>
              <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">Cum Dist %</th>
            </tr>
          </thead>
          <tbody>
            {callCurve.map((row, i) => (
              <tr key={i} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                <td className="px-3 py-1.5 text-zinc-600 dark:text-zinc-400">{row.month}</td>
                <td className="px-3 py-1.5 text-right">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={row.cumPct}
                    onChange={(e) => updateCallPct(i, e.target.value)}
                    className="w-20 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={distCurve[i]?.cumPct ?? 0}
                    onChange={(e) => updateDistPct(i, e.target.value)}
                    className="w-20 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {state.error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p className="mt-3 text-sm text-green-600 dark:text-green-400">Profile saved.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Saving..." : "Save Profile"}
      </button>
    </form>
  );
}
