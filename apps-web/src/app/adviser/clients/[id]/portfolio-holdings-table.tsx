"use client";

import { useState } from "react";

// ── Types ────────────────────────────────────────────────

export type ClassifiedHolding = {
  id: string;
  productId: string;
  productName: string;
  productType: string;
  marketValue: number;
  units: number | null;
  price: number | null;
  assetClass: string | null;
  subAssetClass: string | null;
  source: "primary" | "sleeve";
  accountName: string;
  lookthrough: ClassifiedLookthrough[];
};

export type ClassifiedLookthrough = {
  id: string;
  underlyingProductName: string;
  underlyingMarketValue: number;
  weight: number;
  assetClass: string | null;
  subAssetClass: string | null;
};

// ── Formats ──────────────────────────────────────────────

const fmt = (v: number) =>
  "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pct = (v: number) => (v * 100).toFixed(1) + "%";

const TYPE_COLORS: Record<string, string> = {
  DIRECT: "bg-zinc-100 text-zinc-600",
  ETF: "bg-blue-50 text-blue-600",
  FUND: "bg-green-50 text-green-600",
  MANAGED_PORTFOLIO: "bg-purple-50 text-purple-600",
};

const SOURCE_COLORS: Record<string, string> = {
  primary: "bg-zinc-100 text-zinc-600",
  sleeve: "bg-violet-50 text-violet-600",
};

type SourceFilter = "all" | "primary" | "sleeve";

// ── Component ────────────────────────────────────────────

export function PortfolioHoldingsTable({ holdings }: { holdings: ClassifiedHolding[] }) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [showLookthrough, setShowLookthrough] = useState(false);
  const hasLookthrough = holdings.some((h) => h.lookthrough.length > 0);
  const hasSleeve = holdings.some((h) => h.source === "sleeve");

  const filtered = sourceFilter === "all"
    ? holdings
    : holdings.filter((h) => h.source === sourceFilter);

  const total = filtered.reduce((s, h) => s + h.marketValue, 0);

  return (
    <div>
      {/* Controls row */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        {/* Source filter */}
        <div className="flex rounded-lg border border-zinc-200 overflow-hidden">
          <FilterBtn active={sourceFilter === "all"} onClick={() => setSourceFilter("all")}>All Holdings</FilterBtn>
          <FilterBtn active={sourceFilter === "primary"} onClick={() => setSourceFilter("primary")}>Primary Account</FilterBtn>
          {hasSleeve && (
            <FilterBtn active={sourceFilter === "sleeve"} onClick={() => setSourceFilter("sleeve")}>Sleeve Only</FilterBtn>
          )}
        </div>

        {/* Look-through toggle */}
        {hasLookthrough && (
          <label className="flex items-center gap-2 text-xs text-zinc-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showLookthrough}
              onChange={(e) => setShowLookthrough(e.target.checked)}
              className="rounded border-zinc-300 h-3.5 w-3.5"
            />
            Show look-through
          </label>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="px-3 py-2 text-xs font-medium text-zinc-500">Product</th>
              <th className="px-3 py-2 text-xs font-medium text-zinc-500">Type</th>
              <th className="px-3 py-2 text-xs font-medium text-zinc-500">Asset Class</th>
              <th className="px-3 py-2 text-xs font-medium text-zinc-500">Sub-Asset</th>
              <th className="px-3 py-2 text-xs font-medium text-zinc-500">Source</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">Units</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">Price</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">Market Value</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((h) => (
              <HoldingRowClassified
                key={h.id}
                holding={h}
                showLookthrough={showLookthrough}
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-zinc-300 bg-zinc-50">
              <td colSpan={7} className="px-3 py-2 text-right text-xs font-medium text-zinc-600">
                Total ({filtered.length} holding{filtered.length !== 1 ? "s" : ""})
              </td>
              <td className="px-3 py-2 text-right text-sm font-semibold text-zinc-900">
                {fmt(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Row component ────────────────────────────────────────

function HoldingRowClassified({ holding, showLookthrough }: { holding: ClassifiedHolding; showLookthrough: boolean }) {
  const hasLT = holding.lookthrough.length > 0;

  return (
    <>
      <tr className="border-b border-zinc-100 last:border-0">
        <td className="px-3 py-2 text-zinc-900 font-medium">{holding.productName}</td>
        <td className="px-3 py-2">
          <span className={`rounded px-1.5 py-0.5 text-xs ${TYPE_COLORS[holding.productType] ?? "bg-zinc-100 text-zinc-600"}`}>
            {holding.productType.replace("_", " ")}
          </span>
        </td>
        <td className="px-3 py-2 text-zinc-600 text-xs">{holding.assetClass ?? <span className="text-zinc-300">—</span>}</td>
        <td className="px-3 py-2 text-zinc-600 text-xs">{holding.subAssetClass ?? <span className="text-zinc-300">—</span>}</td>
        <td className="px-3 py-2">
          <span className={`rounded px-1.5 py-0.5 text-xs ${SOURCE_COLORS[holding.source]}`}>
            {holding.source === "sleeve" ? "Sleeve" : holding.accountName}
          </span>
        </td>
        <td className="px-3 py-2 text-right text-zinc-500 text-xs">{holding.units?.toLocaleString("en-AU") ?? "—"}</td>
        <td className="px-3 py-2 text-right text-zinc-500 text-xs">{holding.price ? fmt(holding.price) : "—"}</td>
        <td className="px-3 py-2 text-right font-medium text-zinc-900">{fmt(holding.marketValue)}</td>
      </tr>
      {showLookthrough && hasLT && holding.lookthrough.map((lt) => (
        <tr key={lt.id} className="border-b border-zinc-50 bg-zinc-50/50">
          <td className="px-3 py-1.5 pl-7 text-xs text-zinc-500">
            &#8627; {lt.underlyingProductName}
          </td>
          <td className="px-3 py-1.5 text-xs text-zinc-400">underlying</td>
          <td className="px-3 py-1.5 text-xs text-zinc-500">{lt.assetClass ?? <span className="text-zinc-300">—</span>}</td>
          <td className="px-3 py-1.5 text-xs text-zinc-500">{lt.subAssetClass ?? <span className="text-zinc-300">—</span>}</td>
          <td className="px-3 py-1.5" />
          <td className="px-3 py-1.5 text-right text-xs text-zinc-400">—</td>
          <td className="px-3 py-1.5 text-right text-xs text-zinc-400">{pct(lt.weight)}</td>
          <td className="px-3 py-1.5 text-right text-xs text-zinc-600">{fmt(lt.underlyingMarketValue)}</td>
        </tr>
      ))}
    </>
  );
}

// ── Filter button ────────────────────────────────────────

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
        active ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"
      }`}
    >
      {children}
    </button>
  );
}
