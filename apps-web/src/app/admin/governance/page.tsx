export default function GovernancePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Governance Overview
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Review firm-wide compliance rules, approval workflows, and audit
        history.
      </p>
      <button
        disabled
        className="mt-6 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Configure rules
      </button>
      <p className="mt-3 text-xs text-zinc-400">Coming next</p>
    </div>
  );
}
