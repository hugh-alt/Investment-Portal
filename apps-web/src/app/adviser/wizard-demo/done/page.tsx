import Link from "next/link";

export default function WizardDonePage() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-8 w-8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="mt-4 text-xl font-semibold text-zinc-900">Wizard Complete</h1>
      <p className="mt-2 text-sm text-zinc-500">
        The demo wizard finished successfully. Draft data has been cleared.
      </p>
      <Link
        href="/adviser/wizard-demo"
        className="mt-6 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
      >
        Start Again
      </Link>
    </div>
  );
}
