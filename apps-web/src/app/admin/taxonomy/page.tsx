import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function TaxonomyListPage() {
  const taxonomies = await prisma.taxonomy.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { nodes: true } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Taxonomy
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Define asset classes, sub-classes, and the classification hierarchy.
          </p>
        </div>
        <Link
          href="/admin/taxonomy/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Create taxonomy
        </Link>
      </div>

      {taxonomies.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-400">
          No taxonomies yet. Create one to get started.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {taxonomies.map((t) => (
            <Link
              key={t.id}
              href={`/admin/taxonomy/${t.id}`}
              className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
            >
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {t.name}
                </p>
                {t.description && (
                  <p className="mt-0.5 text-sm text-zinc-500">
                    {t.description}
                  </p>
                )}
              </div>
              <span className="text-xs text-zinc-400">
                {t._count.nodes} nodes
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
