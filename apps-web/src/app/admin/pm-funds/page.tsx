import { requireUser, isSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FundList } from "./fund-list";
import { CreateFundForm } from "./create-fund-form";

export default async function PmFundsPage() {
  const user = await requireUser();
  const userIsSuperAdmin = isSuperAdmin(user);

  const funds = await prisma.pMFund.findMany({
    include: {
      approvals: {
        where: user.wealthGroupId ? { wealthGroupId: user.wealthGroupId } : undefined,
      },
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
    isApproved: f.approvals.some((a) => a.isApproved),
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
        {userIsSuperAdmin
          ? "Manage the global PM fund universe and truth data."
          : "Whitelist PM funds for your wealth group."}
      </p>

      {userIsSuperAdmin && <CreateFundForm />}

      <FundList funds={fundData} canEditProfile={userIsSuperAdmin} />
    </div>
  );
}
