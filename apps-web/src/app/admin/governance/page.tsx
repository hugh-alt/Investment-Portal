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
  buildRebalanceGovernanceRows,
  computeSummary,
} from "@/lib/governance";
import { GovernanceDashboard } from "./governance-tables";
import { MappingScope, TaxonomyNodeType } from "@/generated/prisma/enums";
import {
  buildLiquidityLadder,
  buildClientLiquidityRiskRows,
  type LiquidityProfileData,
  type ProductMapping as LPProductMapping,
  type TaxonomyNode as LPTaxNode,
  type ExposureInput,
} from "@/lib/liquidity-profile";
import {
  buildLiquidityStressGovRows,
  type LiquidityStressGovRow,
} from "@/lib/liquidity-stress";

export default async function GovernancePage() {
  const { requireUser, wealthGroupFilter } = await import("@/lib/auth");
  const user = await requireUser();
  const wgWhere = wealthGroupFilter(user);

  // Fetch clients scoped by wealth group
  const clients = await prisma.client.findMany({
    where: wgWhere,
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

  // ── Rebalance governance ──
  // Fetch latest rebalance plan per client + associated orders
  const allPlans = await prisma.rebalancePlan.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      trades: { select: { id: true } },
    },
  });

  // Group by client, take most recent
  const latestPlanByClient = new Map<string, typeof allPlans[number]>();
  for (const plan of allPlans) {
    if (!latestPlanByClient.has(plan.clientId)) {
      latestPlanByClient.set(plan.clientId, plan);
    }
  }

  // Fetch orders for the latest plans
  const latestPlanIds = [...latestPlanByClient.values()].map((p) => p.id);
  const rebalanceOrders = latestPlanIds.length > 0
    ? await prisma.order.findMany({
        where: { sourceId: { in: latestPlanIds }, source: "REBALANCE_PLAN" },
        select: { sourceId: true, status: true },
      })
    : [];

  const ordersByPlanId = new Map<string, { status: string }[]>();
  for (const o of rebalanceOrders) {
    const list = ordersByPlanId.get(o.sourceId) ?? [];
    list.push({ status: o.status });
    ordersByPlanId.set(o.sourceId, list);
  }

  // Count orders pending fill across all rebalance plans
  const rebalanceOrdersPendingFill = rebalanceOrders.filter(
    (o) => o.status === "SUBMITTED" || o.status === "PARTIALLY_FILLED",
  ).length;

  const rebalanceInputs = clients.map((c) => {
    const plan = latestPlanByClient.get(c.id);
    return {
      clientId: c.id,
      clientName: c.name,
      adviserName: c.adviser.user.name,
      adviserId: c.adviserId,
      breachCount: driftByClient.get(c.id)?.breachCount ?? 0,
      latestPlan: plan
        ? {
            status: plan.status,
            tradeCount: plan.trades.length,
            createdAt: plan.createdAt.toISOString(),
          }
        : null,
      orders: plan ? (ordersByPlanId.get(plan.id) ?? []) : [],
    };
  });

  const rebalanceRows = buildRebalanceGovernanceRows(rebalanceInputs);

  const summary = computeSummary(driftRows, sleeveRows, pendingApprovals, rebalanceRows, rebalanceOrdersPendingFill);

  // ── Liquidity Risk (profile-based ladder per client) ──
  const productOverridesRaw = await prisma.productLiquidityOverride.findMany({
    include: { profile: true },
  });
  const lpOverrides = new Map<string, LiquidityProfileData>(
    productOverridesRaw.map((o) => [
      o.productId,
      { tier: o.profile.tier, horizonDays: o.profile.horizonDays, stressedHaircutPct: o.profile.stressedHaircutPct, gateOrSuspendRisk: o.profile.gateOrSuspendRisk },
    ]),
  );

  const taxDefaultsRaw = await prisma.taxonomyLiquidityDefault.findMany({
    include: { profile: true },
  });
  const lpTaxDefaults = new Map<string, LiquidityProfileData>(
    taxDefaultsRaw.map((d) => [
      d.taxonomyNodeId,
      { tier: d.profile.tier, horizonDays: d.profile.horizonDays, stressedHaircutPct: d.profile.stressedHaircutPct, gateOrSuspendRisk: d.profile.gateOrSuspendRisk },
    ]),
  );

  // Fetch taxonomy for node tree (reuse first taxonomy)
  const govTaxonomy = await prisma.taxonomy.findFirst({
    include: { nodes: true, productMaps: { where: { scope: MappingScope.FIRM_DEFAULT } } },
    orderBy: { createdAt: "asc" },
  });
  const lpNodes = new Map<string, LPTaxNode>(
    (govTaxonomy?.nodes ?? []).map((n) => [n.id, { id: n.id, parentId: n.parentId }]),
  );
  const lpMappings: LPProductMapping[] = (govTaxonomy?.productMaps ?? []).map((m) => ({
    productId: m.productId,
    nodeId: m.nodeId,
  }));

  const liquidityRiskInputs = clients.map((c) => {
    // Build exposures using look-through
    const exposures: ExposureInput[] = [];
    for (const account of c.accounts) {
      for (const h of account.holdings) {
        if (h.product.type === "MANAGED_PORTFOLIO" && h.lookthroughHoldings.length > 0) {
          for (const lt of h.lookthroughHoldings) {
            exposures.push({
              productId: lt.underlyingProductId,
              productName: lt.underlyingProduct.name,
              marketValue: lt.underlyingMarketValue,
            });
          }
        } else {
          exposures.push({
            productId: h.productId,
            productName: h.product.name,
            marketValue: h.marketValue,
          });
        }
      }
    }

    // Aggregate by product
    const byProduct = new Map<string, ExposureInput>();
    for (const e of exposures) {
      const existing = byProduct.get(e.productId);
      if (existing) existing.marketValue += e.marketValue;
      else byProduct.set(e.productId, { ...e });
    }

    const ladder = buildLiquidityLadder(
      [...byProduct.values()],
      lpMappings,
      lpOverrides,
      lpTaxDefaults,
      lpNodes,
    );

    return {
      clientId: c.id,
      clientName: c.name,
      adviserName: c.adviser.user.name,
      adviserId: c.adviserId,
      ladder,
    };
  });

  const liquidityRiskRows = buildClientLiquidityRiskRows(liquidityRiskInputs)
    .sort((a, b) => a.pctLiquid30d - b.pctLiquid30d); // lowest 30d first

  // ── Liquidity Stress (latest run of default scenario) ──
  let liquidityStressRows: LiquidityStressGovRow[] = [];
  let liquidityStressAvailable = true;
  try {
    const defaultStressScenario = await prisma.liquidityStressScenario.findFirst({
      where: { isDefault: true },
    });
    if (defaultStressScenario) {
      const latestRun = await prisma.liquidityStressRun.findFirst({
        where: { scenarioId: defaultStressScenario.id },
        orderBy: { runAt: "desc" },
        include: { results: true },
      });
      if (latestRun) {
        // Group results by client
        const resultsByClient = new Map<string, typeof latestRun.results>();
        for (const r of latestRun.results) {
          const list = resultsByClient.get(r.clientId) ?? [];
          list.push(r);
          resultsByClient.set(r.clientId, list);
        }

        const stressInputs = clients.map((c) => {
          const results = resultsByClient.get(c.id) ?? [];
          const h30 = results.find((r) => r.horizonDays === 30);
          const h90 = results.find((r) => r.horizonDays === 90);
          const h365 = results.find((r) => r.horizonDays === 365);

          const getStatus = (coverage: number): "OK" | "WARN" | "CRITICAL" =>
            coverage >= 1 ? "OK" : coverage >= 0.8 ? "WARN" : "CRITICAL";

          const horizons = [h30, h90, h365].filter(Boolean).map((h) => ({
            horizonDays: h!.horizonDays,
            availableLiquidity: h!.availableLiquidity,
            requiredLiquidity: h!.requiredLiquidity,
            coverageRatio: h!.coverageRatio,
            shortfall: h!.shortfall,
            status: getStatus(h!.coverageRatio),
            details: { stressedLiquidityByHorizon: 0, pmCallsWithinHorizon: 0, bufferRequirement: 0, extraDemandPct: 0, extraDemandAmount: 0, foreignCurrencyCalls: [] },
          }));

          const statuses = horizons.map((h) => h.status);
          const worstStatus: "OK" | "WARN" | "CRITICAL" =
            statuses.includes("CRITICAL") ? "CRITICAL" :
            statuses.includes("WARN") ? "WARN" : "OK";

          return {
            clientId: c.id,
            clientName: c.name,
            adviserName: c.adviser.user.name,
            adviserId: c.adviserId,
            stress: {
              clientId: c.id,
              totalPortfolioValue: 0,
              horizons,
              worstStatus,
              worstCoverage30d: h30?.coverageRatio ?? 999,
              worstCoverage90d: h90?.coverageRatio ?? 999,
            },
          };
        });

        liquidityStressRows = buildLiquidityStressGovRows(stressInputs);
      }
    }
  } catch {
    liquidityStressAvailable = false;
  }

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
        Firm-wide drift, liquidity, rebalance, and approval status at a glance.
      </p>

      <div className="mt-6">
        <GovernanceDashboard
          summary={summary}
          driftRows={driftRows}
          sleeveRows={sleeveRows}
          rebalanceRows={rebalanceRows}
          liquidityRiskRows={liquidityRiskRows}
          liquidityStressRows={liquidityStressRows}
          liquidityStressAvailable={liquidityStressAvailable}
          advisers={advisers}
        />
      </div>
    </div>
  );
}
