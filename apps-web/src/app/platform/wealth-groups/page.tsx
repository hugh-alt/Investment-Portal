import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { WealthGroupManager } from "./wealth-group-manager";

export default async function WealthGroupsPage() {
  await requireSuperAdmin();

  const wealthGroups = await prisma.wealthGroup.findMany({
    include: {
      _count: { select: { users: true, advisers: true, clients: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, wealthGroupId: true },
    orderBy: { email: "asc" },
  });

  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-sans dark:bg-black">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Wealth Groups
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Platform administration — manage wealth groups and user assignments.
        </p>

        <WealthGroupManager
          wealthGroups={wealthGroups.map((wg) => ({
            id: wg.id,
            name: wg.name,
            userCount: wg._count.users,
            adviserCount: wg._count.advisers,
            clientCount: wg._count.clients,
          }))}
          users={users.map((u) => ({
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            wealthGroupId: u.wealthGroupId,
          }))}
        />
      </div>
    </div>
  );
}
