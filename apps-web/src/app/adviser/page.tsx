/**
 * /adviser — Adviser Dashboard placeholder.
 * Full dashboard panels will be implemented in Phase 3.
 */
export default function AdviserDashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900">
        Adviser Dashboard
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Your AUM, client drift summary, upcoming PM calls, and rebalance backlog.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {["My AUM", "Clients", "Drift Alerts", "Pending Rebalances"].map((kpi) => (
          <div key={kpi} className="glass-card p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">{kpi}</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">—</p>
            <p className="mt-1 text-xs text-zinc-400">Coming in Phase 3</p>
          </div>
        ))}
      </div>
    </div>
  );
}
