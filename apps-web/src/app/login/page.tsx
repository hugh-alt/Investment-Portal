"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Enter your email to continue (demo &mdash; no password required).
        </p>

        <div className="mt-4 rounded-md border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
          <p className="mb-1.5 text-xs font-medium text-zinc-500">Demo accounts:</p>
          <div className="flex flex-col gap-0.5 text-xs text-zinc-600 dark:text-zinc-400">
            <span><strong className="font-medium text-zinc-700 dark:text-zinc-300">Super Admin</strong> &mdash; superadmin@reachalts.com.au</span>
            <span><strong className="font-medium text-zinc-700 dark:text-zinc-300">Admin</strong> &mdash; admin@reachalts.com.au</span>
            <span><strong className="font-medium text-zinc-700 dark:text-zinc-300">Adviser</strong> &mdash; adviser@reachalts.com.au</span>
            <span><strong className="font-medium text-zinc-700 dark:text-zinc-300">Admin + Adviser</strong> &mdash; adminadviser@reachalts.com.au</span>
          </div>
        </div>

        <form action={formAction} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Email
            </span>
            <input
              type="email"
              name="email"
              required
              autoFocus
              placeholder="you@example.com"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </label>

          {state.error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {pending ? "Signing in\u2026" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
