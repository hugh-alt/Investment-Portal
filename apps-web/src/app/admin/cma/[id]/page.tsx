import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { CMASetEditor } from "./cma-editor";

export default async function CMASetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const cmaSet = await prisma.cMASet.findUnique({
    where: { id },
    include: {
      assumptions: {
        include: {
          node: {
            select: { id: true, name: true, nodeType: true, parentId: true, taxonomyId: true },
          },
        },
        orderBy: { node: { sortOrder: "asc" } },
      },
    },
  });

  if (!cmaSet) notFound();

  // Get taxonomy nodes for the assumption selector
  // Use the taxonomy from the first assumption, or find the default
  let taxonomyNodes: { id: string; name: string; nodeType: string; parentId: string | null }[] = [];
  if (cmaSet.assumptions.length > 0) {
    const taxId = cmaSet.assumptions[0].node.taxonomyId;
    const nodes = await prisma.taxonomyNode.findMany({
      where: { taxonomyId: taxId },
      select: { id: true, name: true, nodeType: true, parentId: true },
      orderBy: { sortOrder: "asc" },
    });
    taxonomyNodes = nodes;
  } else {
    const taxonomy = await prisma.taxonomy.findFirst({
      orderBy: { createdAt: "asc" },
      include: {
        nodes: {
          select: { id: true, name: true, nodeType: true, parentId: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (taxonomy) taxonomyNodes = taxonomy.nodes;
  }

  const assumptionData = cmaSet.assumptions.map((a) => ({
    id: a.id,
    taxonomyNodeId: a.taxonomyNodeId,
    nodeName: a.node.name,
    nodeType: a.node.nodeType,
    expReturnPct: a.expReturnPct,
    volPct: a.volPct,
  }));

  // Filter to ASSET_CLASS and SUB_ASSET
  const shockableNodes = taxonomyNodes.filter(
    (n) => n.nodeType === "ASSET_CLASS" || n.nodeType === "SUB_ASSET",
  );
  const riskNodes = taxonomyNodes.filter((n) => n.nodeType === "RISK");
  const nodeParentMap = new Map(taxonomyNodes.map((n) => [n.id, n.parentId]));

  const nodeLabels = shockableNodes.map((n) => {
    const parent = riskNodes.find((r) => r.id === nodeParentMap.get(n.id));
    return {
      id: n.id,
      label: parent ? `${parent.name} / ${n.name}` : n.name,
      nodeType: n.nodeType,
    };
  });

  const STATUS_LABELS: Record<string, string> = {
    DRAFT: "Draft",
    ACTIVE: "Active",
    RETIRED: "Retired",
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {cmaSet.name}
      </h1>
      {cmaSet.description && (
        <p className="mt-1 text-sm text-zinc-500">{cmaSet.description}</p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
          cmaSet.status === "ACTIVE"
            ? "bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-300"
            : cmaSet.status === "RETIRED"
              ? "bg-orange-50 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
        }`}>
          {STATUS_LABELS[cmaSet.status] ?? cmaSet.status}
        </span>
        {cmaSet.isDefault && (
          <span className="rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
            Firm default
          </span>
        )}
      </div>

      <CMASetEditor
        cmaSetId={cmaSet.id}
        isDefault={cmaSet.isDefault}
        assumptions={assumptionData}
        nodes={nodeLabels}
      />
    </div>
  );
}
