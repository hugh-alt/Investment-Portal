/**
 * /admin — Governance Dashboard placeholder.
 * Full dashboard panels will be implemented in Phase 2.
 */
export default function AdminDashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900">
        Governance Dashboard
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Policy completeness, drift alerts, pending approvals, and adviser activity.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {["Taxonomy", "CMA", "Stress Scenarios", "Liquidity"].map((policy) => (
          <div key={policy} className="glass-card p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">{policy}</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">—</p>
            <p className="mt-1 text-xs text-zinc-400">Coming in Phase 2</p>
          </div>
        ))}
      </div>
    </div>
  );
}
