import { prisma } from "@/lib/prisma";
import { LiquidityStressManager } from "./stress-manager";

export default async function LiquidityStressPage() {
  let scenarios;
  try {
    scenarios = await prisma.liquidityStressScenario.findMany({
    include: {
      rules: { orderBy: { horizonDays: "asc" } },
      runs: {
        orderBy: { runAt: "desc" },
        take: 1,
        include: {
          runBy: { select: { name: true } },
          _count: { select: { results: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    });
  } catch {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Liquidity Stress Scenarios
        </h1>
        <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
          Liquidity stress not available — run the migration and <code>npx prisma generate</code>, then restart the server.
        </p>
      </div>
    );
  }

  const data = scenarios.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    isDefault: s.isDefault,
    rules: s.rules.map((r) => ({
      id: r.id,
      horizonDays: r.horizonDays,
      extraCashDemandPct: r.extraCashDemandPct,
      extraCashDemandAmount: r.extraCashDemandAmount,
    })),
    lastRun: s.runs[0]
      ? {
          runAt: s.runs[0].runAt.toISOString(),
          runBy: s.runs[0].runBy.name,
          resultCount: s.runs[0]._count.results,
        }
      : null,
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Liquidity Stress Scenarios
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Define stress scenarios with horizon-specific cash demand shocks and run them across all clients.
      </p>

      <LiquidityStressManager scenarios={data} />
    </div>
  );
}
