"use client";

import { useActionState } from "react";
import { assignSAAAction } from "@/app/adviser/saa/actions";
import type { SaveAllocState } from "@/app/adviser/saa/actions";

export function SAASelector({
  clientId,
  currentSaaId,
  saas,
}: {
  clientId: string;
  currentSaaId: string | null;
  saas: { id: string; name: string; ownerScope: string }[];
}) {
  const [state, action, pending] = useActionState<SaveAllocState, FormData>(
    assignSAAAction,
    {},
  );

  return (
    <form action={action} className="flex items-end gap-3">
      <input type="hidden" name="clientId" value={clientId} />
      <div>
        <label
          htmlFor="saaId"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Assigned SAA
        </label>
        <select
          id="saaId"
          name="saaId"
          defaultValue={currentSaaId ?? "__none__"}
          className="mt-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="__none__">None</option>
          {saas.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.ownerScope})
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Saving..." : "Assign"}
      </button>
      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm text-green-600 dark:text-green-400">Saved</p>
      )}
    </form>
  );
}
