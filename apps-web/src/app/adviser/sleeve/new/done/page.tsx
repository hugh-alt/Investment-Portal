import Link from "next/link";

export default async function SleeveWizardDonePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-8 w-8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="mt-4 text-xl font-semibold text-zinc-900">Sleeve Created</h1>
      <p className="mt-2 text-sm text-zinc-500">
        The private markets sleeve has been configured with liquid positions, commitments, buffer rules, and waterfalls.
      </p>
      <div className="mt-6 flex gap-3">
        {clientId && (
          <Link
            href={`/clients/${clientId}`}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
          >
            View Client
          </Link>
        )}
        <Link
          href="/adviser/clients"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          Back to Clients
        </Link>
      </div>
    </div>
  );
}
