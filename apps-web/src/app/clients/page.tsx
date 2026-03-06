import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, wealthGroupFilter } from "@/lib/auth";

export default async function ClientsPage() {
  const user = await requireUser();
  let clients: { id: string; name: string; createdAt: Date }[] = [];
  let error = false;

  try {
    // Scope by wealth group; advisers also filtered to own clients
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
    <div className="min-h-screen bg-zinc-50 p-8 font-sans dark:bg-black">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
        >
          &larr; Home
        </Link>

        <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Clients
        </h1>

        {error ? (
          <p className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            Unable to load clients. Please check the database connection.
          </p>
        ) : clients.length === 0 ? (
          <p className="mt-6 text-zinc-500">No clients found. Run the seed script to add data.</p>
        ) : (
          <table className="mt-6 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="pb-2 font-medium text-zinc-500">Name</th>
                <th className="pb-2 font-medium text-zinc-500">Created</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr
                  key={client.id}
                  className="border-b border-zinc-100 dark:border-zinc-800"
                >
                  <td className="py-3">
                    <Link
                      href={`/clients/${client.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      {client.name}
                    </Link>
                  </td>
                  <td className="py-3 text-zinc-500">
                    {client.createdAt.toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
