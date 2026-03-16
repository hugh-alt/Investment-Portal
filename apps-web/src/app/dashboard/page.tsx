import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getHomeRoute } from "@/lib/nav-config";

/**
 * /dashboard now redirects to the role-appropriate home route:
 * - SUPER_ADMIN → /platform
 * - ADMIN → /admin
 * - ADVISER → /adviser
 */
export default async function DashboardPage() {
  const user = await requireUser();
  redirect(getHomeRoute(user.role));
}
