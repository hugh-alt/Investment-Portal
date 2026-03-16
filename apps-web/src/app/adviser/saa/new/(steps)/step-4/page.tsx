"use client";

import { useState, useEffect } from "react";
import { useSAAWizard } from "../../wizard-context";
import { assignSAAToClientsAction } from "../../wizard-actions";

interface ClientRow {
  id: string;
  name: string;
  currentSaaName: string | null;
}

export default function Step4Page() {
  const { data, update } = useSAAWizard();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/clients-for-saa")
      .then((r) => r.json())
      .then((data) => {
        setClients(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (!data.saaId) {
    return (
      <p className="text-sm text-zinc-500">Please complete Step 1 first.</p>
    );
  }

  function toggleClient(clientId: string) {
    const selected = new Set(data.selectedClientIds);
    if (selected.has(clientId)) {
      selected.delete(clientId);
    } else {
      selected.add(clientId);
    }
    update({ selectedClientIds: [...selected] });
  }

  function selectAll() {
    update({ selectedClientIds: clients.map((c) => c.id) });
  }

  function selectNone() {
    update({ selectedClientIds: [] });
  }

  async function handleAssign() {
    if (data.selectedClientIds.length === 0) return;
    setAssigning(true);
    setResult(null);
    const res = await assignSAAToClientsAction(data.saaId, data.selectedClientIds);
    setAssigning(false);
    setResult(res);
  }

  if (loading) {
    return <p className="text-sm text-zinc-400">Loading clients...</p>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={selectAll}
          className="text-sm text-amber-600 hover:text-amber-700 cursor-pointer"
        >
          Select all
        </button>
        <span className="text-zinc-300">|</span>
        <button
          onClick={selectNone}
          className="text-sm text-zinc-500 hover:text-zinc-700 cursor-pointer"
        >
          Clear
        </button>
        <span className="ml-auto text-sm text-zinc-500">
          {data.selectedClientIds.length} of {clients.length} selected
        </span>
      </div>

      {clients.length === 0 ? (
        <p className="text-sm text-zinc-500">No clients available. You can skip this step.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-100">
                <th className="w-10 px-4 py-3" />
                <th className="px-4 py-3 text-left font-medium text-zinc-600">Client</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600">Current SAA</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => {
                const checked = data.selectedClientIds.includes(client.id);
                return (
                  <tr
                    key={client.id}
                    className={`border-b border-zinc-100 last:border-0 cursor-pointer transition-colors ${
                      checked ? "bg-amber-50" : "hover:bg-zinc-50"
                    }`}
                    onClick={() => toggleClient(client.id)}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleClient(client.id)}
                        className="h-4 w-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 text-zinc-900">{client.name}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {client.currentSaaName ?? "None"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data.selectedClientIds.length > 0 && (
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleAssign}
            disabled={assigning}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors disabled:bg-zinc-300 cursor-pointer disabled:cursor-not-allowed"
          >
            {assigning ? "Assigning..." : `Assign to ${data.selectedClientIds.length} client${data.selectedClientIds.length === 1 ? "" : "s"}`}
          </button>
          {result?.success && (
            <p className="text-sm text-emerald-600">Assigned successfully.</p>
          )}
          {result?.error && (
            <p className="text-sm text-red-600">{result.error}</p>
          )}
        </div>
      )}

      <p className="mt-4 text-xs text-zinc-400">
        You can skip this step and assign clients later. Click Confirm to finish.
      </p>
    </div>
  );
}
