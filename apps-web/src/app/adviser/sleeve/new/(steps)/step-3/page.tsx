"use client";

import { useState, useEffect } from "react";
import { useSleeveWizard } from "../../wizard-context";
import { loadApprovedFunds, addCommitmentsAction } from "../../wizard-actions";
import type { CommitmentEntry } from "../../wizard-config";

export default function Step3Page() {
  const { data, update } = useSleeveWizard();
  const [funds, setFunds] = useState<{ id: string; name: string; currency: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null);
  const [selectedFund, setSelectedFund] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!data.clientId) return;
    loadApprovedFunds(data.clientId).then((f) => { setFunds(f); setLoading(false); });
  }, [data.clientId]);

  if (!data.sleeveId) {
    return <p className="text-sm text-zinc-500">Complete Step 1 first.</p>;
  }

  function addCommitment() {
    if (!selectedFund || !amount) return;
    const a = parseFloat(amount);
    if (isNaN(a) || a <= 0) return;
    const fund = funds.find((f) => f.id === selectedFund);
    if (!fund) return;

    const entry: CommitmentEntry = {
      fundId: fund.id, fundName: fund.name, currency: fund.currency, commitmentAmount: a,
    };
    update({ commitments: [...data.commitments, entry], commitmentsSkipped: false });
    setSelectedFund("");
    setAmount("");
  }

  function removeCommitment(index: number) {
    update({ commitments: data.commitments.filter((_, i) => i !== index) });
  }

  function handleSkip() {
    update({ commitmentsSkipped: true, commitments: [] });
  }

  function handleUnskip() {
    update({ commitmentsSkipped: false });
  }

  async function handleSave() {
    setSaving(true);
    setResult(null);
    if (data.commitmentsSkipped) {
      // Clear any existing commitments in DB
      const res = await addCommitmentsAction(data.sleeveId, data.clientId, []);
      setSaving(false);
      setResult(res);
      return;
    }
    const res = await addCommitmentsAction(data.sleeveId, data.clientId, data.commitments);
    setSaving(false);
    setResult(res);
  }

  const totalCommitment = data.commitments.reduce((s, c) => s + c.commitmentAmount, 0);

  if (data.commitmentsSkipped) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-700">Commitments skipped</p>
          <p className="mt-1 text-xs text-amber-600">
            You can add fund commitments later from the client detail page.
            The sleeve will still be created with a liquid bucket and waterfall configuration.
          </p>
          <button
            onClick={handleUnskip}
            className="mt-3 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 cursor-pointer"
          >
            Add commitments instead
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 cursor-pointer disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Confirm Skip"}
          </button>
          {result?.success && <p className="text-sm text-emerald-600">Saved.</p>}
          {result?.error && <p className="text-sm text-red-600">{result.error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Skip option */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-700">No commitments yet?</p>
          <p className="text-xs text-zinc-500">
            Skip this step if you don&apos;t have fund commitments to add right now.
          </p>
        </div>
        <button
          onClick={handleSkip}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 cursor-pointer"
        >
          Skip for now
        </button>
      </div>

      {/* Existing commitments table */}
      {data.commitments.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-100">
                <th className="px-4 py-2 text-left font-medium text-zinc-600">Fund</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-600">Currency</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-600">Commitment</th>
                <th className="w-16 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.commitments.map((c, i) => (
                <tr key={i} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-2 text-zinc-900">{c.fundName}</td>
                  <td className="px-4 py-2 text-zinc-500">{c.currency}</td>
                  <td className="px-4 py-2 text-right text-zinc-900">
                    ${c.commitmentAmount.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => removeCommitment(i)} className="text-red-500 hover:text-red-700 text-xs cursor-pointer">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-200 bg-zinc-50">
                <td colSpan={2} className="px-4 py-2 font-medium text-zinc-900">Total</td>
                <td className="px-4 py-2 text-right font-medium text-zinc-900">
                  ${totalCommitment.toLocaleString()}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Add form */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <p className="mb-3 text-sm font-medium text-zinc-700">Add Fund Commitment</p>
        {loading ? (
          <p className="text-sm text-zinc-400">Loading approved funds...</p>
        ) : funds.length === 0 ? (
          <p className="text-sm text-zinc-400">No approved funds for this wealth group.</p>
        ) : (
          <div className="flex gap-3">
            <select
              value={selectedFund}
              onChange={(e) => setSelectedFund(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none"
            >
              <option value="">Select fund...</option>
              {funds.map((f) => (
                <option key={f.id} value={f.id}>{f.name} ({f.currency})</option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="10000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              className="w-40 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none"
            />
            <button
              onClick={addCommitment}
              disabled={!selectedFund || !amount}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 cursor-pointer disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
        )}
      </div>

      {/* Save */}
      {data.commitments.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 cursor-pointer disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Commitments"}
          </button>
          {result?.success && <p className="text-sm text-emerald-600">Saved.</p>}
          {result?.error && <p className="text-sm text-red-600">{result.error}</p>}
        </div>
      )}
    </div>
  );
}
