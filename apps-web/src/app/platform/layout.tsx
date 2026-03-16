import { requireUser, isSuperAdmin } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  if (!isSuperAdmin(user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F172A]">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold text-white">
            Not authorised
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Super Admin access is required to view this section.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block text-sm font-medium text-amber-400 hover:underline"
          >
            &larr; Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
