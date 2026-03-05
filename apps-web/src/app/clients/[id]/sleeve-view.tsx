"use client";

import { useState, useActionState } from "react";
import type { SleeveTotals, CurrencyTotals } from "@/lib/sleeve";
import {
  createSleeveAction,
  addCommitmentAction,
  addLiquidPositionAction,
  type SleeveFormState,
} from "./sleeve-actions";

const fmt = (v: number) =>
  "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const pct = (v: number) => (v * 100).toFixed(1) + "%";

const ratio = (v: number | null) => (v === null ? "—" : v.toFixed(2) + "x");

type CommitmentDetail = {
  fundId: string;
  fundName: string;
  currency: string;
  commitmentAmount: number;
  fundedAmount: number;
  navAmount: number;
  distributionsAmount: number;
  latestNavDate: string | null;
  metrics: { unfunded: number; pctCalled: number; dpi: number | null; rvpi: number | null; tvpi: number | null };
  projectedCalls: { month: string; amount: number }[];
  projectedDistributions: { month: string; amount: number }[];
};

// ── Create Sleeve Form ──────────────────────────────────

export function CreateSleeveForm({ clientId }: { clientId: string }) {
  const [state, action, pending] = useActionState<SleeveFormState, FormData>(
    createSleeveAction,
    {},
  );

  return (
    <div className="mt-4 rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
      <p className="text-sm text-zinc-500">No private markets sleeve yet.</p>
      <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
        <input type="hidden" name="clientId" value={clientId} />
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Name</label>
          <input
            name="name"
            required
            defaultValue="Private Markets Allocation"
            className="mt-1 w-48 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Target %</label>
          <input
            name="targetPct"
            type="number"
            step="0.1"
            defaultValue="15"
            className="mt-1 w-20 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Cash Buffer %</label>
          <input
            name="cashBufferPct"
            type="number"
            step="0.1"
            defaultValue="5"
            className="mt-1 w-20 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Creating..." : "Create Sleeve"}
        </button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      </form>
    </div>
  );
}

// ── Sleeve Summary ──────────────────────────────────────

