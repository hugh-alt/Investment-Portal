import Link from "next/link";
import { requireUser, wealthGroupFilter } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { statusLabel, type ApprovalStatus } from "@/lib/approval";

const money = (v: number) =>
  "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default async function RebalanceLandingPage() {
  const user = await requireUser();
  const wgFilter = wealthGroupFilter(user);
  let clientWhere: Record<string, unknown> = {};
  if (wgFilter) clientWhere = { ...clientWhere, ...wgFilter };

  if (user.role === "ADVISER") {
    const adviser = await prisma.adviser.findUnique({ where: { userId: user.id } });
    if (adviser) clientWhere = { ...clientWhere, adviserId: adviser.id };
  }

  const clients = await prisma.client.findMany({
    where: clientWhere,
    select: { id: true, name: true },
  });
  const clientIds = clients.map((c) => c.id);
  const clientNameById = new Map(clients.map((c) => [c.id, c.name]));

  const plans = await prisma.rebalancePlan.findMany({
    where: { clientId: { in: clientIds } },
    include: {
      trades: true,
      saa: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const statusColor: Record<string, string> = {
    DRAFT: "bg-yellow-50 text-yellow-700",
    ADVISER_APPROVED: "bg-blue-50 text-blue-700",
    CLIENT_APPROVED: "bg-emerald-50 text-emerald-700",
    REJECTED: "bg-red-50 text-red-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Rebalance</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Generate, review, and execute portfolio rebalancing plans.
          </p>
        </div>
        <Link
          href="/adviser/rebalance/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
        >
          Create via Wizard
        </Link>
      </div>

      {/* Recent plans */}
      {plans.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-100">
                <th className="px-4 py-2 text-left font-medium text-zinc-600">Client</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-600">SAA</th>
                <th className="px-4 py-2 text-center font-medium text-zinc-600">Status</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-600">Trades</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-600">Trade Volume</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-600">Created</th>
                <th className="w-20 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => {
                const tradeVol = p.trades.reduce((s, t) => s + t.amount, 0);
                return (
                  <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-2 font-medium text-zinc-900">
                      {clientNameById.get(p.clientId) ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-zinc-500">{p.saa.name}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusColor[p.status] ?? ""}`}>
                        {statusLabel(p.status as ApprovalStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-700">{p.trades.length}</td>
                    <td className="px-4 py-2 text-right text-zinc-700">{money(tradeVol)}</td>
                    <td className="px-4 py-2 text-zinc-500">
                      {p.createdAt.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/clients/${p.clientId}`}
                        className="text-xs text-zinc-500 hover:text-zinc-900"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center">
          <p className="text-sm text-zinc-500">No rebalance plans yet.</p>
          <p className="mt-1 text-xs text-zinc-400">
            Click &quot;Create via Wizard&quot; to generate your first rebalance plan.
          </p>
        </div>
      )}
    </div>
  );
}
