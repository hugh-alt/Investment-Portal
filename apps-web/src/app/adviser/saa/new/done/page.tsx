import Link from "next/link";

export default async function SAAWizardDonePage({
  searchParams,
}: {
  searchParams: Promise<{ saaId?: string }>;
}) {
  const { saaId } = await searchParams;

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-8 w-8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="mt-4 text-xl font-semibold text-zinc-900">SAA Created</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Your Strategic Asset Allocation has been saved with allocations and tolerance bands.
      </p>
      <div className="mt-6 flex gap-3">
        {saaId && (
          <Link
            href={`/adviser/saa/${saaId}`}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
          >
            View SAA
          </Link>
        )}
        <Link
          href="/adviser/saa"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          Back to SAA List
        </Link>
      </div>
    </div>
  );
}
