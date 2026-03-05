"use client";

import { useState, useTransition } from "react";
import {
  generateRebalancePlanAction,
  approveRebalancePlanAction,
  rejectRebalancePlanAction,
} from "./rebalance-actions";
import { statusLabel, nextStepLabel, type ApprovalStatus } from "@/lib/approval";

const pct = (v: number) => (v * 100).toFixed(1) + "%";
const money = (v: number) => "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Trade = {
  id: string;
  productId: string;
  productName: string;
  side: string;
  amount: number;
  reason: string;
};

type DriftRow = {
  nodeId: string;
  nodeName: string;
  currentWeight: number;
  targetWeight: number;
  minWeight: number;
  maxWeight: number;
  drift: number;
  status: string;
};

type PlanSummary = {
  totalPortfolioValue: number;
  breachesBefore: number;
  breachesAfter: number;
  beforeDrift: DriftRow[];
  afterDrift: DriftRow[];
};

type Event = {
  id: string;
  action: string;
  actorRole: string;
  note: string | null;
  createdAt: string;
};

type Plan = {
  id: string;
  status: string;
  summary: PlanSummary;
  createdAt: string;
  trades: Trade[];
  events: Event[];
};

export function RebalanceGenerateButton({ clientId }: { clientId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = () => {
    setError(null);
    startTransition(async () => {
      const result = await generateRebalancePlanAction(clientId);
      if (result.error) setError(result.error);
    });
  };

  return (
    <div className="mt-3">
      <button
        onClick={handleGenerate}
        disabled={isPending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isPending ? "Generating..." : "Generate rebalance plan"}
      </button>
      {error && <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">{error}</p>}
    </div>
  );
}

export function RebalancePlanCard({ plan }: { plan: Plan }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showDrift, setShowDrift] = useState(false);

  const sells = plan.trades.filter((t) => t.side === "SELL");
  const buys = plan.trades.filter((t) => t.side === "BUY");
  const totalSell = sells.reduce((s, t) => s + t.amount, 0);
  const totalBuy = buys.reduce((s, t) => s + t.amount, 0);

  const handleApprove = () => {
    setError(null);
    startTransition(async () => {
      const result = await approveRebalancePlanAction(plan.id);
      if (result.error) setError(result.error);
    });
  };

  const handleReject = () => {
    setError(null);
    startTransition(async () => {
      const result = await rejectRebalancePlanAction(plan.id);
      if (result.error) setError(result.error);
    });
  };

  const handleExportCSV = () => {
    const rows = [
      ["Side", "Product", "Amount", "Reason"],
      ...plan.trades.map((t) => [t.side, t.productName, t.amount.toFixed(2), t.reason]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rebalance-${plan.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusColor: Record<string, string> = {
    DRAFT: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    ADVISER_APPROVED: "bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    CLIENT_APPROVED: "bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-300",
    REJECTED: "bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-300",
  };

  const canAct = plan.status === "DRAFT" || plan.status === "ADVISER_APPROVED";
  const step = nextStepLabel(plan.status as ApprovalStatus);

  return (
    <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusColor[plan.status] ?? ""}`}>
            {statusLabel(plan.status as ApprovalStatus)}
          </span>
          <span className="text-xs text-zinc-400">
            {new Date(plan.createdAt).toLocaleDateString()}
          </span>
        </div>
        <button
          onClick={handleExportCSV}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
        >
          Export CSV
        </button>
      </div>

      {step && <p className="mt-1 text-xs text-zinc-400">{step}</p>}

      {/* Summary tiles */}
      <div className="mt-3 flex gap-4 text-xs">
        <div>
          <p className="font-medium text-zinc-500">Breaches</p>
          <p className="text-zinc-900 dark:text-zinc-100">
            {plan.summary.breachesBefore} → {plan.summary.breachesAfter}
          </p>
        </div>
        <div>
          <p className="font-medium text-zinc-500">Total sells</p>
          <p className="text-red-600 dark:text-red-400">{money(totalSell)}</p>
        </div>
        <div>
          <p className="font-medium text-zinc-500">Total buys</p>
          <p className="text-green-600 dark:text-green-400">{money(totalBuy)}</p>
        </div>
        <div>
          <p className="font-medium text-zinc-500">Portfolio</p>
          <p className="text-zinc-900 dark:text-zinc-100">{money(plan.summary.totalPortfolioValue)}</p>
        </div>
      </div>

      {/* Trades table */}
      <table className="mt-3 w-full text-left text-xs">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="pb-1 font-medium text-zinc-500">Side</th>
            <th className="pb-1 font-medium text-zinc-500">Product</th>
            <th className="pb-1 text-right font-medium text-zinc-500">Amount</th>
            <th className="pb-1 font-medium text-zinc-500">Reason</th>
          </tr>
        </thead>
        <tbody>
          {plan.trades.map((t) => (
            <tr key={t.id} className="border-b border-zinc-100 dark:border-zinc-800">
              <td className={`py-1 font-medium ${t.side === "SELL" ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                {t.side}
              </td>
              <td className="py-1 text-zinc-900 dark:text-zinc-100">{t.productName}</td>
              <td className="py-1 text-right text-zinc-900 dark:text-zinc-100">{money(t.amount)}</td>
              <td className="py-1 text-zinc-500">{t.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Before/after drift toggle */}
      <button
        onClick={() => setShowDrift(!showDrift)}
        className="mt-2 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
      >
        {showDrift ? "Hide" : "Show"} before/after drift
      </button>

      {showDrift && (
        <div className="mt-2 grid grid-cols-2 gap-3">
          <DriftTable title="Before" rows={plan.summary.beforeDrift} />
          <DriftTable title="After" rows={plan.summary.afterDrift} />
        </div>
      )}

      {/* Approval events */}
      {plan.events.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-zinc-500">History</p>
          {plan.events.map((e) => (
            <p key={e.id} className="text-xs text-zinc-400">
              {e.action} by {e.actorRole} on {new Date(e.createdAt).toLocaleDateString()}
              {e.note && ` — ${e.note}`}
            </p>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {canAct && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleApprove}
            disabled={isPending}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isPending ? "..." : "Approve"}
          </button>
          <button
            onClick={handleReject}
            disabled={isPending}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            Reject
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function DriftTable({ title, rows }: { title: string; rows: DriftRow[] }) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-500">{title}</p>
      <table className="mt-1 w-full text-xs">
        <thead>
          <tr className="text-zinc-400">
            <th className="pb-0.5 text-left font-medium">Node</th>
            <th className="pb-0.5 text-right font-medium">Current</th>
            <th className="pb-0.5 text-right font-medium">Target</th>
            <th className="pb-0.5 text-right font-medium">Drift</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.nodeId}>
              <td className="py-0.5 text-zinc-700 dark:text-zinc-300">{r.nodeName}</td>
              <td className="py-0.5 text-right text-zinc-500">{pct(r.currentWeight)}</td>
              <td className="py-0.5 text-right text-zinc-500">{pct(r.targetWeight)}</td>
              <td className={`py-0.5 text-right font-medium ${r.status === "within" ? "text-zinc-500" : "text-red-600 dark:text-red-400"}`}>
                {r.drift >= 0 ? "+" : ""}{pct(r.drift)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