export function SleeveSummary({
  sleeveName,
  targetPct,
  cashBufferPct,
  totals,
  commitmentDetails,
  liquidPositions,
  clientId,
  sleeveId,
  approvedFunds,
  products,
}: {
  sleeveName: string;
  targetPct: number | null;
  cashBufferPct: number;
  totals: SleeveTotals;
  commitmentDetails: CommitmentDetail[];
  liquidPositions: { productId: string; productName: string; marketValue: number }[];
  clientId: string;
  sleeveId: string;
  approvedFunds: { id: string; name: string; currency: string }[];
  products: { id: string; name: string }[];
}) {
  const [expandedFund, setExpandedFund] = useState<string | null>(null);

  return (
    <div className="mt-4 space-y-4">
      {/* Multi-currency warning */}
      {totals.multiCurrency && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          Multiple currencies — totals shown per currency
        </p>
      )}

      {/* Per-currency PM totals */}
      {totals.byCurrency.map((ct) => (
        <CurrencySection key={ct.currency} ct={ct} />
      ))}

      {/* Liquid bucket */}
      <div>
        <SummaryCard label="Liquid Bucket (Portfolio currency)" value={fmt(totals.liquidBucketValue)} />
      </div>

      <div className="flex gap-4 text-xs text-zinc-500">
        {targetPct !== null && <span>Target: {pct(targetPct)}</span>}
        <span>Cash Buffer: {pct(cashBufferPct)}</span>
      </div>

      {/* Commitments — Today Snapshot */}
      {commitmentDetails.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Commitments — Today Snapshot</h4>
          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
                  <th className="px-3 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400">Fund</th>
                  <th className="px-3 py-2 text-center font-medium text-zinc-600 dark:text-zinc-400">Ccy</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">Commitment</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">Paid-in</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">Unfunded</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">NAV</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">Dist.</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">% Called</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">DPI</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">TVPI</th>
                  <th className="px-3 py-2 text-center font-medium text-zinc-600 dark:text-zinc-400"></th>
                </tr>
              </thead>
              <tbody>
                {commitmentDetails.map((c) => (
                  <CommitmentRow
                    key={c.fundId}
                    detail={c}
                    isExpanded={expandedFund === c.fundId}
                    onToggle={() => setExpandedFund(expandedFund === c.fundId ? null : c.fundId)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Liquid positions */}
      {liquidPositions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Liquid Bucket (Portfolio currency)</h4>
          <div className="mt-2 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
                  <th className="px-4 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400">Product</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">Market Value</th>
                </tr>
              </thead>
              <tbody>
                {liquidPositions.map((p, i) => (
                  <tr key={i} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                    <td className="px-4 py-2 text-zinc-900 dark:text-zinc-100">{p.productName}</td>
                    <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400">{fmt(p.marketValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add forms */}
      <div className="grid gap-4 sm:grid-cols-2">
        <AddCommitmentForm
          clientId={clientId}
          sleeveId={sleeveId}
          approvedFunds={approvedFunds}
        />
        <AddLiquidForm
          clientId={clientId}
          sleeveId={sleeveId}
          products={products}
        />
      </div>
    </div>
  );
}

// ── Commitment Row with expandable projections ──────────

function CommitmentRow({
  detail,
  isExpanded,
  onToggle,
}: {
  detail: CommitmentDetail;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { metrics } = detail;
  const hasProjections = detail.projectedCalls.length > 0 || detail.projectedDistributions.length > 0;

  return (
    <>
      <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
        <td className="px-3 py-2">
          <div className="text-zinc-900 dark:text-zinc-100">{detail.fundName}</div>
          {detail.latestNavDate && (
            <div className="text-[10px] text-zinc-400">NAV as at {detail.latestNavDate}</div>
          )}
        </td>
        <td className="px-3 py-2 text-center">
          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {detail.currency}
          </span>
        </td>
        <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">{fmt(detail.commitmentAmount)}</td>
        <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">{fmt(detail.fundedAmount)}</td>
        <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">{fmt(metrics.unfunded)}</td>
        <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">{fmt(detail.navAmount)}</td>
        <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">{fmt(detail.distributionsAmount)}</td>
        <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">{pct(metrics.pctCalled)}</td>
        <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">{ratio(metrics.dpi)}</td>
        <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">{ratio(metrics.tvpi)}</td>
        <td className="px-3 py-2 text-center">
          {hasProjections && (
            <button
              onClick={onToggle}
              className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              {isExpanded ? "Hide" : "Proj."}
            </button>
          )}
        </td>
      </tr>
      {isExpanded && hasProjections && (
        <tr>
          <td colSpan={11} className="bg-zinc-50 px-3 py-3 dark:bg-zinc-900/50">
            <ProjectionsPanel detail={detail} />
          </td>
        </tr>
      )}
    </>
  );
}

// ── Projections Panel ───────────────────────────────────

function ProjectionsPanel({ detail }: { detail: CommitmentDetail }) {
  const maxLen = Math.max(detail.projectedCalls.length, detail.projectedDistributions.length);
  if (maxLen === 0) return null;

  // Only show months with non-zero activity (or all if all zero)
  const rows = Array.from({ length: maxLen }, (_, i) => ({
    month: detail.projectedCalls[i]?.month ?? detail.projectedDistributions[i]?.month ?? "",
    call: detail.projectedCalls[i]?.amount ?? 0,
    dist: detail.projectedDistributions[i]?.amount ?? 0,
  }));

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-zinc-500">
        Forward Projections ({detail.currency}) — scaled to {fmt(detail.commitmentAmount)} commitment
      </p>
      <div className="overflow-hidden rounded border border-zinc-200 dark:border-zinc-700">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
              <th className="px-2 py-1.5 text-left font-medium text-zinc-500">Month</th>
              <th className="px-2 py-1.5 text-right font-medium text-zinc-500">Proj. Call ({detail.currency})</th>
              <th className="px-2 py-1.5 text-right font-medium text-zinc-500">Proj. Dist ({detail.currency})</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                <td className="px-2 py-1 text-zinc-500">{r.month}</td>
                <td className="px-2 py-1 text-right text-zinc-600 dark:text-zinc-400">
                  {r.call > 0 ? fmt(r.call) : "—"}
                </td>
                <td className="px-2 py-1 text-right text-zinc-600 dark:text-zinc-400">
                  {r.dist > 0 ? fmt(r.dist) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Shared components ───────────────────────────────────

function CurrencySection({ ct }: { ct: CurrencyTotals }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-zinc-500">PM Totals — {ct.currency}</p>
      <div className="grid gap-3 sm:grid-cols-5">
        <SummaryCard label={`Commitment (${ct.currency})`} value={fmt(ct.totalCommitment)} small />
        <SummaryCard label={`Funded (${ct.currency})`} value={fmt(ct.totalFunded)} small />
        <SummaryCard label={`Unfunded (${ct.currency})`} value={fmt(ct.totalUnfunded)} small />
        <SummaryCard label={`NAV (${ct.currency})`} value={fmt(ct.totalNav)} small />
        <SummaryCard label={`Distributions (${ct.currency})`} value={fmt(ct.totalDistributions)} small />
      </div>
    </div>
  );
}

function SummaryCard({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`${small ? "text-base" : "text-lg"} font-semibold text-zinc-900 dark:text-zinc-100`}>
        {value}
      </p>
    </div>
  );
}

// ── Add Commitment Form ─────────────────────────────────

function AddCommitmentForm({
  clientId,
  sleeveId,
  approvedFunds,
}: {
  clientId: string;
  sleeveId: string;
  approvedFunds: { id: string; name: string; currency: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<SleeveFormState, FormData>(
    addCommitmentAction,
    {},
  );

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        + Add Commitment
      </button>
    );
  }

  return (
    <form action={action} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="sleeveId" value={sleeveId} />
      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Add Commitment</p>
      <div className="mt-2 flex flex-col gap-2">
        <select
          name="fundId"
          required
          className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="">Select fund...</option>
          {approvedFunds.map((f) => (
            <option key={f.id} value={f.id}>{f.name} ({f.currency})</option>
          ))}
        </select>
        <input name="commitmentAmount" type="number" step="1000" required placeholder="Commitment $" className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
        <input name="fundedAmount" type="number" step="1000" placeholder="Paid-in $ (optional)" className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
        <input name="navAmount" type="number" step="1000" placeholder="NAV $ (optional)" className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
        <input name="distributionsAmount" type="number" step="1000" placeholder="Distributions $ (optional)" className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
      </div>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
      {state.success && <p className="mt-1 text-xs text-green-600">Added.</p>}
      <div className="mt-2 flex gap-2">
        <button type="submit" disabled={pending} className="rounded bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">
          {pending ? "Adding..." : "Add"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-zinc-500 hover:text-zinc-700">Cancel</button>
      </div>
    </form>
  );
}

// ── Add Liquid Position Form ────────────────────────────

function AddLiquidForm({
  clientId,
  sleeveId,
  products,
}: {
  clientId: string;
  sleeveId: string;
  products: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [state, action, pending] = useActionState<SleeveFormState, FormData>(
    addLiquidPositionAction,
    {},
  );

  const filtered = search.length > 0
    ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : products;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        + Add Liquid Position
      </button>
    );
  }

  return (
    <form action={action} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="sleeveId" value={sleeveId} />
      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Add Liquid Position</p>
      <div className="mt-2 flex flex-col gap-2">
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <select
          name="productId"
          required
          size={Math.min(5, filtered.length + 1)}
          className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          {filtered.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input name="marketValue" type="number" step="1000" required placeholder="Market Value $" className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
      </div>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
      {state.success && <p className="mt-1 text-xs text-green-600">Added.</p>}
      <div className="mt-2 flex gap-2">
        <button type="submit" disabled={pending} className="rounded bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">
          {pending ? "Adding..." : "Add"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-zinc-500 hover:text-zinc-700">Cancel</button>
      </div>
    </form>
  );
}
