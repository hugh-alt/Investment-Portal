import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { ScenarioListClient } from "./scenario-list";

export default async function StressTestsPage() {
  const scenarios = await prisma.stressScenario.findMany({
    include: {
      createdBy: { select: { name: true } },
      _count: { select: { shocks: true, runs: true } },
      runs: {
        orderBy: { runAt: "desc" },
        take: 1,
        select: { runAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const data = scenarios.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    createdBy: s.createdBy.name,
    shockCount: s._count.shocks,
    runCount: s._count.runs,
    lastRunAt: s.runs[0]?.runAt ? formatDateTime(s.runs[0].runAt) : null,
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Stress Tests
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Create scenarios, define shocks, and run them across all client portfolios.
      </p>

      <ScenarioListClient scenarios={data} />
    </div>
  );
}
