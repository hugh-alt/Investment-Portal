"use client";

import Link from "next/link";
import { useActionState } from "react";
import { toggleApprovalAction, type ToggleApprovalState } from "./actions";

type FundRow = {
  id: string;
  name: string;
  vintageYear: number | null;
  strategy: string | null;
  currency: string;
  status: string;
  lifecycleStage: string | null;
  firstCloseDate: string | null;
  fundTermMonths: number | null;
  isApproved: boolean;
  hasProfile: boolean;
  commitmentCount: number;
};

const stageLabel: Record<string, string> = {
  FUNDRAISING: "Fundraising",
  INVESTING: "Investing",
  HARVESTING: "Harvesting",
  LIQUIDATING: "Liquidating",
};

const stageColor: Record<string, string> = {
  FUNDRAISING: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  INVESTING: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  HARVESTING: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  LIQUIDATING: "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400",
};

export function FundList({ funds }: { funds: FundRow[] }) {
  if (funds.length === 0) {
    return <p className="mt-6 text-sm text-zinc-400">No PM funds yet.</p>;
  }

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
            <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Fund</th>
            <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">Currency</th>
            <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Strategy</th>
            <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">Vintage</th>
            <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">Stage</th>
            <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">Status</th>
            <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">Approved</th>
            <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">Clients</th>
            <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400"></th>
          </tr>
        </thead>
        <tbody>
          {funds.map((f) => (
            <FundRowComponent key={f.id} fund={f} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FundRowComponent({ fund }: { fund: FundRow }) {
  const [, action, pending] = useActionState<ToggleApprovalState, FormData>(
    toggleApprovalAction,
    {},
  );

  return (
    <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
      <td className="px-4 py-3">
        <div className="font-medium text-zinc-900 dark:text-zinc-100">{fund.name}</div>
        {fund.firstCloseDate && (
          <div className="text-xs text-zinc-400">Close: {fund.firstCloseDate}{fund.fundTermMonths ? ` · ${fund.fundTermMonths}mo term` : ""}</div>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          {fund.currency}
        </span>
      </td>
      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
        {fund.strategy ?? "—"}
      </td>
      <td className="px-4 py-3 text-center text-zinc-600 dark:text-zinc-400">
        {fund.vintageYear ?? "—"}
      </td>
      <td className="px-4 py-3 text-center">
        {fund.lifecycleStage ? (
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${stageColor[fund.lifecycleStage] ?? ""}`}>
            {stageLabel[fund.lifecycleStage] ?? fund.lifecycleStage}
          </span>
        ) : (
          <span className="text-zinc-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
            fund.status === "OPEN"
              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
          }`}
        >
          {fund.status}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <form action={action}>
          <input type="hidden" name="fundId" value={fund.id} />
          <input type="hidden" name="isApproved" value={String(!fund.isApproved)} />
          <button
            type="submit"
            disabled={pending}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              fund.isApproved
                ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800"
                : "bg-zinc-200 text-zinc-500 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-600"
            } disabled:opacity-50`}
          >
            {fund.isApproved ? "Approved" : "Not approved"}
          </button>
        </form>
      </td>
      <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-400">
        {fund.commitmentCount}
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/admin/pm-funds/${fund.id}`}
          className="text-sm text-zinc-600 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          Edit profile
        </Link>
      </td>
    </tr>
  );
}
