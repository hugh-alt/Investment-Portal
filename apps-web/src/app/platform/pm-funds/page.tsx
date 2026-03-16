import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const stageLabel: Record<string, string> = {
  FUNDRAISING: "Fundraising",
  INVESTING: "Investing",
  HARVESTING: "Harvesting",
  LIQUIDATING: "Liquidating",
};

const stageColor: Record<string, string> = {
  FUNDRAISING: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  INVESTING: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  HARVESTING: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  LIQUIDATING: "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400",
};

export default async function PlatformPMFundsPage() {
  await requireSuperAdmin();

  const funds = await prisma.pMFund.findMany({
    include: {
      truth: true,
      _count: {
        select: {
          closes: true,
          navPoints: true,
          cashflowEvents: true,
          distributionEvents: true,
          kpiPoints: true,
          commitments: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Platform PM Funds — Truth Layer
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage fund lifecycle data, closes, NAV history, calls, distributions, and KPIs. All data here is platform truth (SUPER_ADMIN only).
          </p>
        </div>
        <Link
          href="/platform/pm-funds/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          + Add Fund
        </Link>
      </div>

      {funds.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-400">No PM funds yet. Click &quot;Add Fund&quot; above to create one.</p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
                <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Fund</th>
                <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">Stage</th>
                <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">Closes</th>
                <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">NAV</th>
                <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">Calls</th>
                <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">Dists</th>
                <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">KPIs</th>
                <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">Clients</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400"></th>
              </tr>
            </thead>
            <tbody>
              {funds.map((f) => {
                const stage = f.truth?.lifecycleStage ?? f.lifecycleStage;
                return (
                  <tr key={f.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">{f.name}</div>
                      <div className="text-xs text-zinc-400">
                        {f.currency} · {f.vintageYear ?? "—"} · {f.strategy ?? "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {stage ? (
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${stageColor[stage] ?? ""}`}>
                          {stageLabel[stage] ?? stage}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-zinc-600 dark:text-zinc-400">{f._count.closes}</td>
                    <td className="px-4 py-3 text-center text-zinc-600 dark:text-zinc-400">{f._count.navPoints}</td>
                    <td className="px-4 py-3 text-center text-zinc-600 dark:text-zinc-400">{f._count.cashflowEvents}</td>
                    <td className="px-4 py-3 text-center text-zinc-600 dark:text-zinc-400">{f._count.distributionEvents}</td>
                    <td className="px-4 py-3 text-center text-zinc-600 dark:text-zinc-400">{f._count.kpiPoints}</td>
                    <td className="px-4 py-3 text-center text-zinc-600 dark:text-zinc-400">{f._count.commitments}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/platform/pm-funds/${f.id}`}
                        className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                      >
                        Edit truth
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
