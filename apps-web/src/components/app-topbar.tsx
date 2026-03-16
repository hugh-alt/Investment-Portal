"use client";

import { usePathname } from "next/navigation";
import { Search } from "lucide-react";

interface AppTopbarProps {
  userName: string | null;
  userRole: string;
}

/** Generate breadcrumbs from the current pathname */
function getBreadcrumbs(pathname: string): { label: string; href: string }[] {
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((seg, i) => ({
    label: seg
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    href: "/" + segments.slice(0, i + 1).join("/"),
  }));
}

export function AppTopbar({ userName, userRole }: AppTopbarProps) {
  const pathname = usePathname();
  const crumbs = getBreadcrumbs(pathname);

  const roleBadgeColor: Record<string, string> = {
    SUPER_ADMIN: "bg-violet-100 text-violet-700",
    ADMIN: "bg-amber-100 text-amber-700",
    ADVISER: "bg-emerald-100 text-emerald-700",
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-zinc-300">/</span>}
            <span
              className={
                i === crumbs.length - 1
                  ? "text-zinc-900 font-medium"
                  : "text-zinc-400"
              }
            >
              {crumb.label}
            </span>
          </span>
        ))}
      </nav>

      {/* Right side: search placeholder + avatar placeholder */}
      <div className="flex items-center gap-4">
        {/* Search placeholder (cmd+K) */}
        <button
          className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 cursor-pointer"
          onClick={() => {
            /* TODO: cmd+K search modal in Phase 4 */
          }}
        >
          <Search size={14} />
          <span>Search...</span>
          <kbd className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
            ⌘K
          </kbd>
        </button>

        {/* User avatar placeholder */}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-600">
            {(userName ?? "U").charAt(0).toUpperCase()}
          </div>
          <span
            className={`hidden rounded px-1.5 py-0.5 text-[10px] font-medium sm:inline-block ${
              roleBadgeColor[userRole] ?? "bg-zinc-100 text-zinc-600"
            }`}
          >
            {userRole.replace("_", " ")}
          </span>
        </div>
      </div>
    </header>
  );
}
