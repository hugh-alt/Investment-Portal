import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FundList } from "./fund-list";
import { CreateFundForm } from "./create-fund-form";

export default async function PmFundsPage() {
  await requireUser();

  const funds = await prisma.pMFund.findMany({
    include: {
      approval: true,
      profile: true,
      _count: { select: { commitments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const fundData = funds.map((f) => ({
    id: f.id,
    name: f.name,
    vintageYear: f.vintageYear,
    strategy: f.strategy,
    currency: f.currency,
    status: f.status,
    lifecycleStage: f.lifecycleStage,
    firstCloseDate: f.firstCloseDate?.toISOString().slice(0, 10) ?? null,
    fundTermMonths: f.fundTermMonths,
    isApproved: f.approval?.isApproved ?? false,
    hasProfile: !!f.profile,
    commitmentCount: f._count.commitments,
  }));

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          PM Funds
        </h1>
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        Manage the private markets fund whitelist.
      </p>

      <CreateFundForm />

      <FundList funds={fundData} />
    </div>
  );
}
