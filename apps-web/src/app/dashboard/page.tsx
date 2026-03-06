import Link from "next/link";
import { requireUser, isAdmin, isSuperAdmin } from "@/lib/auth";
import { logoutAction } from "./actions";

const ADMIN_LINKS = [
  { href: "/admin/taxonomy", label: "Taxonomy" },
  { href: "/adviser/saa", label: "Strategic Asset Allocation" },
  { href: "/clients", label: "Clients" },
  { href: "/admin/cma", label: "Capital Market Assumptions" },
  { href: "/admin/stress-tests", label: "Stress Tests" },
  { href: "/admin/pm-funds", label: "Private Markets Funds" },
  { href: "/admin/governance", label: "Governance" },
];

const SUPER_ADMIN_LINKS = [
  ...ADMIN_LINKS,
  { href: "/platform/wealth-groups", label: "Wealth Groups" },
];

const ADVISER_LINKS = [
  { href: "/clients", label: "Clients" },
  { href: "/adviser/saa", label: "Strategic Asset Allocation" },
  { href: "/adviser/rebalance", label: "Rebalance" },
  { href: "/adviser/sleeve", label: "Private Markets Sleeve" },
];

export default async function DashboardPage() {
  const user = await requireUser();
  const links = isSuperAdmin(user) ? SUPER_ADMIN_LINKS : isAdmin(user) ? ADMIN_LINKS : ADVISER_LINKS;

  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-sans dark:bg-black">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {user.name} &middot;{" "}
              <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {user.role}
              </span>
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Log out
            </button>
          </form>
        </div>

        <nav className="mt-8 grid gap-3 sm:grid-cols-2">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg border border-zinc-200 p-4 text-zinc-900 transition-colors hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
            >
              {label} &rarr;
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
