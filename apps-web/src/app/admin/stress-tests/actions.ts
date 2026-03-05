"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeAllocation } from "@/lib/allocation";
import type { HoldingInput, MappingInput } from "@/lib/allocation";
import { computeStressImpact } from "@/lib/stress";
import type { NodeWeight, ShockInput } from "@/lib/stress";
import { MappingScope, TaxonomyNodeType } from "@/generated/prisma/enums";

// ── Create scenario ──

const createScenarioSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
});

export async function createScenarioAction(
  _prev: { error?: string } | null,
  formData: FormData,
) {
  const user = await requireRole("ADMIN");
  const parsed = createScenarioSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const scenario = await prisma.stressScenario.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      createdByUserId: user.id,
    },
  });

  redirect(`/admin/stests/${scenario.id}`);
}

// ── Add / update shock ──

const shockSchema = z.object({
  scenarioId: z.string().min(1),
  taxonomyNodeId: z.string().min(1),
  shockPctInput: z.coerce.number().min(-100).max(100),
});

export async function upsertShockAction(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData,
) {
  await requireRole("ADMIN");
  const parsed = shockSchema.safeParse({
    scenarioId: formData.get("scenarioId"),
    taxonomyNodeId: formData.get("taxonomyNodeId"),
    shockPctInput: formData.get("shockPct"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { scenarioId, taxonomyNodeId, shockPctInput } = parsed.data;
  const shockPct = shockPctInput / 100; // convert -30 → -0.30

  await prisma.stressShock.upsert({
    where: {
      scenarioId_taxonomyNodeId: { scenarioId, taxonomyNodeId },
    },
    update: { shockPct },
    create: { scenarioId, taxonomyNodeId, shockPct },
  });

  revalidatePath(`/admin/stests/${scenarioId}`);
  return { success: true };
}

// ── Delete shock ──

export async function deleteShockAction(scenarioId: string, shockId: string) {
  await requireRole("ADMIN");
  await prisma.stressShock.delete({ where: { id: shockId } });
  revalidatePath(`/admin/stests/${scenarioId}`);
}

// ── Run scenario ──

export async function runScenarioAction(scenarioId: string) {
  const user = await requireRole("ADMIN");

  const scenario = await prisma.stressScenario.findUniqueOrThrow({
    where: { id: scenarioId },
    include: {
      shocks: { include: { node: true } },
    },
  });

  if (scenario.shocks.length === 0) {
    return { error: "Add at least one shock before running" };
  }

  // Get the taxonomy from one of the shocks
  const firstNode = scenario.shocks[0].node;
  const taxonomy = await prisma.taxonomy.findUnique({
    where: { id: firstNode.taxonomyId },
    include: { nodes: true },
  });
  if (!taxonomy) {
    return { error: "Taxonomy not found" };
  }

  // Build node parent map for override resolution
  const nodeParents = new Map<string, string | null>();
  for (const n of taxonomy.nodes) {
    nodeParents.set(n.id, n.parentId);
  }

  // Build risk bucket lookup
  const riskBucketById = new Map<string, { id: string; name: string }>();
  const riskBuckets = taxonomy.nodes.filter((n) => n.nodeType === TaxonomyNodeType.RISK);
  for (const rb of riskBuckets) {
    riskBucketById.set(rb.id, { id: rb.id, name: rb.name });
  }
  for (const n of taxonomy.nodes) {
    if (n.parentId && riskBucketById.has(n.parentId)) {
      riskBucketById.set(n.id, riskBucketById.get(n.parentId)!);
    }
  }
  for (const n of taxonomy.nodes) {
    if (n.parentId && riskBucketById.has(n.parentId) && !riskBucketById.has(n.id)) {
      riskBucketById.set(n.id, riskBucketById.get(n.parentId)!);
    }
  }

  const nodeById = new Map(taxonomy.nodes.map((n) => [n.id, n]));

  // Fetch product mappings for this taxonomy
  const productMaps = await prisma.productTaxonomyMap.findMany({
    where: {
      taxonomyId: taxonomy.id,
      scope: { in: [MappingScope.FIRM_DEFAULT, MappingScope.CLIENT_OVERRIDE] },
    },
  });

  // Fetch all clients with holdings
  const clients = await prisma.client.findMany({
    include: {
      accounts: {
        include: {
          holdings: {
            include: {
              product: { select: { name: true, type: true } },
              lookthroughHoldings: {
                include: { underlyingProduct: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  });

  const shockInputs: ShockInput[] = scenario.shocks.map((s) => ({
    nodeId: s.taxonomyNodeId,
    shockPct: s.shockPct,
  }));

  // Compute impact per client
  const resultData: {
    clientId: string;
    estimatedImpactPct: number;
    detailsJson: string;
  }[] = [];

  for (const client of clients) {
    const holdingInputs: HoldingInput[] = client.accounts.flatMap((a) =>
      a.holdings.map((h) => ({
        productId: h.productId,
        productName: h.product.name,
        productType: h.product.type,
        marketValue: h.marketValue,
        lookthrough: h.lookthroughHoldings.map((lt) => ({
          underlyingProductId: lt.underlyingProductId,
          underlyingProductName: lt.underlyingProduct.name,
          underlyingMarketValue: lt.underlyingMarketValue,
          weight: lt.weight,
        })),
      })),
    );

    if (holdingInputs.length === 0) continue;

    // Build per-client mappings (client override > firm default)
    const mappingsByProduct = new Map<string, (typeof productMaps)[number]>();
    for (const m of productMaps) {
      if (m.clientId && m.clientId !== client.id) continue;
      const existing = mappingsByProduct.get(m.productId);
      if (!existing || (m.scope === MappingScope.CLIENT_OVERRIDE && m.clientId === client.id)) {
        mappingsByProduct.set(m.productId, m);
      }
    }

    const mappings: MappingInput[] = [];
    for (const [, m] of mappingsByProduct) {
      const node = nodeById.get(m.nodeId);
      if (!node) continue;
      const rb = riskBucketById.get(m.nodeId);
      mappings.push({
        productId: m.productId,
        nodeId: m.nodeId,
        nodeName: node.name,
        nodeType: node.nodeType,
        riskBucketId: rb?.id ?? null,
        riskBucketName: rb?.name ?? null,
      });
    }

    const allocation = computeAllocation(holdingInputs, mappings);

    // Build node weights from allocation
    const nodeWeights: NodeWeight[] = allocation.buckets.flatMap((b) =>
      b.assetClasses.map((ac) => {
        const node = nodeById.get(ac.nodeId);
        return {
          nodeId: ac.nodeId,
          nodeName: ac.nodeName,
          nodeType: node?.nodeType ?? "ASSET_CLASS",
          parentId: node?.parentId ?? null,
          weight: ac.pctOfTotal,
        };
      }),
    );

    const impact = computeStressImpact(nodeWeights, shockInputs, nodeParents);

    resultData.push({
      clientId: client.id,
      estimatedImpactPct: impact.estimatedImpactPct,
      detailsJson: JSON.stringify({
        details: impact.details,
        unmappedPct: impact.unmappedPct,
      }),
    });
  }

  // Create run + results
  await prisma.stressRun.create({
    data: {
      scenarioId,
      runByUserId: user.id,
      results: {
        create: resultData,
      },
    },
  });

  revalidatePath(`/admin/stests/${scenarioId}`);
  return { success: true };
}

// ── Delete scenario ──

export async function deleteScenarioAction(scenarioId: string) {
  await requireRole("ADMIN");
  await prisma.stressScenario.delete({ where: { id: scenarioId } });
  redirect("/admin/stress-tests");
}
