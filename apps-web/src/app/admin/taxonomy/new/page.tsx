"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createTaxonomyAction, type CreateState } from "../actions";
import { DEFAULT_NODES } from "@/lib/taxonomy-defaults";

const initial: CreateState = {};

export default function NewTaxonomyPage() {
  const [state, formAction, pending] = useActionState(
    createTaxonomyAction,
    initial,
  );

  return (
    <div className="max-w-lg">
      <Link
        href="/admin/taxonomy"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
      >
        &larr; Back to taxonomies
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Create taxonomy
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        A default structure will be created that you can fully customise.
      </p>

      <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
          Default nodes
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {DEFAULT_NODES.map((n) => (
            <li
              key={n.name}
              className="rounded bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {n.name}{" "}
              <span className="text-zinc-400">({n.nodeType})</span>
            </li>
          ))}
        </ul>
      </div>

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Name
          </span>
          <input
            name="name"
            required
            autoFocus
            placeholder="e.g. Default SAA Taxonomy"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Description{" "}
            <span className="font-normal text-zinc-400">(optional)</span>
          </span>
          <textarea
            name="description"
            rows={2}
            placeholder="What is this taxonomy for?"
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
          {pending ? "Creating\u2026" : "Create taxonomy"}
        </button>
      </form>
    </div>
  );
}
