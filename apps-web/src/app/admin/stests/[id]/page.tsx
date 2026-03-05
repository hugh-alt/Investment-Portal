import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { ScenarioEditor } from "./scenario-editor";

export default async function ScenarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const scenario = await prisma.stressScenario.findUnique({
    where: { id },
    include: {
      shocks: {
        include: {
          node: { select: { id: true, name: true, nodeType: true, parentId: true } },
        },
        orderBy: { node: { sortOrder: "asc" } },
      },
      runs: {
        orderBy: { runAt: "desc" },
        take: 1,
        include: {
          runBy: { select: { name: true } },
          results: {
            include: {
              client: {
                select: { id: true, name: true, adviserId: true, adviser: { include: { user: { select: { name: true } } } } },
              },
            },
            orderBy: { estimatedImpactPct: "asc" },
          },
        },
      },
    },
  });

  if (!scenario) notFound();

  // Get all taxonomy nodes for the shock selector
  // Use the taxonomy from the first shock, or fetch the default
  let taxonomyNodes: { id: string; name: string; nodeType: string; parentId: string | null }[] = [];
  if (scenario.shocks.length > 0) {
    const taxId = await prisma.taxonomyNode.findUnique({
      where: { id: scenario.shocks[0].node.id },
      select: { taxonomyId: true },
    });
    if (taxId) {
      const nodes = await prisma.taxonomyNode.findMany({
        where: { taxonomyId: taxId.taxonomyId },
        select: { id: true, name: true, nodeType: true, parentId: true },
        orderBy: { sortOrder: "asc" },
      });
      taxonomyNodes = nodes;
    }
  } else {
    // No shocks yet — find the default taxonomy
    const taxonomy = await prisma.taxonomy.findFirst({
      orderBy: { createdAt: "asc" },
      include: {
        nodes: {
          select: { id: true, name: true, nodeType: true, parentId: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (taxonomy) {
      taxonomyNodes = taxonomy.nodes;
    }
  }

  const latestRun = scenario.runs[0] ?? null;

  const shockData = scenario.shocks.map((s) => ({
    id: s.id,
    taxonomyNodeId: s.taxonomyNodeId,
    nodeName: s.node.name,
    nodeType: s.node.nodeType,
    shockPct: s.shockPct,
  }));

  const resultData = latestRun
    ? {
        runAt: formatDateTime(latestRun.runAt),
        runBy: latestRun.runBy.name,
        results: latestRun.results.map((r) => ({
          clientId: r.client.id,
          clientName: r.client.name,
          adviserName: r.client.adviser.user.name,
          adviserId: r.client.adviserId,
          estimatedImpactPct: r.estimatedImpactPct,
          details: JSON.parse(r.detailsJson) as {
            details: { nodeName: string; weight: number; shockPct: number; contribution: number; source: string }[];
            unmappedPct: number;
          },
        })),
      }
    : null;

  // Build adviser list for filter
  const adviserMap = new Map<string, string>();
  if (resultData) {
    for (const r of resultData.results) {
      adviserMap.set(r.adviserId, r.adviserName);
    }
  }
  const advisers = Array.from(adviserMap, ([id, name]) => ({ id, name })).sort(
    (a, b) => a.name.localeCompare(b.name),
  );

  // Filter taxonomy nodes to ASSET_CLASS and SUB_ASSET (shockable nodes)
  const shockableNodes = taxonomyNodes.filter(
    (n) => n.nodeType === "ASSET_CLASS" || n.nodeType === "SUB_ASSET",
  );

  // Also include RISK nodes for display context
  const riskNodes = taxonomyNodes.filter((n) => n.nodeType === "RISK");
  const nodeParentMap = new Map(taxonomyNodes.map((n) => [n.id, n.parentId]));

  // Build display labels with parent prefix
  const nodeLabels = shockableNodes.map((n) => {
    const parent = riskNodes.find((r) => r.id === nodeParentMap.get(n.id));
    return {
      id: n.id,
      label: parent ? `${parent.name} / ${n.name}` : n.name,
      nodeType: n.nodeType,
    };
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {scenario.name}
      </h1>
      {scenario.description && (
        <p className="mt-1 text-sm text-zinc-500">{scenario.description}</p>
      )}

      <ScenarioEditor
        scenarioId={scenario.id}
        shocks={shockData}
        nodes={nodeLabels}
        latestRun={resultData}
        advisers={advisers}
      />
    </div>
  );
}
