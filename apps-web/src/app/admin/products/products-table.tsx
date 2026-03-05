"use client";

import { useState, useTransition } from "react";
import {
  setProductLiquidityOverrideAction,
  removeProductLiquidityOverrideAction,
} from "./actions";

type ProductData = {
  id: string;
  name: string;
  type: string;
  effective: {
    tier: string;
    horizonDays: number;
    stressedHaircutPct: number;
    gateOrSuspendRisk: boolean;
    source: string;
  };
  override: {
    tier: string;
    horizonDays: number;
    stressedHaircutPct: number;
    gateOrSuspendRisk: boolean;
    noticeDays: number | null;
    redeemFrequency: string | null;
    gatePctPerPeriod: number | null;
  } | null;
};

const TIERS = [
  { value: "LISTED", label: "Listed" },
  { value: "FUND_LIQUID", label: "Fund Liquid" },
  { value: "FUND_SEMI_LIQUID", label: "Fund Semi-Liquid" },
  { value: "PRIVATE", label: "Private" },
  { value: "LOCKED", label: "Locked" },
];

const TIER_COLORS: Record<string, string> = {
  LISTED: "bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-300",
  FUND_LIQUID: "bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  FUND_SEMI_LIQUID: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  PRIVATE: "bg-orange-50 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  LOCKED: "bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const SOURCE_LABELS: Record<string, string> = {
  PRODUCT_OVERRIDE: "Override",
  TAXONOMY_DEFAULT: "Taxonomy",
  ASSUMED: "Assumed",
};

function ProductRow({ product }: { product: ProductData }) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await setProductLiquidityOverrideAction(product.id, formData);
    });
  }

  function handleRemove() {
    startTransition(async () => {
      await removeProductLiquidityOverrideAction(product.id);
    });
  }

  const eff = product.effective;
  const ov = product.override;

  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800">
      <td className="py-3 text-zinc-900 dark:text-zinc-100">{product.name}</td>
      <td className="py-3 text-xs text-zinc-500">{product.type}</td>
      <td className="py-3">
        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${TIER_COLORS[eff.tier] ?? ""}`}>
          {eff.tier}
        </span>
        {eff.gateOrSuspendRisk && (
          <span className="ml-1 rounded bg-red-50 px-1 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900 dark:text-red-300">
            Gated
          </span>
        )}
      </td>
      <td className="py-3 text-sm text-zinc-600 dark:text-zinc-400">
        {eff.horizonDays}d
      </td>
      <td className="py-3 text-sm text-zinc-600 dark:text-zinc-400">
        {(eff.stressedHaircutPct * 100).toFixed(0)}%
      </td>
      <td className="py-3 text-xs text-zinc-500">
        {SOURCE_LABELS[eff.source] ?? eff.source}
      </td>
      <td className="py-3">
        <form action={handleSubmit} className="flex flex-wrap items-center gap-1.5">
          <select
            name="tier"
            defaultValue={ov?.tier ?? eff.tier}
            className="rounded border border-zinc-300 px-1.5 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          >
            {TIERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            name="horizonDays"
            type="number"
            defaultValue={ov?.horizonDays ?? eff.horizonDays}
            min={0}
            className="w-14 rounded border border-zinc-300 px-1.5 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            title="Horizon days"
          />
          <input
            name="stressedHaircutPct"
            type="number"
            step="0.1"
            defaultValue={ov ? (ov.stressedHaircutPct * 100).toFixed(1) : (eff.stressedHaircutPct * 100).toFixed(1)}
            min={0}
            max={100}
            className="w-14 rounded border border-zinc-300 px-1.5 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            title="Haircut %"
          />
          <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400" title="Gate / suspend risk">
            <input
              name="gateOrSuspendRisk"
              type="checkbox"
              defaultChecked={ov?.gateOrSuspendRisk ?? eff.gateOrSuspendRisk}
              className="rounded border-zinc-300"
            />
            Gate
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isPending ? "…" : "Set"}
          </button>
          {ov && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={isPending}
              className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400"
            >
              Remove
            </button>
          )}
        </form>
      </td>
    </tr>
  );
}

export function ProductsTable({ products }: { products: ProductData[] }) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : products;

  return (
    <div>
      <input
        type="text"
        placeholder="Search products…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full max-w-sm rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="pb-2 font-medium text-zinc-500">Product</th>
            <th className="pb-2 font-medium text-zinc-500">Type</th>
            <th className="pb-2 font-medium text-zinc-500">Eff. tier</th>
            <th className="pb-2 font-medium text-zinc-500">Horizon</th>
            <th className="pb-2 font-medium text-zinc-500">Haircut</th>
            <th className="pb-2 font-medium text-zinc-500">Source</th>
            <th className="pb-2 font-medium text-zinc-500">Set override</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr>
              <td colSpan={7} className="py-4 text-center text-zinc-400">
                No products match search
              </td>
            </tr>
          )}
          {filtered.map((p) => (
            <ProductRow key={p.id} product={p} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
