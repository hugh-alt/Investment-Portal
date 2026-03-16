import { requireUser } from "@/lib/auth";
import { getNavForRole } from "@/lib/nav-config";
import { logoutAction } from "@/app/dashboard/actions";
import { AppShellClient } from "./app-shell-client";

/**
 * Server component that fetches user + nav config,
 * then renders the client-side shell.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const navItems = getNavForRole(user.role);

  return (
    <AppShellClient
      navItems={navItems}
      user={{ name: user.name, role: user.role }}
      logoutAction={logoutAction}
    >
      {children}
    </AppShellClient>
  );
}
