"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createPlatformFundAction, type CreateFundState } from "../actions";

export function CreatePlatformFundForm() {
  const [state, action, pending] = useActionState<CreateFundState | null, FormData>(
    createPlatformFundAction,
    null,
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      router.push("/platform/pm-funds");
    }
  }, [state?.success, router]);

  return (
    <form
      action={action}
      className="mt-6 max-w-2xl rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Fund Name *
          </label>
          <input
            name="name"
            required
            className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="e.g. Macquarie Infrastructure Fund VI"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Vintage Year
          </label>
          <input
            name="vintageYear"
            type="number"
            className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="e.g. 2026"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Strategy
          </label>
          <input
            name="strategy"
            className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="e.g. Infrastructure, Buyout, VC"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Currency
          </label>
          <input
            name="currency"
            defaultValue="AUD"
            className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>

      {state?.error && (
        <p className="mt-3 text-sm text-red-600">{state.error}</p>
      )}

      <div className="mt-4 flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Creating..." : "Create Fund"}
        </button>
      </div>
    </form>
  );
}
