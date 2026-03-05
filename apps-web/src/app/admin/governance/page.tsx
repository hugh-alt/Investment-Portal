import { prisma } from "@/lib/prisma";
import { computeAllocation } from "@/lib/allocation";
import type { HoldingInput, MappingInput } from "@/lib/allocation";
import { computeDrift } from "@/lib/drift";
import type { CurrentWeightInput, TargetInput, DriftResult } from "@/lib/drift";
import { computeRequiredVsUnfunded, assessLiquidity } from "@/lib/liquidity";
import type { LiquidityAssessment } from "@/lib/liquidity";
import { computeSleeveTotals, groupByCurrency } from "@/lib/sleeve";
import type { CommitmentInput } from "@/lib/sleeve";
import {
  buildClientDriftRows,
  buildSleeveGovernanceRows,
  computeSummary,
} from "@/lib/governance";
import { GovernanceDashboard } from "./governance-tables";
import { MappingScope, TaxonomyNodeType } from "@/generated/prisma/enums";

export default async function GovernancePage() {
  // Fetch all clients with adviser, accounts+holdings, SAA, sleeves
  const clients = await prisma.client.findMany({
    include: {
      adviser: { include: { user: { select: { name: true } } } },
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
      clientSAA: {
        include: {
          saa: {
            include: {
              allocations: { include: { node: true } },
              taxonomy: { include: { nodes: true } },
            },
          },
        },
      },
      clientSleeve: {
        include: {
          commitments: {
            include: { fund: { select: { name: true, currency: true } } },
          },
          liquidPositions: {
            include: { product: { select: { id: true, name: true, type: true } } },
          },
          alerts: { where: { isResolved: false } },
          recommendations: {
            where: { status: { in: ["DRAFT", "ADVISER_APPROVED"] } },
            select: { id: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Batch-fetch all product taxonomy mappings for drift computation
  const allClientSAAs = clients
    .filter((c) => c.clientSAA?.saa)
    .map((c) => ({
      client: c,
      saa: c.clientSAA!.saa,
    }));

  // Get unique taxonomy IDs
  const taxonomyIds = [...new Set(allClientSAAs.map((cs) => cs.saa.taxonomyId))];

  const productMaps = taxonomyIds.length > 0
    ? await prisma.productTaxonomyMap.findMany({
        where: {
          taxonomyId: { in: taxonomyIds },
          scope: { in: [MappingScope.FIRM_DEFAULT, MappingScope.CLIENT_OVERRIDE] },
        },
      })
    : [];

  // Group maps by taxonomy+product for lookup
  const mapsByTaxonomy = new Map<string, typeof productMaps>();
  for (const m of productMaps) {
    const group = mapsByTaxonomy.get(m.taxonomyId) ?? [];
    group.push(m);
    mapsByTaxonomy.set(m.taxonomyId, group);
  }

  // Now compute drift for each client with SAA
  const driftByClient = new Map<string, DriftResult>();
  for (const { client, saa } of allClientSAAs) {
    const taxonomy = saa.taxonomy;
    const taxMaps = mapsByTaxonomy.get(taxonomy.id) ?? [];

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

    // Build mappings — prefer CLIENT_OVERRIDE over FIRM_DEFAULT
    const mappingsByProduct = new Map<string, (typeof taxMaps)[number]>();
    for (const m of taxMaps) {
      if (m.clientId && m.clientId !== client.id) continue; // skip other client overrides
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

    const allocation = computeAllocation(holdingInputs, mappings);

    const currentWeights: CurrentWeightInput[] = allocation.buckets.flatMap((b) =>
      b.assetClasses.map((ac) => ({
        nodeId: ac.nodeId,
        nodeName: ac.nodeName,
        nodeType: "ASSET_CLASS",
        riskBucketId: b.riskBucketId,
        riskBucketName: b.riskBucketName,
        weight: ac.pctOfTotal,
      })),
    );

    const targets: TargetInput[] = saa.allocations.map((a) => ({
      nodeId: a.nodeId,
      targetWeight: a.targetWeight,
      minWeight: a.minWeight,
      maxWeight: a.maxWeight,
    }));

    driftByClient.set(client.id, computeDrift(currentWeights, targets));
  }

  // Build drift rows
  const driftRows = buildClientDriftRows(
    clients.map((c) => ({
      clientId: c.id,
      clientName: c.name,
      adviserName: c.adviser.user.name,
      adviserId: c.adviserId,
      driftResult: driftByClient.get(c.id) ?? null,
    })),
  );

  // Compute liquidity for each client with a sleeve
  const sleeveInputs = clients
    .filter((c) => c.clientSleeve)
    .map((c) => {
      const sleeve = c.clientSleeve!;

      const commitmentInputs: CommitmentInput[] = sleeve.commitments.map((cm) => ({
        fundId: cm.fundId,
        fundName: cm.fund.name,
        currency: cm.fund.currency,
        commitmentAmount: cm.commitmentAmount,
        fundedAmount: cm.fundedAmount,
        navAmount: cm.navAmount,
        distributionsAmount: cm.distributionsAmount,
      }));

      const liquidInputs = sleeve.liquidPositions.map((p) => ({
        productId: p.productId,
        productName: p.product.name,
        marketValue: p.marketValue,
      }));

      const totals = computeSleeveTotals(commitmentInputs, liquidInputs);

      // Use VS_UNFUNDED_PCT for governance overview (most common)
      const unfundedByCurrency = groupByCurrency(commitmentInputs).map((ct) => ({
        currency: ct.currency,
        totalUnfunded: ct.totalUnfunded,
      }));
      const requirements = computeRequiredVsUnfunded(unfundedByCurrency, sleeve.bufferPctOfUnfunded);
      const liquidity: LiquidityAssessment = assessLiquidity(requirements, totals.liquidBucketValue);

      return {
        clientId: c.id,
        clientName: c.name,
        adviserName: c.adviser.user.name,
        adviserId: c.adviserId,
        liquidity,
        activeAlertCount: sleeve.alerts.length,
      };
    });

  const sleeveRows = buildSleeveGovernanceRows(sleeveInputs);

  // Count pending approvals across all sleeves
  const pendingApprovals = clients.reduce(
    (sum, c) => sum + (c.clientSleeve?.recommendations.length ?? 0),
    0,
  );

  const summary = computeSummary(driftRows, sleeveRows, pendingApprovals);

  // Build adviser list for filter dropdown
  const adviserMap = new Map<string, string>();
  for (const c of clients) {
    adviserMap.set(c.adviserId, c.adviser.user.name);
  }
  const advisers = Array.from(adviserMap, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Governance Overview
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Firm-wide drift, liquidity, and approval status at a glance.
      </p>

      <div className="mt-6">
        <GovernanceDashboard
          summary={summary}
          driftRows={driftRows}
          sleeveRows={sleeveRows}
          advisers={advisers}
        />
      </div>
    </div>
  );
}
