"use client";

import { useTransition } from "react";
import {
  setProductLiquidityOverrideAction,
  removeProductLiquidityOverrideAction,
} from "./actions";

type ProductData = {
  id: string;
  name: string;
  type: string;
  override: {
    tier: string;
    horizonDays: number;
    stressedHaircutPct: number;
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

  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800">
      <td className="py-3 text-zinc-900 dark:text-zinc-100">{product.name}</td>
      <td className="py-3 text-xs text-zinc-500">{product.type}</td>
      <td className="py-3">
        {product.override ? (
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${TIER_COLORS[product.override.tier] ?? ""}`}>
            {product.override.tier}
          </span>
        ) : (
          <span className="text-xs text-zinc-400">Taxonomy default</span>
        )}
      </td>
      <td className="py-3 text-sm text-zinc-600 dark:text-zinc-400">
        {product.override ? `${product.override.horizonDays}d` : "—"}
      </td>
      <td className="py-3 text-sm text-zinc-600 dark:text-zinc-400">
        {product.override
          ? `${(product.override.stressedHaircutPct * 100).toFixed(0)}%`
          : "—"}
      </td>
      <td className="py-3">
        <form action={handleSubmit} className="flex items-center gap-2">
          <select
            name="tier"
            defaultValue={product.override?.tier ?? "LISTED"}
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
            defaultValue={product.override?.horizonDays ?? 2}
            min={0}
            className="w-14 rounded border border-zinc-300 px-1.5 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            name="stressedHaircutPct"
            type="number"
            step="0.1"
            defaultValue={product.override ? (product.override.stressedHaircutPct * 100).toFixed(1) : "0"}
            min={0}
            max={100}
            className="w-14 rounded border border-zinc-300 px-1.5 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input name="noticeDays" type="number" placeholder="Notice" defaultValue={product.override?.noticeDays ?? ""} className="w-14 rounded border border-zinc-300 px-1.5 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900" />
          <input name="redeemFrequency" type="text" placeholder="Freq" defaultValue={product.override?.redeemFrequency ?? ""} className="w-20 rounded border border-zinc-300 px-1.5 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900" />
          <input name="gatePctPerPeriod" type="number" step="1" placeholder="Gate%" defaultValue={product.override?.gatePctPerPeriod ? (product.override.gatePctPerPeriod * 100).toFixed(0) : ""} className="w-14 rounded border border-zinc-300 px-1.5 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900" />
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isPending ? "…" : "Set"}
          </button>
          {product.override && (
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

export function ProductOverrideTable({
  products,
}: {
  products: ProductData[];
}) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-zinc-200 dark:border-zinc-800">
          <th className="pb-2 font-medium text-zinc-500">Product</th>
          <th className="pb-2 font-medium text-zinc-500">Type</th>
          <th className="pb-2 font-medium text-zinc-500">Override tier</th>
          <th className="pb-2 font-medium text-zinc-500">Horizon</th>
          <th className="pb-2 font-medium text-zinc-500">Haircut</th>
          <th className="pb-2 font-medium text-zinc-500">Set override</th>
        </tr>
      </thead>
      <tbody>
        {products.map((p) => (
          <ProductRow key={p.id} product={p} />
        ))}
      </tbody>
    </table>
  );
}
