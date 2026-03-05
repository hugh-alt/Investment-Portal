"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  ClientDriftRow,
  SleeveGovernanceRow,
  RebalanceGovernanceRow,
  GovernanceSummary,
} from "@/lib/governance";
import type { ClientLiquidityRiskRow } from "@/lib/liquidity-profile";
import { formatDate } from "@/lib/format";

const pct = (v: number) => (v * 100).toFixed(1) + "%";
const fmt = (v: number) =>
  "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const SEVERITY_COLORS: Record<string, string> = {
  OK: "bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-300",
  WARN: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  CRITICAL: "bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const PLAN_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  ADVISER_APPROVED: "bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  CLIENT_APPROVED: "bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-300",
  REJECTED: "bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const PLAN_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  ADVISER_APPROVED: "Adviser Approved",
  CLIENT_APPROVED: "Client Approved",
  REJECTED: "Rejected",
};

type RebalanceFilter = "ANY" | "NEEDS_ACTION" | "AWAITING_CLIENT" | "EXECUTING";

function SummaryTile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent && value > 0 ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-zinc-100"}`}>
        {value}
      </p>
    </div>
  );
}

export function GovernanceDashboard({
  summary,
  driftRows,
  sleeveRows,
  rebalanceRows,
  liquidityRiskRows,
  advisers,
}: {
  summary: GovernanceSummary;
  driftRows: ClientDriftRow[];
  sleeveRows: SleeveGovernanceRow[];
  rebalanceRows: RebalanceGovernanceRow[];
  liquidityRiskRows: ClientLiquidityRiskRow[];
  advisers: { id: string; name: string }[];
}) {
  const [adviserFilter, setAdviserFilter] = useState("ALL");
  const [breachOnly, setBreachOnly] = useState(false);
  const [warnCritOnly, setWarnCritOnly] = useState(false);
  const [rebalanceFilter, setRebalanceFilter] = useState<RebalanceFilter>("ANY");

  const filteredDrift = driftRows.filter((r) => {
    if (adviserFilter !== "ALL" && r.adviserId !== adviserFilter) return false;
    if (breachOnly && r.breachCount === 0) return false;
    return true;
  });

  const filteredSleeves = sleeveRows.filter((r) => {
    if (adviserFilter !== "ALL" && r.adviserId !== adviserFilter) return false;
    if (warnCritOnly && r.severity === "OK") return false;
    return true;
  });

  const filteredRebalance = rebalanceRows.filter((r) => {
    if (adviserFilter !== "ALL" && r.adviserId !== adviserFilter) return false;
    if (rebalanceFilter === "NEEDS_ACTION") {
      return r.latestPlanStatus === "DRAFT" || (r.breachCount > 0 && !r.latestPlanStatus);
    }
    if (rebalanceFilter === "AWAITING_CLIENT") {
      return r.latestPlanStatus === "ADVISER_APPROVED";
    }
    if (rebalanceFilter === "EXECUTING") {
      return r.latestPlanStatus === "CLIENT_APPROVED";
    }
    return true;
  });

  const filteredLiquidityRisk = liquidityRiskRows.filter((r) => {
    if (adviserFilter !== "ALL" && r.adviserId !== adviserFilter) return false;
    return true;
  });

  return (
    <div>
      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SummaryTile label="Total clients" value={summary.totalClients} />
        <SummaryTile label="Out of tolerance" value={summary.clientsOutOfTolerance} accent />
        <SummaryTile label="Sleeves WARN / CRITICAL" value={summary.sleevesWarnOrCritical} accent />
        <SummaryTile label="Pending approvals" value={summary.pendingApprovals} accent />
      </div>

      {/* Rebalance summary tiles */}
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5">
        <SummaryTile label="Rebalance: Draft" value={summary.rebalanceDraft} accent />
        <SummaryTile label="Rebalance: Adviser Approved" value={summary.rebalanceAdviserApproved} accent />
        <SummaryTile label="Rebalance: Client Approved" value={summary.rebalanceClientApproved} />
        <SummaryTile label="Rebalance: Orders pending fill" value={summary.rebalanceOrdersPendingFill} accent />
      </div>

      {/* Shared filters */}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <label className="text-sm text-zinc-600 dark:text-zinc-400">
          Adviser
          <select
            value={adviserFilter}
            onChange={(e) => setAdviserFilter(e.target.value)}
            className="ml-2 rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="ALL">All</option>
            {advisers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Drift table */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
            Client Drift
          </h2>
          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={breachOnly}
              onChange={(e) => setBreachOnly(e.target.checked)}
              className="rounded border-zinc-300"
            />
            Only breaches
          </label>
        </div>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="pb-2 font-medium text-zinc-500">Client</th>
              <th className="pb-2 font-medium text-zinc-500">Adviser</th>
              <th className="pb-2 text-right font-medium text-zinc-500">Out-of-tolerance</th>
              <th className="pb-2 text-right font-medium text-zinc-500">Worst drift</th>
              <th className="pb-2 font-medium text-zinc-500"></th>
            </tr>
          </thead>
          <tbody>
            {filteredDrift.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-zinc-400">
                  No clients match filters
                </td>
              </tr>
            )}
            {filteredDrift.map((r) => (
              <tr key={r.clientId} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="py-2 text-zinc-900 dark:text-zinc-100">{r.clientName}</td>
                <td className="py-2 text-zinc-600 dark:text-zinc-400">{r.adviserName}</td>
                <td className="py-2 text-right">
                  {r.hasSAA ? (
                    <span className={r.breachCount > 0 ? "font-medium text-red-600 dark:text-red-400" : "text-zinc-600 dark:text-zinc-400"}>
                      {r.breachCount}
                    </span>
                  ) : (
                    <span className="text-zinc-400">No SAA</span>
                  )}
                </td>
                <td className="py-2 text-right text-zinc-600 dark:text-zinc-400">
                  {r.hasSAA ? pct(r.maxAbsDrift) : "—"}
                </td>
                <td className="py-2 text-right">
                  <Link
                    href={`/clients/${r.clientId}`}
                    className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rebalance Workflow table */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
            Rebalance Workflow
          </h2>
          <label className="text-sm text-zinc-600 dark:text-zinc-400">
            Status
            <select
              value={rebalanceFilter}
              onChange={(e) => setRebalanceFilter(e.target.value as RebalanceFilter)}
              className="ml-2 rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="ANY">Any</option>
              <option value="NEEDS_ACTION">Needs action</option>
              <option value="AWAITING_CLIENT">Awaiting client</option>
              <option value="EXECUTING">Executing</option>
            </select>
          </label>
        </div>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="pb-2 font-medium text-zinc-500">Client</th>
              <th className="pb-2 font-medium text-zinc-500">Adviser</th>
              <th className="pb-2 text-right font-medium text-zinc-500">Out-of-tolerance</th>
              <th className="pb-2 font-medium text-zinc-500">Plan status</th>
              <th className="pb-2 text-right font-medium text-zinc-500">Trades</th>
              <th className="pb-2 font-medium text-zinc-500">Orders</th>
              <th className="pb-2 font-medium text-zinc-500">Last updated</th>
              <th className="pb-2 font-medium text-zinc-500"></th>
            </tr>
          </thead>
          <tbody>
            {filteredRebalance.length === 0 && (
              <tr>
                <td colSpan={8} className="py-4 text-center text-zinc-400">
                  No clients match filters
                </td>
              </tr>
            )}
            {filteredRebalance.map((r) => (
              <tr key={r.clientId} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="py-2 text-zinc-900 dark:text-zinc-100">{r.clientName}</td>
                <td className="py-2 text-zinc-600 dark:text-zinc-400">{r.adviserName}</td>
                <td className="py-2 text-right">
                  {r.breachCount > 0 ? (
                    <span className="font-medium text-red-600 dark:text-red-400">{r.breachCount}</span>
                  ) : (
                    <span className="text-zinc-400">0</span>
                  )}
                </td>
                <td className="py-2">
                  {r.latestPlanStatus ? (
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${PLAN_STATUS_COLORS[r.latestPlanStatus] ?? ""}`}>
                      {PLAN_STATUS_LABELS[r.latestPlanStatus] ?? r.latestPlanStatus}
                    </span>
                  ) : (
                    <span className="text-zinc-400">No plan</span>
                  )}
                </td>
                <td className="py-2 text-right text-zinc-600 dark:text-zinc-400">
                  {r.tradeCount > 0 ? r.tradeCount : "—"}
                </td>
                <td className="py-2 text-zinc-600 dark:text-zinc-400">
                  {r.ordersSummary}
                </td>
                <td className="py-2 text-zinc-500">
                  {r.lastUpdated
                    ? formatDate(r.lastUpdated)
                    : "—"}
                </td>
                <td className="py-2 text-right">
                  <Link
                    href={`/clients/${r.clientId}`}
                    className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sleeve governance table */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
            Sleeve Liquidity
          </h2>
          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={warnCritOnly}
              onChange={(e) => setWarnCritOnly(e.target.checked)}
              className="rounded border-zinc-300"
            />
            Only WARN / CRITICAL
          </label>
        </div>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="pb-2 font-medium text-zinc-500">Client</th>
              <th className="pb-2 font-medium text-zinc-500">Adviser</th>
              <th className="pb-2 font-medium text-zinc-500">Status</th>
              <th className="pb-2 text-right font-medium text-zinc-500">Shortfall</th>
              <th className="pb-2 text-right font-medium text-zinc-500">Alerts</th>
              <th className="pb-2 font-medium text-zinc-500"></th>
            </tr>
          </thead>
          <tbody>
            {filteredSleeves.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-zinc-400">
                  No sleeves match filters
                </td>
              </tr>
            )}
            {filteredSleeves.map((r) => (
              <tr key={r.clientId} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="py-2 text-zinc-900 dark:text-zinc-100">{r.clientName}</td>
                <td className="py-2 text-zinc-600 dark:text-zinc-400">{r.adviserName}</td>
                <td className="py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${SEVERITY_COLORS[r.severity]}`}>
                    {r.severity}
                  </span>
                </td>
                <td className="py-2 text-right text-zinc-600 dark:text-zinc-400">
                  {r.shortfall > 0 ? fmt(r.shortfall) : "—"}
                </td>
                <td className="py-2 text-right">
                  {r.activeAlertCount > 0 ? (
                    <span className="font-medium text-yellow-600 dark:text-yellow-400">{r.activeAlertCount}</span>
                  ) : (
                    <span className="text-zinc-400">0</span>
                  )}
                </td>
                <td className="py-2 text-right">
                  <Link
                    href={`/clients/${r.clientId}`}
                    className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Liquidity Risk table */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Liquidity Risk
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Portfolio liquidity by horizon (sorted by lowest 30d liquidity).
        </p>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="pb-2 font-medium text-zinc-500">Client</th>
              <th className="pb-2 font-medium text-zinc-500">Adviser</th>
              <th className="pb-2 text-right font-medium text-zinc-500">Total value</th>
              <th className="pb-2 text-right font-medium text-zinc-500">Liquid ≤30d</th>
              <th className="pb-2 text-right font-medium text-zinc-500">Liquid ≤90d</th>
              <th className="pb-2 text-right font-medium text-zinc-500">Assumed</th>
              <th className="pb-2 text-right font-medium text-zinc-500">Gated</th>
              <th className="pb-2 font-medium text-zinc-500"></th>
            </tr>
          </thead>
          <tbody>
            {filteredLiquidityRisk.length === 0 && (
              <tr>
                <td colSpan={8} className="py-4 text-center text-zinc-400">
                  No clients match filters
                </td>
              </tr>
            )}
            {filteredLiquidityRisk.map((r) => (
              <tr key={r.clientId} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="py-2 text-zinc-900 dark:text-zinc-100">{r.clientName}</td>
                <td className="py-2 text-zinc-600 dark:text-zinc-400">{r.adviserName}</td>
                <td className="py-2 text-right text-zinc-600 dark:text-zinc-400">
                  {fmt(r.totalValue)}
                </td>
                <td className="py-2 text-right">
                  <span className={r.pctLiquid30d < 0.3 ? "font-medium text-red-600 dark:text-red-400" : "text-zinc-600 dark:text-zinc-400"}>
                    {pct(r.pctLiquid30d)}
                  </span>
                </td>
                <td className="py-2 text-right">
                  <span className={r.pctLiquid90d < 0.5 ? "font-medium text-yellow-600 dark:text-yellow-400" : "text-zinc-600 dark:text-zinc-400"}>
                    {pct(r.pctLiquid90d)}
                  </span>
                </td>
                <td className="py-2 text-right">
                  {r.assumedCount > 0 ? (
                    <span className="font-medium text-yellow-600 dark:text-yellow-400">{r.assumedCount}</span>
                  ) : (
                    <span className="text-zinc-400">0</span>
                  )}
                </td>
                <td className="py-2 text-right">
                  {r.gatedCount > 0 ? (
                    <span className="font-medium text-red-600 dark:text-red-400">{r.gatedCount}</span>
                  ) : (
                    <span className="text-zinc-400">0</span>
                  )}
                </td>
                <td className="py-2 text-right">
                  <Link
                    href={`/clients/${r.clientId}`}
                    className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
