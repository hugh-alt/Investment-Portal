"use client";

import { useActionState, useState } from "react";
import { setAdviserLiquidityOverrideAction, removeAdviserLiquidityOverrideAction } from "./actions";

const TIERS = ["LISTED", "FUND_LIQUID", "FUND_SEMI_LIQUID", "PRIVATE", "LOCKED"] as const;
const pct = (v: number) => (v * 100).toFixed(1) + "%";

type ProductOption = {
  id: string;
  name: string;
  type: string;
  hasPlatformOverride: boolean;
};

type OverrideRow = {
  productId: string;
  productName: string;
  tier: string;
  horizonDays: number;
  stressedHaircutPct: number;
  noticeDays: number | null;
  gatePctPerPeriod: number | null;
  gatePeriodDays: number | null;
  gateOrSuspendRisk: boolean;
};

export function AdviserOverrideForm({
  products,
  existingOverrides,
}: {
  products: ProductOption[];
  existingOverrides: OverrideRow[];
}) {
  const [state, formAction, isPending] = useActionState(setAdviserLiquidityOverrideAction, null);
  const [selectedProductId, setSelectedProductId] = useState("");

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  return (
    <div className="space-y-6">
      {/* Existing overrides */}
      {existingOverrides.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Your overrides
          </h3>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="pb-2 font-medium text-zinc-500">Product</th>
                <th className="pb-2 font-medium text-zinc-500">Tier</th>
                <th className="pb-2 text-right font-medium text-zinc-500">Horizon</th>
                <th className="pb-2 text-right font-medium text-zinc-500">Haircut</th>
                <th className="pb-2 text-right font-medium text-zinc-500">Notice</th>
                <th className="pb-2 text-right font-medium text-zinc-500">Gate %</th>
                <th className="pb-2 text-right font-medium text-zinc-500">Gate period</th>
                <th className="pb-2 font-medium text-zinc-500" />
              </tr>
            </thead>
            <tbody>
              {existingOverrides.map((o) => (
                <tr key={o.productId} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-2 text-zinc-900 dark:text-zinc-100">{o.productName}</td>
                  <td className="py-2 text-zinc-600 dark:text-zinc-400">{o.tier}</td>
                  <td className="py-2 text-right text-zinc-600 dark:text-zinc-400">{o.horizonDays}d</td>
                  <td className="py-2 text-right text-zinc-600 dark:text-zinc-400">{pct(o.stressedHaircutPct)}</td>
                  <td className="py-2 text-right text-zinc-600 dark:text-zinc-400">
                    {o.noticeDays != null ? `${o.noticeDays}d` : "—"}
                  </td>
                  <td className="py-2 text-right text-zinc-600 dark:text-zinc-400">
                    {o.gatePctPerPeriod != null ? pct(o.gatePctPerPeriod) : "—"}
                  </td>
                  <td className="py-2 text-right text-zinc-600 dark:text-zinc-400">
                    {o.gatePeriodDays != null ? `${o.gatePeriodDays}d` : "—"}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => removeAdviserLiquidityOverrideAction(o.productId)}
                      className="text-xs text-red-600 hover:text-red-800 dark:text-red-400"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/update override form */}
      <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
          Set override
        </h3>
        <form action={formAction} className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Product</label>
            <select
              name="productId"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              required
            >
              <option value="">Select product...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id} disabled={p.hasPlatformOverride}>
                  {p.name} ({p.type}){p.hasPlatformOverride ? " [Platform override]" : ""}
                </option>
              ))}
            </select>
          </div>

          {selectedProduct?.hasPlatformOverride && (
            <p className="text-xs text-red-600 dark:text-red-400">
              This product has a platform-level override and cannot be changed here.
            </p>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Tier</label>
              <select
                name="tier"
                className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                required
              >
                {TIERS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Horizon (days)</label>
              <input
                name="horizonDays"
                type="number"
                min={1}
                defaultValue={30}
                className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Haircut %</label>
              <input
                name="stressedHaircutPct"
                type="number"
                min={0}
                max={100}
                step={0.1}
                defaultValue={5}
                className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Notice days</label>
              <input
                name="noticeDays"
                type="number"
                min={0}
                className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Gate % per period</label>
              <input
                name="gatePctPerPeriod"
                type="number"
                min={0}
                max={100}
                step={0.1}
                className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Gate period (days)</label>
              <input
                name="gatePeriodDays"
                type="number"
                min={1}
                className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          </div>

          {state?.error && (
            <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isPending ? "Saving..." : "Save override"}
          </button>
        </form>
      </div>
    </div>
  );
}
