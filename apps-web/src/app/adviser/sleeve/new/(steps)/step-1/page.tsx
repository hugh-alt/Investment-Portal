"use client";

import { useState, useEffect } from "react";
import { useSleeveWizard } from "../../wizard-context";
import { createSleeveDraftAction, loadClientsForSleeve, loadClientPortfolioValue } from "../../wizard-actions";
import type { TargetMode, BufferBasis } from "../../wizard-config";

const fmt = (v: number) =>
  "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function Step1Page() {
  const { data, update } = useSleeveWizard();
  const [clients, setClients] = useState<{ id: string; name: string; hasSleeve: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadClientsForSleeve().then((c) => { setClients(c); setLoading(false); });
  }, []);

  // Load portfolio value when client changes
  useEffect(() => {
    if (!data.clientId) return;
    loadClientPortfolioValue(data.clientId).then((v) => update({ portfolioValue: v }));
  }, [data.clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasSleeve = data.sleeveId.length > 0;

  // Compute $ equivalent of target
  const targetPctNum = parseFloat(data.targetPct) || 0;
  const targetAmountNum = parseFloat(data.targetAmount) || 0;
  const computedTargetDollars = data.targetMode === "PCT_PORTFOLIO"
    ? data.portfolioValue * (targetPctNum / 100)
    : targetAmountNum;

  async function handleCreate() {
    if (!data.clientId || !data.sleeveName.trim()) return;
    setCreating(true);
    setError(null);
    const tPct = data.targetMode === "PCT_PORTFOLIO"
      ? (parseFloat(data.targetPct) || 0) / 100
      : null;
    const cbPct = data.bufferEnabled ? (parseFloat(data.cashBufferPct) || 5) / 100 : 0;

    const configJson = JSON.stringify({
      targetMode: data.targetMode,
      targetAmount: data.targetMode === "ABS_AMOUNT" ? targetAmountNum : undefined,
      bufferEnabled: data.bufferEnabled,
      bufferBasis: data.bufferBasis,
    });

    const result = await createSleeveDraftAction(data.clientId, data.sleeveName, tPct, cbPct, configJson);
    setCreating(false);
    if (result.error) {
      setError(result.error);
    } else if (result.sleeveId) {
      const client = clients.find((c) => c.id === data.clientId);
      update({ sleeveId: result.sleeveId, clientName: client?.name ?? "" });
    }
  }

  const availableClients = clients.filter((c) => !c.hasSleeve);

  return (
    <div className="space-y-5">
      {/* Client select */}
      <div>
        <label htmlFor="client-select" className="block text-sm font-medium text-zinc-700">
          Client <span className="text-red-500">*</span>
        </label>
        {loading ? (
          <p className="mt-1 text-sm text-zinc-400">Loading...</p>
        ) : (
          <select
            id="client-select"
            value={data.clientId}
            onChange={(e) => update({ clientId: e.target.value })}
            disabled={hasSleeve}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-zinc-50 disabled:text-zinc-500"
          >
            <option value="">Select a client...</option>
            {availableClients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        {!loading && availableClients.length === 0 && (
          <p className="mt-1 text-xs text-zinc-400">All clients already have sleeves.</p>
        )}
        {data.portfolioValue > 0 && (
          <p className="mt-1 text-xs text-zinc-500">Portfolio value: {fmt(data.portfolioValue)}</p>
        )}
      </div>

      {/* Sleeve name */}
      <div>
        <label htmlFor="sleeve-name" className="block text-sm font-medium text-zinc-700">
          Sleeve Name <span className="text-red-500">*</span>
        </label>
        <input
          id="sleeve-name"
          type="text"
          value={data.sleeveName}
          onChange={(e) => update({ sleeveName: e.target.value })}
          disabled={hasSleeve}
          placeholder="e.g. PM Sleeve"
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-zinc-50 disabled:text-zinc-500"
        />
      </div>

      {/* Target mode toggle */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-2">Target Mode</label>
        <div className="flex gap-3">
          {([
            { value: "PCT_PORTFOLIO" as TargetMode, label: "% of Portfolio", desc: "Set as a percentage of total portfolio value." },
            { value: "ABS_AMOUNT" as TargetMode, label: "$ Amount", desc: "Set a fixed dollar amount for the sleeve." },
          ]).map((opt) => (
            <label
              key={opt.value}
              className={`flex-1 cursor-pointer rounded-lg border p-3 text-sm transition-colors ${
                data.targetMode === opt.value
                  ? "border-amber-300 bg-amber-50 text-amber-700"
                  : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              } ${hasSleeve ? "pointer-events-none opacity-60" : ""}`}
            >
              <input
                type="radio"
                name="targetMode"
                value={opt.value}
                checked={data.targetMode === opt.value}
                onChange={() => update({ targetMode: opt.value })}
                disabled={hasSleeve}
                className="sr-only"
              />
              <span className="font-medium">{opt.label}</span>
              <p className="mt-1 text-xs text-zinc-500">{opt.desc}</p>
            </label>
          ))}
        </div>
      </div>

      {/* Target value input */}
      <div className="grid grid-cols-2 gap-4">
        {data.targetMode === "PCT_PORTFOLIO" ? (
          <div>
            <label htmlFor="target-pct" className="block text-sm font-medium text-zinc-700">
              Target Allocation (%)
            </label>
            <input
              id="target-pct"
              type="number"
              min="0" max="100" step="1"
              value={data.targetPct}
              onChange={(e) => update({ targetPct: e.target.value })}
              disabled={hasSleeve}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-zinc-50 disabled:text-zinc-500"
            />
            {data.portfolioValue > 0 && (
              <p className="mt-1 text-xs text-zinc-500">
                = {fmt(computedTargetDollars)}
              </p>
            )}
          </div>
        ) : (
          <div>
            <label htmlFor="target-amount" className="block text-sm font-medium text-zinc-700">
              Target Amount ($)
            </label>
            <input
              id="target-amount"
              type="number"
              min="0" step="1000"
              value={data.targetAmount}
              onChange={(e) => update({ targetAmount: e.target.value })}
              disabled={hasSleeve}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-zinc-50 disabled:text-zinc-500"
            />
            {data.portfolioValue > 0 && targetAmountNum > 0 && (
              <p className="mt-1 text-xs text-zinc-500">
                = {((targetAmountNum / data.portfolioValue) * 100).toFixed(1)}% of portfolio
              </p>
            )}
          </div>
        )}
      </div>

      {/* Buffer enable toggle */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={data.bufferEnabled}
            onChange={(e) => update({ bufferEnabled: e.target.checked })}
            disabled={hasSleeve}
            className="h-4 w-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
          />
          <div>
            <span className="text-sm font-medium text-zinc-700">Enable Cash Buffer</span>
            <p className="text-xs text-zinc-500">Hold a cash reserve to cover upcoming capital calls.</p>
          </div>
        </label>

        {data.bufferEnabled && (
          <>
            <div>
              <label htmlFor="buffer-basis" className="block text-xs font-medium text-zinc-600 mb-1">
                Buffer Basis
              </label>
              <select
                id="buffer-basis"
                value={data.bufferBasis}
                onChange={(e) => update({ bufferBasis: e.target.value as BufferBasis })}
                disabled={hasSleeve}
                className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none disabled:bg-zinc-50 disabled:text-zinc-500"
              >
                <option value="PCT_UNFUNDED">% of Unfunded Commitments</option>
                <option value="PCT_LIQUID_BUCKET">% of Liquid Bucket</option>
                <option value="ABS_AMOUNT">Fixed $ Amount</option>
              </select>
            </div>
            <div>
              <label htmlFor="buffer-pct" className="block text-xs font-medium text-zinc-600 mb-1">
                Buffer {data.bufferBasis === "ABS_AMOUNT" ? "Amount ($)" : "(%)"}
              </label>
              <input
                id="buffer-pct"
                type="number"
                min="0" max={data.bufferBasis === "ABS_AMOUNT" ? undefined : "100"} step="1"
                value={data.cashBufferPct}
                onChange={(e) => update({ cashBufferPct: e.target.value })}
                disabled={hasSleeve}
                className="w-32 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none disabled:bg-zinc-50 disabled:text-zinc-500"
              />
            </div>
          </>
        )}
      </div>

      {/* Create button */}
      {!hasSleeve && (
        <button
          onClick={handleCreate}
          disabled={!data.clientId || !data.sleeveName.trim() || creating}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors disabled:bg-zinc-300 disabled:text-zinc-500 cursor-pointer disabled:cursor-not-allowed"
        >
          {creating ? "Creating..." : "Create Sleeve Draft"}
        </button>
      )}

      {hasSleeve && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-medium text-emerald-700">Sleeve draft created for {data.clientName}.</p>
          <p className="mt-1 text-xs text-emerald-600">Click Next to configure the liquid bucket.</p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
