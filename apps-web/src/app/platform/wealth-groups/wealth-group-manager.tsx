"use client";

import { useActionState } from "react";
import { createWealthGroupAction, assignUserWealthGroupAction } from "./actions";
import Link from "next/link";

type WealthGroup = {
  id: string;
  name: string;
  userCount: number;
  adviserCount: number;
  clientCount: number;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  wealthGroupId: string | null;
};

export function WealthGroupManager({
  wealthGroups,
  users,
}: {
  wealthGroups: WealthGroup[];
  users: UserRow[];
}) {
  const [createState, createAction, createPending] = useActionState(createWealthGroupAction, null);
  const [assignState, assignAction, assignPending] = useActionState(assignUserWealthGroupAction, null);

  const wgById = new Map(wealthGroups.map((wg) => [wg.id, wg.name]));

  return (
    <div>
      {/* Wealth Groups list */}
      <div className="mt-6">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Groups</h2>
        {wealthGroups.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">No wealth groups yet.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {wealthGroups.map((wg) => (
              <div
                key={wg.id}
                className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{wg.name}</p>
                <div className="mt-2 flex gap-4 text-xs text-zinc-500">
                  <span>{wg.userCount} users</span>
                  <span>{wg.adviserCount} advisers</span>
                  <span>{wg.clientCount} clients</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create wealth group */}
      <form action={createAction} className="mt-6 flex items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            New Group Name
          </label>
          <input
            name="name"
            required
            className="mt-1 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="e.g. Acme Wealth"
          />
        </div>
        <button
          type="submit"
          disabled={createPending}
          className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Create
        </button>
        {createState?.error && <span className="text-sm text-red-600">{createState.error}</span>}
      </form>

      {/* User assignments */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">User Assignments</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="pb-2 font-medium text-zinc-500">Email</th>
              <th className="pb-2 font-medium text-zinc-500">Name</th>
              <th className="pb-2 font-medium text-zinc-500">Role</th>
              <th className="pb-2 font-medium text-zinc-500">Wealth Group</th>
              <th className="pb-2 font-medium text-zinc-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="py-2 text-zinc-900 dark:text-zinc-100">{u.email}</td>
                <td className="py-2 text-zinc-600 dark:text-zinc-400">{u.name}</td>
                <td className="py-2">
                  <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {u.role}
                  </span>
                </td>
                <td className="py-2 text-zinc-600 dark:text-zinc-400">
                  {u.wealthGroupId ? wgById.get(u.wealthGroupId) ?? "Unknown" : "—"}
                </td>
                <td className="py-2">
                  <form action={assignAction} className="flex items-center gap-2">
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="role" value={u.role} />
                    <select
                      name="wealthGroupId"
                      defaultValue={u.wealthGroupId ?? ""}
                      className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <option value="">None</option>
                      {wealthGroups.map((wg) => (
                        <option key={wg.id} value={wg.id}>
                          {wg.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={assignPending}
                      className="rounded bg-zinc-900 px-2 py-1 text-xs text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      Save
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {assignState?.error && <p className="mt-2 text-sm text-red-600">{assignState.error}</p>}
      </div>

      <div className="mt-8">
        <Link
          href="/dashboard"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
        >
          &larr; Back to dashboard
        </Link>
      </div>
    </div>
  );
}
