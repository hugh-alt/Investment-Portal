"use client";

import { useState, useEffect } from "react";
import { useRebalanceWizard } from "../../wizard-context";
import { loadClientsForRebalance, loadSAAList, generateRebalancePlanWizardAction, loadSleeveSummary } from "../../wizard-actions";

export default function Step1Page() {
  const { data, update } = useRebalanceWizard();
  const [clients, setClients] = useState<{ id: string; name: string; hasSAA: boolean; saaId: string | null; saaName: string | null }[]>([]);
  const [saaList, setSaaList] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadClientsForRebalance(), loadSAAList()]).then(([c, s]) => {
      setClients(c);
      setSaaList(s);
      setLoading(false);
    });
  }, []);

  const hasPlan = data.planId.length > 0;
  const selectedClient = clients.find((c) => c.id === data.clientId);
  const clientHasSAA = selectedClient?.hasSAA ?? false;

  function handleClientChange(clientId: string) {
    const client = clients.find((c) => c.id === clientId);
    update({
      clientId,
      clientName: client?.name ?? "",
      saaId: client?.saaId ?? "",
      saaName: client?.saaName ?? "",
    });
  }

  async function handleGenerate() {
    if (!data.clientId) return;
    if (!clientHasSAA && !data.saaId) return;
    setGenerating(true);
    setError(null);

    const result = await generateRebalancePlanWizardAction(data.clientId, data.saaId);
    setGenerating(false);

    if (result.error) {
      setError(result.error);
    } else {
      const trades = result.trades ?? [];
      // Load sleeve summary in parallel
      const sleeveSummary = await loadSleeveSummary(data.clientId);
      update({
        planId: result.planId ?? "",
        totalPortfolioValue: result.totalPortfolioValue ?? 0,
        breachesBefore: result.breachesBefore ?? 0,
        breachesAfter: result.breachesAfter ?? 0,
        beforeDrift: result.beforeDrift ?? [],
        afterDrift: result.afterDrift ?? [],
        trades,
        originalTrades: trades,
        availableProducts: result.availableProducts ?? [],
        planStatus: "DRAFT",
        sleeveSummary,
      });
    }
  }

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
            onChange={(e) => handleClientChange(e.target.value)}
            disabled={hasPlan}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-zinc-50 disabled:text-zinc-500"
          >
            <option value="">Select a client...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.hasSAA ? `(SAA: ${c.saaName})` : "(no SAA)"}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* SAA select (only if client has no SAA assigned) */}
      {data.clientId && !clientHasSAA && (
        <div>
          <label htmlFor="saa-select" className="block text-sm font-medium text-zinc-700">
            Assign SAA <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-zinc-500 mb-1">This client has no SAA. Select one to assign.</p>
          <select
            id="saa-select"
            value={data.saaId}
            onChange={(e) => {
              const saa = saaList.find((s) => s.id === e.target.value);
              update({ saaId: e.target.value, saaName: saa?.name ?? "" });
            }}
            disabled={hasPlan}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-zinc-50 disabled:text-zinc-500"
          >
            <option value="">Select an SAA...</option>
            {saaList.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* SAA info if client already has one */}
      {data.clientId && clientHasSAA && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-sm text-zinc-700">
            SAA: <span className="font-medium">{selectedClient?.saaName}</span>
          </p>
        </div>
      )}

      {/* Generate button */}
      {!hasPlan && (
        <button
          onClick={handleGenerate}
          disabled={!data.clientId || (!clientHasSAA && !data.saaId) || generating}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors disabled:bg-zinc-300 disabled:text-zinc-500 cursor-pointer disabled:cursor-not-allowed"
        >
          {generating ? "Generating plan..." : "Generate Rebalance Plan"}
        </button>
      )}

      {/* Success */}
      {hasPlan && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-medium text-emerald-700">
            Rebalance plan generated for {data.clientName}.
          </p>
          <p className="mt-1 text-xs text-emerald-600">
            {data.breachesBefore} tolerance breach{data.breachesBefore !== 1 ? "es" : ""} found,
            {" "}{data.trades.length} trade{data.trades.length !== 1 ? "s" : ""} proposed.
            Click Next to review drift.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
