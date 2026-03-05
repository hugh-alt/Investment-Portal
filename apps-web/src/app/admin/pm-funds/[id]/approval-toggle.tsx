"use client";

import { useActionState } from "react";
import { toggleApprovalAction, type ToggleApprovalState } from "../actions";

export function ApprovalToggle({
  fundId,
  isApproved,
}: {
  fundId: string;
  isApproved: boolean;
}) {
  const [, action, pending] = useActionState<ToggleApprovalState, FormData>(
    toggleApprovalAction,
    {},
  );

  return (
    <form action={action}>
      <input type="hidden" name="fundId" value={fundId} />
      <input type="hidden" name="isApproved" value={String(!isApproved)} />
      <button
        type="submit"
        disabled={pending}
        className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
          isApproved
            ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300"
            : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-400"
        } disabled:opacity-50`}
      >
        {isApproved ? "Approved" : "Not Approved"}
      </button>
    </form>
  );
}
