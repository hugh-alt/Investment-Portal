"use client";

import { useState } from "react";
import { useRebalanceWizard } from "../../wizard-context";
import {
  createRebalanceOrdersWizardAction,
  submitRebalanceOrdersWizardAction,
  fillRebalanceOrdersWizardAction,
} from "../../wizard-actions";
import { EXECUTION_STATUS_LABELS, type ExecutionStatus } from "@/lib/execution";

const money = (v: number) => "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ORDER_STATUS_COLORS: Record<string, string> = {
  CREATED: "bg-zinc-100 text-zinc-600",
  SUBMITTED: "bg-blue-50 text-blue-700",
  PARTIALLY_FILLED: "bg-yellow-50 text-yellow-700",
  FILLED: "bg-green-50 text-green-700",
  REJECTED: "bg-red-50 text-red-700",
  CANCELLED: "bg-zinc-100 text-zinc-500",
};

export default function Step6Page() {
  const { data, update } = useRebalanceWizard();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!data.planId) {
    return <p className="text-sm text-zinc-500">Complete Step 1 first.</p>;
  }

  if (data.planStatus !== "CLIENT_APPROVED") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-zinc-500">Plan must be fully approved before execution.</p>
        <p className="text-xs text-zinc-400">Current status: {data.planStatus}. Go to Step 5 to complete approvals.</p>
      </div>
    );
  }

  const hasOrders = data.orders.length > 0;
  const hasCreatedOrders = data.orders.some((o) => o.status === "CREATED");
  const hasSubmittedOrders = data.orders.some((o) => o.status === "SUBMITTED" || o.status === "PARTIALLY_FILLED");
  const allFilled = hasOrders && data.orders.every((o) => o.status === "FILLED");

  async function handleAction(fn: () => Promise<{ error?: string; orders?: typeof data.orders }>) {
    setPending(true);
    setError(null);
    const result = await fn();
    setPending(false);
    if (result.error) setError(result.error);
    if (result.orders) update({ orders: result.orders });
  }

  function handleExportTradesCSV() {
    const rows = [
      ["Side", "Product", "Amount", "Reason"],
      ...data.trades.map((t) => [t.side, t.productName, t.amount.toFixed(2), t.reason]),
    ];
    downloadCSV(rows, `rebalance-trades-${data.planId.slice(0, 8)}.csv`);
  }

  function handleExportOrdersCSV() {
    const rows = [
      ["ClientId", "PlanId", "Product", "Side", "Amount", "Status", "LastEvent"],
      ...data.orders.map((o) => [data.clientId, data.planId, o.productName, o.side, o.amount.toFixed(2), o.status, o.lastEvent ?? ""]),
    ];
    downloadCSV(rows, `rebalance-orders-${data.planId.slice(0, 8)}.csv`);
  }

  return (
    <div className="space-y-5">
      {/* Execution actions */}
      <div className="flex gap-2 flex-wrap">
        {!hasOrders && (
          <button
            onClick={() => handleAction(() => createRebalanceOrdersWizardAction(data.planId))}
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 cursor-pointer disabled:cursor-not-allowed"
          >
            {pending ? "..." : "Create Orders"}
          </button>
        )}
        {hasCreatedOrders && (
          <button
            onClick={() => handleAction(() => submitRebalanceOrdersWizardAction(data.planId))}
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 cursor-pointer disabled:cursor-not-allowed"
          >
            {pending ? "..." : "Simulate Submit"}
          </button>
        )}
        {hasSubmittedOrders && (
          <button
            onClick={() => handleAction(() => fillRebalanceOrdersWizardAction(data.planId))}
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 cursor-pointer disabled:cursor-not-allowed"
          >
            {pending ? "..." : "Simulate Fills"}
          </button>
        )}
        {hasOrders && (
          <>
            <button
              onClick={handleExportTradesCSV}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 cursor-pointer"
            >
              Export Trades CSV
            </button>
            <button
              onClick={handleExportOrdersCSV}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 cursor-pointer"
            >
              Export Orders CSV
            </button>
          </>
        )}
      </div>

      {/* All filled success */}
      {allFilled && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-medium text-emerald-700">All orders filled.</p>
          <p className="mt-1 text-xs text-emerald-600">Click Confirm to complete the rebalance wizard.</p>
        </div>
      )}

      {/* Order blotter */}
      {hasOrders && (
        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-100">
                <th className="px-4 py-2 text-left font-medium text-zinc-600">Side</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-600">Product</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-600">Amount</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-600">Status</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-600">Note</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.map((o) => (
                <tr key={o.id} className="border-b border-zinc-100 last:border-0">
                  <td className={`px-4 py-2 font-medium ${o.side === "SELL" ? "text-red-600" : "text-emerald-600"}`}>
                    {o.side}
                  </td>
                  <td className="px-4 py-2 text-zinc-900">{o.productName}</td>
                  <td className="px-4 py-2 text-right text-zinc-900">{money(o.amount)}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_COLORS[o.status] ?? ""}`}>
                      {EXECUTION_STATUS_LABELS[o.status as ExecutionStatus] ?? o.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-400">{o.lastEvent ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!hasOrders && (
        <p className="text-xs text-zinc-400">Click &quot;Create Orders&quot; to start the execution simulation.</p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function downloadCSV(rows: string[][], filename: string) {
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
