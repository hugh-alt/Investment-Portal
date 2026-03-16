/**
 * /platform — Platform Dashboard placeholder.
 * Full dashboard panels will be implemented in Phase 1.
 */
export default function PlatformDashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900">
        Platform Dashboard
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Wealth Group overview, total AUM, product coverage, PM fund health, and data quality.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {["Wealth Groups", "Total AUM", "Product Coverage", "PM Fund Health", "Data Quality Score", "Onboarding"].map((kpi) => (
          <div key={kpi} className="glass-card p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">{kpi}</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">—</p>
            <p className="mt-1 text-xs text-zinc-400">Coming in Phase 1</p>
          </div>
        ))}
      </div>
    </div>
  );
}
