"use client";

import { useActionState } from "react";
import { createSAAAction, type CreateSAAState } from "../actions";

export function CreateSAAForm({
  taxonomies,
}: {
  taxonomies: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<CreateSAAState, FormData>(
    createSAAAction,
    {},
  );

  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          placeholder="e.g. Balanced Growth"
        />
      </div>

      <div>
        <label
          htmlFor="taxonomyId"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Taxonomy
        </label>
        <select
          id="taxonomyId"
          name="taxonomyId"
          required
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="">Select a taxonomy...</option>
          {taxonomies.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Creating..." : "Create SAA"}
      </button>
    </form>
  );
}
