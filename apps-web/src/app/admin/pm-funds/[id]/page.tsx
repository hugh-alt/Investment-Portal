import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, isAdmin, isSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApprovalToggle } from "./approval-toggle";
import { ProfileEditor } from "./profile-editor";
import { fmtNav, fmt4dp, fmtPct } from "@/lib/pm-fund-truth";
import type { CurvePoint } from "@/lib/pm-curves";

const stageLabel: Record<string, string> = {
  FUNDRAISING: "Fundraising",
  INVESTING: "Investing",
  HARVESTING: "Harvesting",
  LIQUIDATING: "Liquidating",
};

const amountFmt = (v: number, currency: string) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);

export default async function FundDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!isAdmin(user)) notFound();

  const { id } = await params;
  const userIsSuperAdmin = isSuperAdmin(user);

  const fund = await prisma.pMFund.findUnique({
    where: { id },
    include: {
      approvals: {
        where: user.wealthGroupId ? { wealthGroupId: user.wealthGroupId } : undefined,
      },
      profile: true,
      truth: true,
      closes: { orderBy: { closeDate: "asc" } },
      navPoints: { orderBy: { navDate: "desc" }, take: 4 },
      cashflowEvents: { where: { type: "CALL" }, orderBy: { eventDate: "desc" }, take: 10 },
      distributionEvents: { orderBy: { eventDate: "desc" }, take: 5 },
      kpiPoints: { orderBy: { kpiDate: "desc" }, take: 4 },
    },
  });

  if (!fund) notFound();

  const truth = fund.truth;

  // Non-SUPER_ADMIN: read-only view of truth data
  if (!userIsSuperAdmin) {
    return (
      <div>
        <Link
          href="/admin/pm-funds"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
        >
          &larr; All PM Funds
        </Link>
        <div className="mt-6">
          <div className="flex items-start justify-between">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{fund.name}</h1>
            <ApprovalToggle
              fundId={fund.id}
              isApproved={fund.approvals.some((a) => a.isApproved)}
            />
          </div>

          {/* Read-only truth summary */}
          {truth && (
            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Fund Truth (platform-managed)</h3>
              <div className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <span className="text-xs text-zinc-500">Stage</span>
                  <p className="text-zinc-900 dark:text-zinc-100">{truth.lifecycleStage ? stageLabel[truth.lifecycleStage] ?? truth.lifecycleStage : "—"}</p>
                </div>
                <div>
                  <span className="text-xs text-zinc-500">First Close</span>
                  <p className="text-zinc-900 dark:text-zinc-100">{truth.firstCloseDate?.toISOString().slice(0, 10) ?? "—"}</p>
                </div>
                <div>
                  <span className="text-xs text-zinc-500">Invest Period</span>
                  <p className="text-zinc-900 dark:text-zinc-100">{truth.investmentPeriodMonths ? `${truth.investmentPeriodMonths}mo` : "—"}</p>
                </div>
                <div>
                  <span className="text-xs text-zinc-500">Fund Term</span>
                  <p className="text-zinc-900 dark:text-zinc-100">{truth.fundTermMonths ? `${truth.fundTermMonths}mo` : "—"}{truth.extensionMonths ? ` (+${truth.extensionMonths}mo ext)` : ""}</p>
                </div>
              </div>
            </div>
          )}

          {/* Read-only closes */}
          {fund.closes.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Closes</h3>
              <div className="mt-1 space-y-1">
                {fund.closes.map((c) => (
                  <div key={c.id} className="text-sm text-zinc-600 dark:text-zinc-400">
                    {c.closeType} — {c.closeDate.toISOString().slice(0, 10)}
                    {c.capitalRaised != null && ` — ${amountFmt(c.capitalRaised, fund.currency)}`}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Read-only NAV — 4dp */}
          {fund.navPoints.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Recent NAV</h3>
              <div className="mt-1 space-y-1">
                {fund.navPoints.map((n) => (
                  <div key={n.id} className="text-sm font-mono text-zinc-600 dark:text-zinc-400">
                    {n.navDate.toISOString().slice(0, 10)} — {fmtNav(n.navAmount, n.currency)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Read-only Calls */}
          {fund.cashflowEvents.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Recent Calls</h3>
              <div className="mt-1 space-y-1">
                {fund.cashflowEvents.map((e) => (
                  <div key={e.id} className="text-sm text-zinc-600 dark:text-zinc-400">
                    {e.eventDate.toISOString().slice(0, 10)} — {e.callPct != null ? fmtPct(e.callPct) : e.amount != null ? amountFmt(e.amount, e.currency) : "—"}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Read-only Distributions */}
          {fund.distributionEvents.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Recent Distributions</h3>
              <div className="mt-1 space-y-1">
                {fund.distributionEvents.map((d) => (
                  <div key={d.id} className="text-sm text-zinc-600 dark:text-zinc-400">
                    {d.eventDate.toISOString().slice(0, 10)} — {amountFmt(d.totalAmount, d.currency)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Read-only KPIs — 4dp */}
          {fund.kpiPoints.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">KPI History</h3>
              <table className="mt-1 text-xs">
                <thead>
                  <tr className="text-zinc-400">
                    <th className="pr-3 text-left font-medium">Date</th>
                    <th className="pr-3 text-right font-medium">TVPI</th>
                    <th className="pr-3 text-right font-medium">RVPI</th>
                    <th className="pr-3 text-right font-medium">DPI</th>
                    <th className="text-right font-medium">MOIC</th>
                  </tr>
                </thead>
                <tbody>
                  {fund.kpiPoints.map((k) => (
                    <tr key={k.id}>
                      <td className="pr-3 py-0.5 text-zinc-600 dark:text-zinc-400">{k.kpiDate.toISOString().slice(0, 10)}</td>
                      <td className="pr-3 py-0.5 text-right font-mono text-zinc-600 dark:text-zinc-400">{fmt4dp(k.tvpi)}</td>
                      <td className="pr-3 py-0.5 text-right font-mono text-zinc-600 dark:text-zinc-400">{fmt4dp(k.rvpi)}</td>
                      <td className="pr-3 py-0.5 text-right font-mono text-zinc-600 dark:text-zinc-400">{fmt4dp(k.dpi)}</td>
                      <td className="py-0.5 text-right font-mono text-zinc-600 dark:text-zinc-400">{fmt4dp(k.moic)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 text-xs text-zinc-400">
            Fund truth data is platform-managed. Contact Reach Alts to request changes.
          </p>
        </div>
      </div>
    );
  }

  let callCurve: CurvePoint[] = [];
  let distCurve: CurvePoint[] = [];
  if (fund.profile) {
    try {
      callCurve = JSON.parse(fund.profile.projectedCallPctCurveJson);
    } catch { /* use empty */ }
    try {
      distCurve = JSON.parse(fund.profile.projectedDistPctCurveJson);
    } catch { /* use empty */ }
  }

  // Pad to 12 rows if needed
  while (callCurve.length < 12) {
    const d = new Date();
    d.setMonth(d.getMonth() + callCurve.length + 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const lastCum = callCurve.length > 0 ? callCurve[callCurve.length - 1].cumPct : 0;
    callCurve.push({ month, cumPct: lastCum });
  }
  while (distCurve.length < 12) {
    const d = new Date();
    d.setMonth(d.getMonth() + distCurve.length + 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const lastCum = distCurve.length > 0 ? distCurve[distCurve.length - 1].cumPct : 0;
    distCurve.push({ month, cumPct: lastCum });
  }

  return (
    <div>
      <Link
        href="/admin/pm-funds"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
      >
        &larr; All PM Funds
      </Link>

      {/* Fund header */}
      <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {fund.name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <span className="rounded bg-blue-100 px-2 py-0.5 text-sm font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {fund.currency}
            </span>
            {fund.vintageYear && (
              <span className="text-sm text-zinc-500">Vintage {fund.vintageYear}</span>
            )}
            {fund.strategy && (
              <span className="text-sm text-zinc-500">{fund.strategy}</span>
            )}
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                fund.status === "OPEN"
                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
              }`}
            >
              {fund.status}
            </span>
            {fund.lifecycleStage && (
              <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                {stageLabel[fund.lifecycleStage] ?? fund.lifecycleStage}
              </span>
            )}
          </div>
          {(fund.firstCloseDate || fund.investmentPeriodMonths || fund.fundTermMonths) && (
            <div className="mt-1 flex gap-3 text-xs text-zinc-400">
              {fund.firstCloseDate && <span>First Close: {fund.firstCloseDate.toISOString().slice(0, 10)}</span>}
              {fund.investmentPeriodMonths && <span>Investment Period: {fund.investmentPeriodMonths}mo</span>}
              {fund.fundTermMonths && <span>Fund Term: {fund.fundTermMonths}mo</span>}
            </div>
          )}
        </div>
        <ApprovalToggle
          fundId={fund.id}
          isApproved={fund.approvals.some((a) => a.isApproved)}
        />
      </div>

      {/* Profile editor — SUPER_ADMIN only */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Projected % Curves (% of commitment)
        </h2>
        <p className="mt-1 text-xs text-zinc-400">
          These are cumulative % of commitment. Client projections scale by each client&apos;s commitment amount.
        </p>
        <ProfileEditor
          fundId={fund.id}
          initialCallCurve={callCurve}
          initialDistCurve={distCurve}
        />
      </div>
    </div>
  );
}
