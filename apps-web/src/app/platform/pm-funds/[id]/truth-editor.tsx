"use client";

import { useActionState } from "react";
import { updateFundTruthAction, type UpdateTruthState } from "../actions";

type Props = {
  fundId: string;
  initial: {
    lifecycleStage: string | null;
    firstCloseDate: string | null;
    investmentPeriodMonths: number | null;
    fundTermMonths: number | null;
    extensionMonths: number | null;
  };
};

export function TruthEditor({ fundId, initial }: Props) {
  const [state, formAction, pending] = useActionState<UpdateTruthState | null, FormData>(
    updateFundTruthAction,
    null,
  );

  return (
    <form action={formAction} className="mt-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <input type="hidden" name="fundId" value={fundId} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Lifecycle Stage
          </label>
          <select
            name="lifecycleStage"
            defaultValue={initial.lifecycleStage ?? ""}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">—</option>
            <option value="FUNDRAISING">Fundraising</option>
            <option value="INVESTING">Investing</option>
            <option value="HARVESTING">Harvesting</option>
            <option value="LIQUIDATING">Liquidating</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            First Close Date
          </label>
          <input
            name="firstCloseDate"
            type="date"
            defaultValue={initial.firstCloseDate ?? ""}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Investment Period (mo)
          </label>
          <input
            name="investmentPeriodMonths"
            type="number"
            defaultValue={initial.investmentPeriodMonths ?? ""}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Fund Term (mo)
          </label>
          <input
            name="fundTermMonths"
            type="number"
            defaultValue={initial.fundTermMonths ?? ""}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Extension (mo)
          </label>
          <input
            name="extensionMonths"
            type="number"
            defaultValue={initial.extensionMonths ?? ""}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Saving..." : "Save truth"}
        </button>
        {state?.success && <span className="text-xs text-green-600">Saved</span>}
        {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
