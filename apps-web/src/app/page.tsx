import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";

export default async function Home() {
  const user = await getSessionUser();
  if (user) {
    // Redirect authenticated users to their role-appropriate home
    const homeRoutes: Record<string, string> = {
      SUPER_ADMIN: "/platform",
      ADMIN: "/admin",
      ADVISER: "/adviser",
    };
    redirect(homeRoutes[user.role] ?? "/adviser");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col items-center justify-center gap-8 py-32 px-16 bg-white dark:bg-black sm:items-start">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Investment Portal
        </h1>
        <Link
          href="/login"
          className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Sign in &rarr;
        </Link>
      </main>
    </div>
  );
}
