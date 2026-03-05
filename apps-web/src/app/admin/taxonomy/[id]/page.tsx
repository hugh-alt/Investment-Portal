import Link from "next/link";
import { notFound } from "next/navigation";
import { getTaxonomyWithNodes, buildTree } from "@/lib/taxonomy";
import { TreeEditor } from "./tree-editor";
import { deleteTaxonomyAction } from "../actions";

export default async function TaxonomyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const taxonomy = await getTaxonomyWithNodes(id);
  if (!taxonomy) notFound();

  const tree = buildTree(taxonomy.nodes);
  const deleteBound = deleteTaxonomyAction.bind(null, taxonomy.id);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/taxonomy"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
          >
            &larr; All taxonomies
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {taxonomy.name}
          </h1>
          {taxonomy.description && (
            <p className="mt-1 text-sm text-zinc-500">
              {taxonomy.description}
            </p>
          )}
        </div>
        <form action={deleteBound}>
          <button
            type="submit"
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            Delete taxonomy
          </button>
        </form>
      </div>

      <TreeEditor taxonomyId={taxonomy.id} tree={tree} />
    </div>
  );
}
