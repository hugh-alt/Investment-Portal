import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApprovalToggle } from "./approval-toggle";
import { ProfileEditor } from "./profile-editor";
import type { CurvePoint } from "@/lib/pm-curves";

const stageLabel: Record<string, string> = {
  FUNDRAISING: "Fundraising",
  INVESTING: "Investing",
  HARVESTING: "Harvesting",
  LIQUIDATING: "Liquidating",
};

export default async function FundDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!isAdmin(user)) notFound();

  const { id } = await params;

  const fund = await prisma.pMFund.findUnique({
    where: { id },
    include: { approval: true, profile: true },
  });

  if (!fund) notFound();

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
          isApproved={fund.approval?.isApproved ?? false}
        />
      </div>

      {/* Profile editor */}
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
