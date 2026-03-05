import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MappingScope, TaxonomyNodeType } from "@/generated/prisma/enums";
import { MappingTable } from "./mapping-table";

export default async function MappingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const taxonomy = await prisma.taxonomy.findUnique({
    where: { id },
    include: {
      nodes: { orderBy: [{ sortOrder: "asc" }] },
      productMaps: {
        where: { scope: MappingScope.FIRM_DEFAULT },
      },
    },
  });
  if (!taxonomy) notFound();

  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
  });

  // Build node options: only ASSET_CLASS and SUB_ASSET, with their parent risk bucket name
  const riskBuckets = taxonomy.nodes.filter((n) => n.nodeType === TaxonomyNodeType.RISK);
  const riskBucketMap = new Map(riskBuckets.map((n) => [n.id, n.name]));

  const mappableNodes = taxonomy.nodes
    .filter((n) => n.nodeType === TaxonomyNodeType.ASSET_CLASS || n.nodeType === TaxonomyNodeType.SUB_ASSET)
    .map((n) => ({
      id: n.id,
      name: n.name,
      nodeType: n.nodeType,
      riskBucket: n.parentId ? riskBucketMap.get(n.parentId) ?? null : null,
    }));

  // Current mappings: productId → nodeId
  const currentMappings: Record<string, string> = {};
  for (const m of taxonomy.productMaps) {
    currentMappings[m.productId] = m.nodeId;
  }

  return (
    <div>
      <Link
        href={`/admin/taxonomy/${id}`}
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
      >
        &larr; Back to taxonomy
      </Link>

      <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Product Mapping
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        {taxonomy.name} &mdash; assign each product to an asset class node.
      </p>

      <MappingTable
        taxonomyId={id}
        products={products.map((p) => ({ id: p.id, name: p.name, type: p.type }))}
        nodes={mappableNodes}
        currentMappings={currentMappings}
      />
    </div>
  );
}
