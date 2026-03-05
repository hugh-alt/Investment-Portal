import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TaxonomyNodeType } from "@/generated/prisma/enums";
import { AllocationEditor } from "./allocation-editor";

export default async function SAADetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const saa = await prisma.sAA.findUnique({
    where: { id },
    include: {
      taxonomy: {
        include: {
          nodes: { orderBy: { sortOrder: "asc" } },
        },
      },
      allocations: true,
    },
  });

  if (!saa) notFound();

  // Build tree: risk buckets → asset classes
  const riskBuckets = saa.taxonomy.nodes.filter(
    (n) => n.nodeType === TaxonomyNodeType.RISK,
  );
  const assetClasses = saa.taxonomy.nodes.filter(
    (n) => n.nodeType === TaxonomyNodeType.ASSET_CLASS,
  );

  const tree = riskBuckets.map((rb) => ({
    id: rb.id,
    name: rb.name,
    children: assetClasses
      .filter((ac) => ac.parentId === rb.id)
      .map((ac) => ({ id: ac.id, name: ac.name })),
  }));

  // Current allocations as maps
  const allocMap: Record<string, number> = {};
  const minMap: Record<string, number> = {};
  const maxMap: Record<string, number> = {};
  for (const a of saa.allocations) {
    allocMap[a.nodeId] = a.targetWeight;
    minMap[a.nodeId] = a.minWeight;
    maxMap[a.nodeId] = a.maxWeight;
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-sans dark:bg-black">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/adviser/saa"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
        >
          &larr; Back to SAAs
        </Link>

        <div className="mt-4 flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {saa.name}
          </h1>
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium ${
              saa.ownerScope === "FIRM"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                : "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
            }`}
          >
            {saa.ownerScope}
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          Taxonomy: {saa.taxonomy.name}
        </p>

        <AllocationEditor saaId={saa.id} tree={tree} initial={allocMap} initialMin={minMap} initialMax={maxMap} />
      </div>
    </div>
  );
}
