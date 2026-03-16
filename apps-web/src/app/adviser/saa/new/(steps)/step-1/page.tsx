"use client";

import { useState, useEffect } from "react";
import { useSAAWizard } from "../../wizard-context";
import { createDraftSAAAction } from "../../wizard-actions";

export default function Step1Page() {
  const { data, update } = useSAAWizard();
  const [taxonomies, setTaxonomies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch taxonomies on mount
  useEffect(() => {
    fetch("/api/taxonomies")
      .then((r) => r.json())
      .then((data) => {
        setTaxonomies(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const hasName = data.name.trim().length > 0;
  const hasTaxonomy = data.taxonomyId.length > 0;
  const hasSaaId = data.saaId.length > 0;
  const canCreate = hasName && hasTaxonomy && !hasSaaId;

  async function handleCreate() {
    if (!canCreate) return;
    setCreating(true);
    setError(null);
    const result = await createDraftSAAAction(data.name, data.taxonomyId);
    setCreating(false);
    if (result.error) {
      setError(result.error);
    } else if (result.saaId) {
      update({ saaId: result.saaId });
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="saa-name" className="block text-sm font-medium text-zinc-700">
          SAA Name <span className="text-red-500">*</span>
        </label>
        <input
          id="saa-name"
          type="text"
          value={data.name}
          onChange={(e) => update({ name: e.target.value })}
          disabled={hasSaaId}
          placeholder="e.g. Balanced Growth"
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-zinc-50 disabled:text-zinc-500"
        />
      </div>

      <div>
        <label htmlFor="taxonomy-select" className="block text-sm font-medium text-zinc-700">
          Taxonomy <span className="text-red-500">*</span>
        </label>
        {loading ? (
          <p className="mt-1 text-sm text-zinc-400">Loading taxonomies...</p>
        ) : (
          <select
            id="taxonomy-select"
            value={data.taxonomyId}
            onChange={(e) => update({ taxonomyId: e.target.value })}
            disabled={hasSaaId}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-zinc-50 disabled:text-zinc-500"
          >
            <option value="">Select a taxonomy...</option>
            {taxonomies.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {!hasSaaId && (
        <button
          onClick={handleCreate}
          disabled={!canCreate || creating}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors disabled:bg-zinc-300 disabled:text-zinc-500 cursor-pointer disabled:cursor-not-allowed"
        >
          {creating ? "Creating..." : "Create SAA Draft"}
        </button>
      )}

      {hasSaaId && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-medium text-emerald-700">
            SAA draft created successfully.
          </p>
          <p className="mt-1 text-xs text-emerald-600">
            Click Next to set target allocations.
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
