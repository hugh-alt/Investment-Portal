import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role, TaxonomyNodeType } from "@/generated/prisma/enums";
import { LiquidityDefaultsForm } from "./liquidity-defaults-form";

export default async function LiquidityDefaultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(Role.ADMIN);
  const { id } = await params;

  const taxonomy = await prisma.taxonomy.findUnique({
    where: { id },
    include: {
      nodes: {
        orderBy: { sortOrder: "asc" },
        include: {
          liquidityDefault: { include: { profile: true } },
        },
      },
    },
  });

  if (!taxonomy) notFound();

  // Build tree-like display: risk buckets → asset classes
  const riskBuckets = taxonomy.nodes.filter(
    (n) => n.nodeType === TaxonomyNodeType.RISK,
  );

  const nodeData = taxonomy.nodes.map((n) => ({
    id: n.id,
    name: n.name,
    nodeType: n.nodeType,
    parentId: n.parentId,
    currentDefault: n.liquidityDefault
      ? {
          tier: n.liquidityDefault.profile.tier,
          horizonDays: n.liquidityDefault.profile.horizonDays,
          stressedHaircutPct: n.liquidityDefault.profile.stressedHaircutPct,
        }
      : null,
  }));

  return (
    <div>
      <Link
        href={`/admin/taxonomy/${id}`}
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
      >
        &larr; Back to taxonomy
      </Link>

      <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Liquidity Defaults — {taxonomy.name}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Set default liquidity profiles for each taxonomy node. These apply to all
        products mapped to the node unless overridden at the product level.
      </p>

      <div className="mt-6">
        <LiquidityDefaultsForm taxonomyId={id} nodes={nodeData} />
      </div>
    </div>
  );
}
