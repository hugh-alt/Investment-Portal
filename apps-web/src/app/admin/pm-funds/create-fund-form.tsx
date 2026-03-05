"use client";

import { useState, useActionState } from "react";
import { createFundAction, type CreateFundState } from "./actions";

export function CreateFundForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<CreateFundState, FormData>(
    createFundAction,
    {},
  );

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        + Add Fund
      </button>
    );
  }

  return (
    <form
      action={action}
      className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Fund Name
          </label>
          <input
            id="name"
            name="name"
            required
            className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div>
          <label htmlFor="vintageYear" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Vintage Year
          </label>
          <input
            id="vintageYear"
            name="vintageYear"
            type="number"
            className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div>
          <label htmlFor="strategy" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Strategy
          </label>
          <input
            id="strategy"
            name="strategy"
            className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div>
          <label htmlFor="currency" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Currency
          </label>
          <input
            id="currency"
            name="currency"
            defaultValue="AUD"
            className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
      </div>

      {state.error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p className="mt-2 text-sm text-green-600 dark:text-green-400">Fund created.</p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Creating..." : "Create"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
