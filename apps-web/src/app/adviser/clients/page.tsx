import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, wealthGroupFilter } from "@/lib/auth";

/**
 * /adviser/clients — Client list (new canonical route).
 * Mirrors the original /clients page logic.
 */
export default async function AdviserClientsPage() {
  const user = await requireUser();
  let clients: { id: string; name: string; createdAt: Date }[] = [];
  let error = false;

  try {
    const wgFilter = wealthGroupFilter(user);
    let where: Record<string, unknown> = {};
    if (wgFilter) where = { ...where, ...wgFilter };
    if (user.role === "ADVISER") {
      const adviser = await prisma.adviser.findUnique({ where: { userId: user.id } });
      if (adviser) where = { ...where, adviserId: adviser.id };
      else where = { ...where, id: "__none__" };
    }

    clients = await prisma.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  } catch {
    error = true;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900">Clients</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {clients.length} client{clients.length !== 1 ? "s" : ""}
      </p>

      {error && (
        <p className="mt-4 text-sm text-red-600">
          Failed to load clients. Please try again.
        </p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {clients.map((client) => (
          <Link
            key={client.id}
            href={`/adviser/clients/${client.id}`}
            className="glass-card p-4 transition-colors hover:bg-zinc-50 cursor-pointer"
          >
            <p className="text-sm font-medium text-zinc-900">{client.name}</p>
            <p className="mt-1 text-xs text-zinc-400">
              Created {client.createdAt.toLocaleDateString()}
            </p>
          </Link>
        ))}
        {clients.length === 0 && !error && (
          <p className="text-sm text-zinc-500">No clients found.</p>
        )}
      </div>
    </div>
  );
}
