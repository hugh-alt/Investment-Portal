"use client";

import { useState } from "react";

type LookthroughRow = {
  id: string;
  underlyingProduct: { name: string };
  underlyingMarketValue: number;
  weight: number;
};

type HoldingRow = {
  id: string;
  product: { name: string; type: string };
  marketValue: number;
  units: number | null;
  price: number | null;
  lookthroughHoldings: LookthroughRow[];
};

const fmt = (v: number) =>
  "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pct = (v: number) => (v * 100).toFixed(1) + "%";

const TYPE_COLORS: Record<string, string> = {
  DIRECT: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  ETF: "bg-blue-50 text-blue-600 dark:bg-blue-900 dark:text-blue-300",
  FUND: "bg-green-50 text-green-600 dark:bg-green-900 dark:text-green-300",
  MANAGED_PORTFOLIO: "bg-purple-50 text-purple-600 dark:bg-purple-900 dark:text-purple-300",
};

export function HoldingsTable({ holdings }: { holdings: HoldingRow[] }) {
  const [showLookthrough, setShowLookthrough] = useState(false);
  const hasLookthrough = holdings.some((h) => h.lookthroughHoldings.length > 0);

  return (
    <div className="mt-3">
      {hasLookthrough && (
        <label className="mb-2 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={showLookthrough}
            onChange={(e) => setShowLookthrough(e.target.checked)}
            className="rounded border-zinc-300"
          />
          Show look-through
        </label>
      )}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="pb-2 font-medium text-zinc-500">Product</th>
            <th className="pb-2 font-medium text-zinc-500">Type</th>
            <th className="pb-2 text-right font-medium text-zinc-500">Units</th>
            <th className="pb-2 text-right font-medium text-zinc-500">Price</th>
            <th className="pb-2 text-right font-medium text-zinc-500">Market Value</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => (
            <HoldingRowView
              key={h.id}
              holding={h}
              showLookthrough={showLookthrough}
            />
          ))}
          <tr className="border-t border-zinc-300 dark:border-zinc-700">
            <td
              colSpan={4}
              className="pt-2 text-right font-medium text-zinc-700 dark:text-zinc-300"
            >
              Total
            </td>
            <td className="pt-2 text-right font-semibold text-zinc-900 dark:text-zinc-100">
              {fmt(holdings.reduce((s, h) => s + h.marketValue, 0))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function HoldingRowView({
  holding,
  showLookthrough,
}: {
  holding: HoldingRow;
  showLookthrough: boolean;
}) {
  const isManaged = holding.lookthroughHoldings.length > 0;

  return (
    <>
      <tr className="border-b border-zinc-100 dark:border-zinc-800">
        <td className="py-2 text-zinc-900 dark:text-zinc-100">
          {holding.product.name}
        </td>
        <td className="py-2">
          <span
            className={`rounded px-1.5 py-0.5 text-xs ${TYPE_COLORS[holding.product.type] ?? ""}`}
          >
            {holding.product.type.replace("_", " ")}
          </span>
        </td>
        <td className="py-2 text-right text-zinc-600 dark:text-zinc-400">
          {holding.units?.toLocaleString() ?? "—"}
        </td>
        <td className="py-2 text-right text-zinc-600 dark:text-zinc-400">
          {holding.price ? fmt(holding.price) : "—"}
        </td>
        <td className="py-2 text-right font-medium text-zinc-900 dark:text-zinc-100">
          {fmt(holding.marketValue)}
        </td>
      </tr>
      {showLookthrough && isManaged && (
        <>
          {holding.lookthroughHoldings.map((lt) => (
            <tr
              key={lt.id}
              className="border-b border-zinc-50 bg-zinc-50 dark:border-zinc-900 dark:bg-zinc-950"
            >
              <td className="py-1.5 pl-6 text-xs text-zinc-500">
                ↳ {lt.underlyingProduct.name}
              </td>
              <td className="py-1.5 text-xs text-zinc-400">underlying</td>
              <td className="py-1.5 text-right text-xs text-zinc-400">—</td>
              <td className="py-1.5 text-right text-xs text-zinc-400">
                {pct(lt.weight)}
              </td>
              <td className="py-1.5 text-right text-xs text-zinc-600 dark:text-zinc-400">
                {fmt(lt.underlyingMarketValue)}
              </td>
            </tr>
          ))}
        </>
      )}
    </>
  );
}
