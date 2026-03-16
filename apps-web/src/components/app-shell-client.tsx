"use client";

import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import type { NavItem } from "@/lib/nav-config";

interface AppShellClientProps {
  navItems: NavItem[];
  user: { name: string | null; role: string };
  logoutAction: () => Promise<void>;
  children: React.ReactNode;
}

export function AppShellClient({
  navItems,
  user,
  logoutAction,
  children,
}: AppShellClientProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar navItems={navItems} user={user} logoutAction={logoutAction} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppTopbar userName={user.name} userRole={user.role} />
        <main className="flex-1 overflow-y-auto bg-[#F8FAFC] p-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
