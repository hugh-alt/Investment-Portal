"use client";

import { useActionState, useTransition } from "react";
import {
  createScenarioAction,
  updateRuleAction,
  setDefaultScenarioAction,
  deleteScenarioAction,
  runScenarioAction,
} from "./actions";
import { formatDateTime } from "@/lib/format";

type Rule = {
  id: string;
  horizonDays: number;
  extraCashDemandPct: number;
  extraCashDemandAmount: number;
};

type Scenario = {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  rules: Rule[];
  lastRun: {
    runAt: string;
    runBy: string;
    resultCount: number;
  } | null;
};

function RuleRow({ rule }: { rule: Rule }) {
  const [state, formAction, pending] = useActionState(updateRuleAction, null);

  return (
    <form action={formAction} className="flex items-center gap-2 text-xs">
      <input type="hidden" name="ruleId" value={rule.id} />
      <span className="w-12 font-medium text-zinc-700 dark:text-zinc-300">{rule.horizonDays}d</span>
      <label className="text-zinc-500">
        Extra %
        <input
          name="extraCashDemandPct"
          type="number"
          step="0.1"
          min={0}
          max={100}
          defaultValue={(rule.extraCashDemandPct * 100).toFixed(1)}
          className="ml-1 w-16 rounded border border-zinc-300 px-1.5 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="text-zinc-500">
        Extra $
        <input
          name="extraCashDemandAmount"
          type="number"
          min={0}
          defaultValue={rule.extraCashDemandAmount}
          className="ml-1 w-20 rounded border border-zinc-300 px-1.5 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-2 py-0.5 text-xs text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "…" : "Save"}
      </button>
      {state?.error && <span className="text-red-600">{state.error}</span>}
    </form>
  );
}

function ScenarioCard({ scenario }: { scenario: Scenario }) {
  const [isPending, startTransition] = useTransition();

  const handleSetDefault = () => {
    startTransition(async () => { await setDefaultScenarioAction(scenario.id); });
  };
  const handleDelete = () => {
    if (!confirm("Delete this scenario?")) return;
    startTransition(async () => { await deleteScenarioAction(scenario.id); });
  };
  const handleRun = () => {
    startTransition(async () => { await runScenarioAction(scenario.id); });
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{scenario.name}</h3>
          {scenario.description && (
            <p className="mt-0.5 text-xs text-zinc-400">{scenario.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {scenario.isDefault && (
            <span className="rounded bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
              Default
            </span>
          )}
          {!scenario.isDefault && (
            <button
              onClick={handleSetDefault}
              disabled={isPending}
              className="text-xs text-zinc-400 hover:text-zinc-900 disabled:opacity-50 dark:hover:text-zinc-300"
            >
              Set default
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {scenario.rules.map((r) => (
          <RuleRow key={r.id} rule={r} />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-zinc-400">
          {scenario.lastRun
            ? `Last run: ${formatDateTime(scenario.lastRun.runAt)} by ${scenario.lastRun.runBy} (${scenario.lastRun.resultCount} results)`
            : "Not run yet"}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRun}
            disabled={isPending}
            className="rounded bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isPending ? "Running…" : "Run scenario"}
          </button>
          {!scenario.isDefault && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="text-xs text-zinc-400 hover:text-red-600 disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function LiquidityStressManager({ scenarios }: { scenarios: Scenario[] }) {
  const [state, formAction, pending] = useActionState(createScenarioAction, null);

  return (
    <div>
      <form action={formAction} className="mt-6 flex items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Name</label>
          <input
            name="name"
            required
            className="mt-1 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="e.g. Severe Withdrawal"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Description</label>
          <input
            name="description"
            className="mt-1 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="Optional"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Add scenario
        </button>
      </form>
      {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}

      <div className="mt-6 space-y-4">
        {scenarios.length === 0 ? (
          <p className="text-sm text-zinc-400">No scenarios yet.</p>
        ) : (
          scenarios.map((s) => <ScenarioCard key={s.id} scenario={s} />)
        )}
      </div>
    </div>
  );
}
