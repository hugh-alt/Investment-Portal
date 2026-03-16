import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { CreatePlatformFundForm } from "./create-form";

export default async function NewPlatformFundPage() {
  await requireSuperAdmin();

  return (
    <div>
      <Link
        href="/platform/pm-funds"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
      >
        &larr; All PM Funds
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Add PM Fund
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Create a new fund in the platform truth layer. You can add lifecycle data, NAV, calls, distributions, and KPIs after creation.
      </p>

      <CreatePlatformFundForm />
    </div>
  );
}
