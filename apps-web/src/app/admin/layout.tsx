import Link from "next/link";
import { requireUser, isAdmin } from "@/lib/auth";
import { logoutAction } from "@/app/dashboard/actions";

const NAV_ITEMS = [
  { href: "/admin/taxonomy", label: "Taxonomy" },
  { href: "/admin/cma", label: "CMA" },
  { href: "/admin/stress-tests", label: "Stress Tests" },
  { href: "/admin/pm-funds", label: "Approved PM Funds" },
  { href: "/admin/governance", label: "Governance" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  if (!isAdmin(user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Not authorised
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Admin access is required to view this section.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
          >
            &larr; Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <aside className="flex w-56 flex-col border-r border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <Link
          href="/dashboard"
          className="mb-6 text-xs font-medium uppercase tracking-wider text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          &larr; Dashboard
        </Link>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="rounded-md px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <p className="mb-2 truncate text-xs text-zinc-500">{user.name}</p>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
            >
              Log out
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
