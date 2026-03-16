import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TruthEditor } from "./truth-editor";
import { ClosesSection } from "./closes-section";
import { NAVSection } from "./nav-section";
import { CallsSection } from "./cashflows-section";
import { DistributionsSection } from "./distributions-section";
import { KpiSection } from "./kpi-section";

export default async function PlatformFundDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id } = await params;

  const fund = await prisma.pMFund.findUnique({
    where: { id },
    include: {
      truth: true,
      closes: { orderBy: { closeDate: "asc" } },
      navPoints: { orderBy: { navDate: "desc" } },
      cashflowEvents: { orderBy: { eventDate: "desc" } },
      distributionEvents: {
        orderBy: { eventDate: "desc" },
        include: {
          allocations: {
            include: {
              commitment: {
                include: {
                  sleeve: {
                    include: {
                      client: {
                        include: {
                          adviser: true,
                          wealthGroup: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      kpiPoints: { orderBy: { kpiDate: "desc" } },
    },
  });

  if (!fund) notFound();

  const truth = fund.truth;
  const callEvents = fund.cashflowEvents.filter((e) => e.type === "CALL");

  return (
    <div>
      <Link
        href="/platform/pm-funds"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
      >
        &larr; All PM Funds
      </Link>

      <div className="mt-4">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {fund.name}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
          <span className="rounded bg-blue-100 px-2 py-0.5 font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {fund.currency}
          </span>
          {fund.vintageYear && <span>Vintage {fund.vintageYear}</span>}
          {fund.strategy && <span>{fund.strategy}</span>}
        </div>
      </div>

      {/* Truth Overview */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Fund Truth — Lifecycle
        </h2>
        <TruthEditor
          fundId={fund.id}
          initial={{
            lifecycleStage: truth?.lifecycleStage ?? null,
            firstCloseDate: truth?.firstCloseDate?.toISOString().slice(0, 10) ?? null,
            investmentPeriodMonths: truth?.investmentPeriodMonths ?? null,
            fundTermMonths: truth?.fundTermMonths ?? null,
            extensionMonths: truth?.extensionMonths ?? null,
          }}
        />
      </div>

      {/* Closes */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Closes</h2>
        <ClosesSection
          fundId={fund.id}
          closes={fund.closes.map((c) => ({
            id: c.id,
            closeType: c.closeType,
            closeDate: c.closeDate.toISOString().slice(0, 10),
            capitalRaised: c.capitalRaised,
            notes: c.notes,
          }))}
        />
      </div>

      {/* NAV History — 4dp */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">NAV History</h2>
        <NAVSection
          fundId={fund.id}
          currency={fund.currency}
          navPoints={fund.navPoints.map((n) => ({
            id: n.id,
            navDate: n.navDate.toISOString().slice(0, 10),
            navAmount: n.navAmount,
            currency: n.currency,
          }))}
        />
      </div>

      {/* Calls — % based */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Capital Calls (% of commitment)
        </h2>
        <CallsSection
          fundId={fund.id}
          currency={fund.currency}
          calls={callEvents.map((e) => ({
            id: e.id,
            eventDate: e.eventDate.toISOString().slice(0, 10),
            callPct: e.callPct,
            amount: e.amount,
            currency: e.currency,
            notes: e.notes,
          }))}
        />
      </div>

      {/* Distributions with allocations */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Distributions
        </h2>
        <DistributionsSection
          fundId={fund.id}
          currency={fund.currency}
          events={fund.distributionEvents.map((evt) => ({
            id: evt.id,
            eventDate: evt.eventDate.toISOString().slice(0, 10),
            totalAmount: evt.totalAmount,
            currency: evt.currency,
            basis: evt.basis,
            notes: evt.notes,
            allocations: evt.allocations.map((a) => ({
              id: a.id,
              clientName: a.commitment.sleeve.client.name,
              adviserName: a.commitment.sleeve.client.adviser.firmName,
              wealthGroup: a.commitment.sleeve.client.wealthGroup?.name ?? "—",
              commitmentAmount: a.commitment.commitmentAmount,
              fundedAmount: a.commitment.fundedAmount,
              amount: a.amount,
              pctOfCommitment: a.pctOfCommitment,
            })),
          }))}
        />
      </div>

      {/* KPIs — 4dp */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">KPI Time Series</h2>
        <KpiSection
          fundId={fund.id}
          kpiPoints={fund.kpiPoints.map((k) => ({
            id: k.id,
            kpiDate: k.kpiDate.toISOString().slice(0, 10),
            tvpi: k.tvpi,
            rvpi: k.rvpi,
            dpi: k.dpi,
            moic: k.moic,
          }))}
        />
      </div>
    </div>
  );
}
