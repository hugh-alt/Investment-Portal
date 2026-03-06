import { prisma } from "@/lib/prisma";
import { requireUser, wealthGroupFilter } from "@/lib/auth";
import { CMAListClient } from "./cma-list";

export default async function CmaPage() {
  const user = await requireUser();
  const wgWhere = wealthGroupFilter(user);

  const cmaSets = await prisma.cMASet.findMany({
    where: wgWhere,
    include: {
      createdBy: { select: { name: true } },
      _count: { select: { assumptions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const data = cmaSets.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    isDefault: s.isDefault,
    status: s.status,
    effectiveDate: s.effectiveDate?.toISOString() ?? null,
    createdBy: s.createdBy.name,
    assumptionCount: s._count.assumptions,
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Capital Market Assumptions
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Define expected return and volatility assumptions by asset class.
      </p>

      <CMAListClient cmaSets={data} />
    </div>
  );
}
