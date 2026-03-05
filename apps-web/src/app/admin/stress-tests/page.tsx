export default function StressTestsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Stress Tests
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Configure stress-test scenarios and shocks applied to portfolio
        allocations.
      </p>
      <button
        disabled
        className="mt-6 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Create scenario
      </button>
      <p className="mt-3 text-xs text-zinc-400">Coming next</p>
    </div>
  );
}
