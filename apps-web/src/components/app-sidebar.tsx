"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { SidebarIcon } from "./sidebar-icon";
import type { NavItem } from "@/lib/nav-config";

interface AppSidebarProps {
  navItems: NavItem[];
  user: { name: string | null; role: string };
  logoutAction: () => Promise<void>;
}

export function AppSidebar({ navItems, user, logoutAction }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const roleBadgeColor: Record<string, string> = {
    SUPER_ADMIN: "bg-violet-500/20 text-violet-300",
    ADMIN: "bg-amber-500/20 text-amber-300",
    ADVISER: "bg-emerald-500/20 text-emerald-300",
  };

  return (
    <aside
      className={`flex flex-col border-r border-white/10 bg-[#0B1120] transition-all duration-200 ${
        collapsed ? "w-[72px]" : "w-64"
      }`}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
        {!collapsed && (
          <span className="text-sm font-semibold text-amber-400 tracking-wide">
            ReachAlts
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-slate-200 cursor-pointer"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {navItems.map((item) => {
          if (item.isGroup) {
            if (collapsed) return null;
            return (
              <div
                key={item.label}
                className="mt-4 mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-slate-500"
              >
                {item.label}
              </div>
            );
          }

          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors cursor-pointer ${
                item.indent && !collapsed ? "ml-4" : ""
              } ${
                isActive
                  ? "bg-white/10 text-white font-medium"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <SidebarIcon name={item.icon} size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/10 p-3">
        {!collapsed && (
          <div className="mb-2">
            <p className="truncate text-xs font-medium text-slate-300">
              {user.name ?? "User"}
            </p>
            <span
              className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                roleBadgeColor[user.role] ?? "bg-slate-700 text-slate-300"
              }`}
            >
              {user.role.replace("_", " ")}
            </span>
          </div>
        )}
        <form action={logoutAction}>
          <button
            type="submit"
            title="Log out"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-500 hover:bg-white/5 hover:text-slate-300 cursor-pointer"
          >
            <LogOut size={14} className="shrink-0" />
            {!collapsed && "Log out"}
          </button>
        </form>
      </div>
    </aside>
  );
}
