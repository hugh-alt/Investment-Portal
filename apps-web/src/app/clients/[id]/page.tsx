import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MappingScope, SAAScope, TaxonomyNodeType } from "@/generated/prisma/enums";
import { computeAllocation, type HoldingInput, type MappingInput } from "@/lib/allocation";
import { computeDrift, type CurrentWeightInput, type TargetInput } from "@/lib/drift";
import { computeSleeveTotals, groupByCurrency, type CommitmentInput } from "@/lib/sleeve";
import { curveCumToIncremental, scaleIncrementalPctToDollars, computeFundMetrics, type CurvePoint } from "@/lib/pm-curves";
import {
  computeRequiredVsUnfunded,
  computeRequiredVsProjectedCalls,
  assessLiquidity,
  type ProjectedCall,
  type LiquidityAssessment,
  type BufferConfig,
} from "@/lib/liquidity";
import {
  generateSellLegs,
  generateBuyLegs,
  computeExcess,
  type WaterfallPosition,
  type SellWaterfallEntry,
  type BuyWaterfallEntry,
  type SellRecommendation,
  type BuyRecommendation,
} from "@/lib/waterfall";
import { HoldingsTable } from "./holdings-table";
import { AllocationView } from "./allocation-view";
import { SAASelector } from "./saa-selector";
import { DriftView } from "./drift-view";
import { CreateSleeveForm, SleeveSummary } from "./sleeve-view";
import { RebalanceGenerateButton, RebalancePlanCard } from "./rebalance-view";
import { computeExpectedOutcomes, type CMAInput, type WeightInput } from "@/lib/cma";
import { ExpectedOutcomesView } from "./expected-outcomes-view";
import {
  buildLiquidityLadder,
  type LiquidityProfileData,
  type ProductMapping as LPProductMapping,
  type TaxonomyNode as LPTaxNode,
  type ExposureInput,
} from "@/lib/liquidity-profile";
import { LiquidityLadderView } from "./liquidity-ladder-view";
import { LiquidityStressView } from "./liquidity-stress-view";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      adviser: true,
      accounts: {
        include: {
          holdings: {
            orderBy: { marketValue: "desc" },
            include: {
              product: true,
              lookthroughHoldings: {
                orderBy: { weight: "desc" },
                include: { underlyingProduct: true },
              },
            },
          },
        },
      },
    },
  });

  if (!client) notFound();

  // Wealth group scoping: ADMIN/ADVISER can only view clients in their group
  const notAuthorised = (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <div className="max-w-sm text-center">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Not authorised</h1>
        <p className="mt-2 text-sm text-zinc-500">You can only view your own clients.</p>
        <Link href="/clients" className="mt-4 inline-block text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100">&larr; Back to clients</Link>
      </div>
    </div>
  );

  if (user.role !== "SUPER_ADMIN" && user.wealthGroupId && client.wealthGroupId !== user.wealthGroupId) {
    return notAuthorised;
  }

  if (user.role === "ADVISER") {
    const adviser = await prisma.adviser.findUnique({ where: { userId: user.id } });
    if (!adviser || client.adviserId !== adviser.id) return notAuthorised;
  }

  const totalValue = client.accounts.reduce(
    (sum, a) => sum + a.holdings.reduce((s, h) => s + h.marketValue, 0),
    0,
  );

  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-sans dark:bg-black">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/clients"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
        >
          &larr; All clients
        </Link>

        <div className="mt-4 flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {client.name}
          </h1>
          <span className="text-sm text-zinc-500">
            Total: ${totalValue.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
          </span>
        </div>

        {client.accounts.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-400">No accounts found.</p>
        ) : (
          <>
            {client.accounts.map((account) => (
              <div key={account.id} className="mt-6">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                    {account.accountName}
                  </h2>
                  <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {account.platform}
                  </span>
                </div>
                <HoldingsTable holdings={account.holdings} />
              </div>
            ))}

            <AllocationSection accounts={client.accounts} clientId={id} />
            <LiquidityLadderSection accounts={client.accounts} clientId={id} />
            <LiquidityStressSection clientId={id} />
            <SAASection clientId={id} accounts={client.accounts} />
            <ExpectedOutcomesSection clientId={id} accounts={client.accounts} />
            <RebalanceSection clientId={id} />
            <SleeveSection clientId={id} />
          </>
        )}
      </div>
    </div>
  );
}

async function AllocationSection({
  accounts,
  clientId,
}: {
  accounts: {
    holdings: {
      productId: string;
      marketValue: number;
      product: { name: string; type: string };
      lookthroughHoldings: {
        underlyingProductId: string;
        underlyingMarketValue: number;
        weight: number;
        underlyingProduct: { name: string };
      }[];
    }[];
  }[];
  clientId: string;
}) {
  // Find the first taxonomy with mappings
  const taxonomy = await prisma.taxonomy.findFirst({
    include: {
      nodes: true,
      productMaps: {
        where: {
          OR: [
            { scope: MappingScope.FIRM_DEFAULT },
            { scope: MappingScope.CLIENT_OVERRIDE, clientId },
          ],
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!taxonomy) return null;

  // Build risk bucket lookup: nodeId → ancestor risk bucket
  const riskBucketById = new Map<string, { id: string; name: string }>();
  const riskBuckets = taxonomy.nodes.filter((n) => n.nodeType === TaxonomyNodeType.RISK);
  for (const rb of riskBuckets) {
    riskBucketById.set(rb.id, { id: rb.id, name: rb.name });
  }
  // For asset class / sub-asset nodes, walk up to find risk bucket parent
  for (const n of taxonomy.nodes) {
    if (n.parentId && riskBucketById.has(n.parentId)) {
      riskBucketById.set(n.id, riskBucketById.get(n.parentId)!);
    }
  }
  // Second pass for sub-assets whose parent is asset class
  for (const n of taxonomy.nodes) {
    if (n.parentId && riskBucketById.has(n.parentId) && !riskBucketById.has(n.id)) {
      riskBucketById.set(n.id, riskBucketById.get(n.parentId)!);
    }
  }

  const nodeById = new Map(taxonomy.nodes.map((n) => [n.id, n]));

  // Build mapping inputs: client overrides take priority over firm defaults
  const mappingsByProduct = new Map<string, typeof taxonomy.productMaps[number]>();
  for (const m of taxonomy.productMaps) {
    const existing = mappingsByProduct.get(m.productId);
    if (!existing || m.scope === MappingScope.CLIENT_OVERRIDE) {
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

  // Build holding inputs from all accounts
  const holdingInputs: HoldingInput[] = accounts.flatMap((a) =>
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

  const allocation = computeAllocation(holdingInputs, mappings);

  return <AllocationView allocation={allocation} />;
}

async function LiquidityLadderSection({
  accounts,
  clientId,
}: {
  accounts: {
    holdings: {
      productId: string;
      marketValue: number;
      product: { name: string; type: string };
      lookthroughHoldings: {
        underlyingProductId: string;
        underlyingMarketValue: number;
        weight: number;
        underlyingProduct: { name: string };
      }[];
    }[];
  }[];
  clientId: string;
}) {
  // Fetch taxonomy, mappings, overrides, and defaults
  const taxonomy = await prisma.taxonomy.findFirst({
    include: {
      nodes: true,
      productMaps: {
        where: {
          OR: [
            { scope: MappingScope.FIRM_DEFAULT },
            { scope: MappingScope.CLIENT_OVERRIDE, clientId },
          ],
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Fetch product overrides
  const productOverridesRaw = await prisma.productLiquidityOverride.findMany({
    include: { profile: true },
  });
  const overrides = new Map<string, LiquidityProfileData>(
    productOverridesRaw.map((o) => [
      o.productId,
      {
        tier: o.profile.tier,
        horizonDays: o.profile.horizonDays,
        stressedHaircutPct: o.profile.stressedHaircutPct,
        gateOrSuspendRisk: o.profile.gateOrSuspendRisk,
      },
    ]),
  );

  // Fetch taxonomy defaults
  const taxDefaultsRaw = await prisma.taxonomyLiquidityDefault.findMany({
    include: { profile: true },
  });
  const taxonomyDefaults = new Map<string, LiquidityProfileData>(
    taxDefaultsRaw.map((d) => [
      d.taxonomyNodeId,
      {
        tier: d.profile.tier,
        horizonDays: d.profile.horizonDays,
        stressedHaircutPct: d.profile.stressedHaircutPct,
        gateOrSuspendRisk: d.profile.gateOrSuspendRisk,
      },
    ]),
  );

  // Build nodes map for tree-walk
  const nodes = new Map<string, LPTaxNode>(
    (taxonomy?.nodes ?? []).map((n) => [n.id, { id: n.id, parentId: n.parentId }]),
  );

  // Build product mappings
  const productMappings: LPProductMapping[] = (taxonomy?.productMaps ?? []).map((m) => ({
    productId: m.productId,
    nodeId: m.nodeId,
  }));

  // Build exposures using look-through for managed portfolios
  const exposures: ExposureInput[] = [];
  for (const account of accounts) {
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

  // Aggregate exposures by product
  const byProduct = new Map<string, ExposureInput>();
  for (const e of exposures) {
    const existing = byProduct.get(e.productId);
    if (existing) {
      existing.marketValue += e.marketValue;
    } else {
      byProduct.set(e.productId, { ...e });
    }
  }
  const aggregated = [...byProduct.values()];

  const ladder = buildLiquidityLadder(
    aggregated,
    productMappings,
    overrides,
    taxonomyDefaults,
    nodes,
  );

  return (
    <div className="mt-8">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
        Liquidity Ladder
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Available liquidity by horizon, with stressed haircuts applied.
      </p>
      <div className="mt-3">
        <LiquidityLadderView
          buckets={ladder.buckets}
          totalPortfolioValue={ladder.totalPortfolioValue}
          assumedCount={ladder.assumedCount}
          gatedCount={ladder.gatedCount}
          exposures={ladder.exposures}
        />
      </div>
    </div>
  );
}

async function LiquidityStressSection({ clientId }: { clientId: string }) {
  let defaultScenario: { id: string; name: string } | null = null;
  try {
    defaultScenario = await prisma.liquidityStressScenario.findFirst({
      where: { isDefault: true },
      select: { id: true, name: true },
    });
  } catch {
    return null; // table doesn't exist yet — migration not applied
  }

  if (!defaultScenario) return null;

  // Find the latest run for this scenario
  const latestRun = await prisma.liquidityStressRun.findFirst({
    where: { scenarioId: defaultScenario.id },
    orderBy: { runAt: "desc" },
    select: {
      id: true,
      results: {
        where: { clientId },
        select: {
          horizonDays: true,
          availableLiquidity: true,
          requiredLiquidity: true,
          coverageRatio: true,
          shortfall: true,
          detailsJson: true,
        },
        orderBy: { horizonDays: "asc" },
      },
    },
  });

  if (!latestRun || latestRun.results.length === 0) return null;

  const horizons = latestRun.results.map((r) => {
    let details = {
      pmCallsWithinHorizon: 0,
      bufferRequirement: 0,
      extraDemandPct: 0,
      extraDemandAmount: 0,
      foreignCurrencyCalls: [] as { currency: string; amount: number }[],
    };
    try {
      details = { ...details, ...JSON.parse(r.detailsJson) };
    } catch { /* empty */ }

    return {
      horizonDays: r.horizonDays,
      availableLiquidity: r.availableLiquidity,
      requiredLiquidity: r.requiredLiquidity,
      coverageRatio: r.coverageRatio,
      shortfall: r.shortfall,
      status: r.coverageRatio >= 1 ? "OK" : r.coverageRatio >= 0.8 ? "WARN" : "CRITICAL",
      details,
    };
  });

  const hasForeignCurrency = horizons.some(
    (h) => h.details.foreignCurrencyCalls.length > 0,
  );

  return (
    <div className="mt-8">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
        Liquidity Stress
      </h2>
      <div className="mt-3">
        <LiquidityStressView
          scenarioName={defaultScenario.name}
          horizons={horizons}
          hasForeignCurrency={hasForeignCurrency}
        />
      </div>
    </div>
  );
}

async function SAASection({
  clientId,
  accounts,
}: {
  clientId: string;
  accounts: {
    holdings: {
      productId: string;
      marketValue: number;
      product: { name: string; type: string };
      lookthroughHoldings: {
        underlyingProductId: string;
        underlyingMarketValue: number;
        weight: number;
        underlyingProduct: { name: string };
      }[];
    }[];
  }[];
}) {
  // Get available SAAs
  const saas = await prisma.sAA.findMany({
    select: { id: true, name: true, ownerScope: true },
    orderBy: { name: "asc" },
  });

  // Get current assignment
  const clientSAA = await prisma.clientSAA.findUnique({
    where: { clientId },
    include: {
      saa: {
        include: {
          allocations: { include: { node: true } },
          taxonomy: { include: { nodes: true } },
        },
      },
    },
  });

  const currentSaaId = clientSAA?.saaId ?? null;

  // Compute drift if SAA is assigned
  let driftResult = null;
  if (clientSAA?.saa) {
    const { saa } = clientSAA;
    const taxonomy = saa.taxonomy;

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

    // Get mappings for current allocation computation
    const productMaps = await prisma.productTaxonomyMap.findMany({
      where: {
        taxonomyId: taxonomy.id,
        OR: [
          { scope: MappingScope.FIRM_DEFAULT },
          { scope: MappingScope.CLIENT_OVERRIDE, clientId },
        ],
      },
    });

    const mappingsByProduct = new Map<string, (typeof productMaps)[number]>();
    for (const m of productMaps) {
      const existing = mappingsByProduct.get(m.productId);
      if (!existing || m.scope === MappingScope.CLIENT_OVERRIDE) {
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

    const holdingInputs: HoldingInput[] = accounts.flatMap((a) =>
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

    const allocation = computeAllocation(holdingInputs, mappings);

    // Build current weights from allocation
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

    // Build targets from SAA allocations
    const targets: TargetInput[] = saa.allocations.map((a) => ({
      nodeId: a.nodeId,
      targetWeight: a.targetWeight,
      minWeight: a.minWeight,
      maxWeight: a.maxWeight,
    }));

    driftResult = computeDrift(currentWeights, targets);
  }

  return (
    <div className="mt-8">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
        Strategic Asset Allocation
      </h2>

      <div className="mt-3">
        <SAASelector clientId={clientId} currentSaaId={currentSaaId} saas={saas} />
      </div>

      {driftResult && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Drift Analysis
          </h3>
          <DriftView drift={driftResult} />
        </div>
      )}

      {currentSaaId && !driftResult && (
        <p className="mt-4 text-sm text-zinc-400">
          Unable to compute drift. Check taxonomy mappings.
        </p>
      )}
    </div>
  );
}

async function ExpectedOutcomesSection({
  clientId,
  accounts,
}: {
  clientId: string;
  accounts: {
    holdings: {
      productId: string;
      marketValue: number;
      product: { name: string; type: string };
      lookthroughHoldings: {
        underlyingProductId: string;
        underlyingMarketValue: number;
        weight: number;
        underlyingProduct: { name: string };
      }[];
    }[];
  }[];
}) {
  // Get all ACTIVE CMA sets for the dropdown
  const activeCmaSets = await prisma.cMASet.findMany({
    where: { status: "ACTIVE" },
    include: { assumptions: true },
    orderBy: { name: "asc" },
  });

  if (activeCmaSets.length === 0) return null;

  // Get client's CMA selection (if any)
  const clientCMASelection = await prisma.clientCMASelection.findUnique({
    where: { clientId },
  });

  // Resolve which CMA set to use: client selection → firm default
  const defaultCMA = activeCmaSets.find((s) => s.isDefault);
  const selectedCMA = clientCMASelection
    ? activeCmaSets.find((s) => s.id === clientCMASelection.cmaSetId)
    : null;
  const effectiveCMA = selectedCMA ?? defaultCMA;

  if (!effectiveCMA) return null;

  const cmaInputs: CMAInput[] = effectiveCMA.assumptions.map((a) => ({
    nodeId: a.taxonomyNodeId,
    expReturnPct: a.expReturnPct,
    volPct: a.volPct,
  }));

  // Get taxonomy + mappings for allocation computation
  const taxonomy = await prisma.taxonomy.findFirst({
    include: {
      nodes: true,
      productMaps: {
        where: {
          OR: [
            { scope: MappingScope.FIRM_DEFAULT },
            { scope: MappingScope.CLIENT_OVERRIDE, clientId },
          ],
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!taxonomy) return null;

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

  const mappingsByProduct = new Map<string, typeof taxonomy.productMaps[number]>();
  for (const m of taxonomy.productMaps) {
    const existing = mappingsByProduct.get(m.productId);
    if (!existing || m.scope === MappingScope.CLIENT_OVERRIDE) {
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

  const holdingInputs: HoldingInput[] = accounts.flatMap((a) =>
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

  const allocation = computeAllocation(holdingInputs, mappings);

  // Build current portfolio weights
  const currentWeights: WeightInput[] = allocation.buckets.flatMap((b) =>
    b.assetClasses.map((ac) => ({
      nodeId: ac.nodeId,
      nodeName: ac.nodeName,
      weight: ac.pctOfTotal,
    })),
  );

  const portfolioResult = computeExpectedOutcomes(currentWeights, cmaInputs);

  // Compute SAA expected outcomes if assigned
  let saaResult = null;
  let saaName: string | null = null;

  const clientSAA = await prisma.clientSAA.findUnique({
    where: { clientId },
    include: {
      saa: {
        include: { allocations: { include: { node: true } } },
      },
    },
  });

  let saaWeights: WeightInput[] = [];
  if (clientSAA?.saa) {
    saaName = clientSAA.saa.name;
    saaWeights = clientSAA.saa.allocations.map((a) => ({
      nodeId: a.nodeId,
      nodeName: a.node.name,
      weight: a.targetWeight,
    }));
    saaResult = computeExpectedOutcomes(saaWeights, cmaInputs);
  }

  // Compare with firm default (if client has a non-default selection)
  let compareResult = null;
  let compareSaaResult = null;
  const compareCmaSetName = defaultCMA?.name ?? null;

  if (selectedCMA && defaultCMA && selectedCMA.id !== defaultCMA.id) {
    const defaultInputs: CMAInput[] = defaultCMA.assumptions.map((a) => ({
      nodeId: a.taxonomyNodeId,
      expReturnPct: a.expReturnPct,
      volPct: a.volPct,
    }));
    compareResult = computeExpectedOutcomes(currentWeights, defaultInputs);
    if (saaWeights.length > 0) {
      compareSaaResult = computeExpectedOutcomes(saaWeights, defaultInputs);
    }
  }

  return (
    <div className="mt-8">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
        Expected Outcomes
      </h2>

      <ExpectedOutcomesView
        clientId={clientId}
        selectedCmaSetId={clientCMASelection?.cmaSetId ?? null}
        activeCmaSets={activeCmaSets.map((s) => ({
          id: s.id,
          name: s.name,
          status: s.status,
          isDefault: s.isDefault,
        }))}
        portfolioResult={portfolioResult}
        saaResult={saaResult}
        saaName={saaName}
        cmaSetName={effectiveCMA.name}
        compareResult={compareResult}
        compareCmaSetName={compareCmaSetName}
        compareSaaResult={compareSaaResult}
      />
    </div>
  );
}

async function RebalanceSection({ clientId }: { clientId: string }) {
  // Check if SAA is assigned
  const clientSAA = await prisma.clientSAA.findUnique({
    where: { clientId },
    select: { saaId: true, saa: { select: { name: true } } },
  });

  if (!clientSAA) return null;

  // Fetch recent rebalance plans
  const plans = await prisma.rebalancePlan.findMany({
    where: { clientId },
    include: {
      trades: {
        include: { product: { select: { name: true } } },
      },
      events: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // Fetch orders for each plan
  const planIds = plans.map((p) => p.id);
  const allOrders = planIds.length > 0
    ? await prisma.order.findMany({
        where: { sourceId: { in: planIds } },
        include: {
          product: { select: { name: true } },
          events: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const ordersByPlanId = new Map<string, typeof allOrders>();
  for (const o of allOrders) {
    const list = ordersByPlanId.get(o.sourceId) ?? [];
    list.push(o);
    ordersByPlanId.set(o.sourceId, list);
  }

  const plansForUI = plans.map((p) => {
    let summary;
    try { summary = JSON.parse(p.summaryJson); } catch { summary = { totalPortfolioValue: 0, breachesBefore: 0, breachesAfter: 0, beforeDrift: [], afterDrift: [] }; }
    return {
      id: p.id,
      clientId,
      status: p.status as string,
      summary,
      createdAt: p.createdAt.toISOString(),
      trades: p.trades.map((t) => ({
        id: t.id,
        productId: t.productId,
        productName: t.product.name,
        side: t.side as string,
        amount: t.amount,
        reason: t.reason,
      })),
      events: p.events.map((e) => ({
        id: e.id,
        action: e.action as string,
        actorRole: e.actorRole,
        note: e.note,
        createdAt: e.createdAt.toISOString(),
      })),
      orders: (ordersByPlanId.get(p.id) ?? []).map((o) => ({
        id: o.id,
        productName: o.product.name,
        side: o.side as string,
        amount: o.amount,
        status: o.status as string,
        lastEvent: o.events[0]?.note ?? null,
      })),
    };
  });

  return (
    <div className="mt-8">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
        Rebalance
      </h2>
      <p className="mt-1 text-xs text-zinc-400">SAA: {clientSAA.saa.name}</p>

      <RebalanceGenerateButton clientId={clientId} />

      {plansForUI.length > 0 ? (
        plansForUI.map((plan) => (
          <RebalancePlanCard key={plan.id} plan={plan} />
        ))
      ) : (
        <p className="mt-3 text-sm text-zinc-400">No rebalance plans yet.</p>
      )}
    </div>
  );
}

type CommitmentDetail = {
  fundId: string;
  fundName: string;
  currency: string;
  commitmentAmount: number;
  fundedAmount: number;
  navAmount: number;
  distributionsAmount: number;
  latestNavDate: string | null;
  metrics: { unfunded: number; pctCalled: number; dpi: number | null; rvpi: number | null; tvpi: number | null };
  projectedCalls: { month: string; amount: number }[];
  projectedDistributions: { month: string; amount: number }[];
};

async function SleeveSection({ clientId }: { clientId: string }) {
  const sleeve = await prisma.clientSleeve.findUnique({
    where: { clientId },
    include: {
      commitments: {
        include: {
          fund: {
            select: { name: true, currency: true, profile: true },
          },
        },
      },
      liquidPositions: {
        include: { product: { select: { id: true, name: true, type: true } } },
      },
    },
  });

  if (!sleeve) {
    return (
      <div className="mt-8">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Private Markets Sleeve
        </h2>
        <CreateSleeveForm clientId={clientId} />
      </div>
    );
  }

  const commitmentInputs: CommitmentInput[] = sleeve.commitments.map((c) => ({
    fundId: c.fundId,
    fundName: c.fund.name,
    currency: c.fund.currency,
    commitmentAmount: c.commitmentAmount,
    fundedAmount: c.fundedAmount,
    navAmount: c.navAmount,
    distributionsAmount: c.distributionsAmount,
  }));

  // Build detailed commitment data with metrics and projections
  const commitmentDetails: CommitmentDetail[] = sleeve.commitments.map((c) => {
    const metrics = computeFundMetrics(c.fundedAmount, c.navAmount, c.distributionsAmount, c.commitmentAmount);

    let projectedCalls: { month: string; amount: number }[] = [];
    let projectedDistributions: { month: string; amount: number }[] = [];

    if (c.fund.profile) {
      try {
        const callCurve: CurvePoint[] = JSON.parse(c.fund.profile.projectedCallPctCurveJson);
        const incCalls = curveCumToIncremental(callCurve);
        projectedCalls = scaleIncrementalPctToDollars(incCalls, c.commitmentAmount);
      } catch { /* empty */ }
      try {
        const distCurve: CurvePoint[] = JSON.parse(c.fund.profile.projectedDistPctCurveJson);
        const incDist = curveCumToIncremental(distCurve);
        projectedDistributions = scaleIncrementalPctToDollars(incDist, c.commitmentAmount);
      } catch { /* empty */ }
    }

    return {
      fundId: c.fundId,
      fundName: c.fund.name,
      currency: c.fund.currency,
      commitmentAmount: c.commitmentAmount,
      fundedAmount: c.fundedAmount,
      navAmount: c.navAmount,
      distributionsAmount: c.distributionsAmount,
      latestNavDate: c.latestNavDate?.toISOString().slice(0, 10) ?? null,
      metrics,
      projectedCalls,
      projectedDistributions,
    };
  });

  const liquidInputs = sleeve.liquidPositions.map((p) => ({
    productId: p.productId,
    productName: p.product.name,
    marketValue: p.marketValue,
  }));

  const totals = computeSleeveTotals(commitmentInputs, liquidInputs);

  // Compute liquidity health
  const bufferConfig: BufferConfig = {
    bufferMethod: sleeve.bufferMethod,
    bufferPctOfUnfunded: sleeve.bufferPctOfUnfunded,
    bufferMonthsForward: sleeve.bufferMonthsForward,
  };

  let liquidityAssessment: LiquidityAssessment;
  if (bufferConfig.bufferMethod === "VS_UNFUNDED_PCT") {
    const unfundedByCurrency = groupByCurrency(commitmentInputs).map((ct) => ({
      currency: ct.currency,
      totalUnfunded: ct.totalUnfunded,
    }));
    const requirements = computeRequiredVsUnfunded(unfundedByCurrency, bufferConfig.bufferPctOfUnfunded);
    liquidityAssessment = assessLiquidity(requirements, totals.liquidBucketValue);
  } else {
    // VS_PROJECTED_CALLS: aggregate all projected calls across all commitments
    const allCalls: ProjectedCall[] = commitmentDetails.flatMap((c) =>
      c.projectedCalls.map((pc) => ({
        currency: c.currency,
        month: pc.month,
        amount: pc.amount,
      })),
    );
    const requirements = computeRequiredVsProjectedCalls(allCalls, bufferConfig.bufferMonthsForward);
    liquidityAssessment = assessLiquidity(requirements, totals.liquidBucketValue);
  }

  // Fetch existing unresolved alerts
  const activeAlerts = await prisma.sleeveAlert.findMany({
    where: { clientSleeveId: sleeve.id, isResolved: false },
    orderBy: { createdAt: "desc" },
  });

  // Build waterfall positions from liquid positions
  const waterfallPositions: WaterfallPosition[] = sleeve.liquidPositions.map((p) => ({
    productId: p.productId,
    productName: p.product.name,
    productType: p.product.type,
    marketValue: p.marketValue,
  }));

  // Parse waterfall configs
  let sellWaterfall: SellWaterfallEntry[] = [];
  let buyWaterfall: BuyWaterfallEntry[] = [];
  try { sellWaterfall = JSON.parse(sleeve.sellWaterfallJson); } catch { /* empty */ }
  try { buyWaterfall = JSON.parse(sleeve.buyWaterfallJson); } catch { /* empty */ }

  // Compute recommendations
  let sellRecommendation: SellRecommendation | null = null;
  let buyRecommendation: BuyRecommendation | null = null;

  if (liquidityAssessment.shortfall > 0) {
    sellRecommendation = generateSellLegs(
      waterfallPositions,
      sellWaterfall,
      liquidityAssessment.shortfall,
      sleeve.minTradeAmount,
    );
  } else {
    const excess = computeExcess(liquidityAssessment.liquidBucketValue, liquidityAssessment.totalRequired);
    if (excess > 0) {
      buyRecommendation = generateBuyLegs(
        waterfallPositions,
        buyWaterfall,
        excess,
        sleeve.minTradeAmount,
      );
    }
  }

  // Persist new recommendation as DRAFT if computed and no active (non-rejected) recommendation exists
  const existingActive = await prisma.sleeveRecommendation.findFirst({
    where: {
      clientSleeveId: sleeve.id,
      status: { not: "REJECTED" },
    },
    orderBy: { createdAt: "desc" },
  });

  const recommendation = sellRecommendation || buyRecommendation;
  if (recommendation && !existingActive) {
    const kind = sellRecommendation ? "RAISE_LIQUIDITY" as const : "INVEST_EXCESS" as const;
    const legs = sellRecommendation?.legs ?? buyRecommendation?.legs ?? [];
    await prisma.sleeveRecommendation.create({
      data: {
        clientSleeveId: sleeve.id,
        kind,
        summary: recommendation.summary,
        status: "DRAFT",
        legs: {
          create: legs.map((leg) => ({
            action: sellRecommendation ? "SELL" : "BUY",
            productId: leg.productId,
            amount: leg.amount,
            reason: leg.reason,
          })),
        },
      },
    });
  }

  // Fetch persisted recommendations with events
  const persistedRecommendations = await prisma.sleeveRecommendation.findMany({
    where: { clientSleeveId: sleeve.id },
    include: {
      legs: { include: { product: { select: { name: true, type: true } } } },
      events: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // Fetch orders for each recommendation
  const recIds = persistedRecommendations.map((r) => r.id);
  const allOrders = recIds.length > 0
    ? await prisma.order.findMany({
        where: { sourceId: { in: recIds } },
        include: {
          product: { select: { name: true } },
          events: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const ordersByRecId = new Map<string, typeof allOrders>();
  for (const o of allOrders) {
    const list = ordersByRecId.get(o.sourceId) ?? [];
    list.push(o);
    ordersByRecId.set(o.sourceId, list);
  }

  const recommendationsForUI = persistedRecommendations.map((r) => ({
    id: r.id,
    kind: r.kind as string,
    summary: r.summary,
    status: r.status as string,
    createdAt: r.createdAt.toISOString(),
    adviserApprovedAt: r.adviserApprovedAt?.toISOString() ?? null,
    clientApprovedAt: r.clientApprovedAt?.toISOString() ?? null,
    rejectedAt: r.rejectedAt?.toISOString() ?? null,
    rejectionReason: r.rejectionReason,
    legs: r.legs.map((l) => ({
      id: l.id,
      action: l.action as string,
      productId: l.productId,
      productName: l.product.name,
      amount: l.amount,
      reason: l.reason,
    })),
    events: r.events.map((e) => ({
      id: e.id,
      action: e.action as string,
      actorUserId: e.actorUserId,
      actorRole: e.actorRole,
      note: e.note,
      createdAt: e.createdAt.toISOString(),
    })),
    orders: (ordersByRecId.get(r.id) ?? []).map((o) => ({
      id: o.id,
      productName: o.product.name,
      side: o.side as string,
      amount: o.amount,
      status: o.status as string,
      updatedAt: o.updatedAt.toISOString(),
      lastEvent: o.events[0]?.note ?? null,
    })),
  }));

  // Approved funds for the commitment form — scoped by wealth group
  const sleeveClient = await prisma.client.findUnique({
    where: { id: clientId },
    select: { wealthGroupId: true },
  });
  const approvedFunds = await prisma.pMFund.findMany({
    where: {
      approvals: {
        some: {
          isApproved: true,
          ...(sleeveClient?.wealthGroupId ? { wealthGroupId: sleeveClient.wealthGroupId } : {}),
        },
      },
    },
    select: { id: true, name: true, currency: true },
    orderBy: { name: "asc" },
  });

  // All products for the liquid position form + waterfall config
  const products = await prisma.product.findMany({
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mt-8">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
        Private Markets Sleeve — {sleeve.name}
      </h2>
      <SleeveSummary
        sleeveName={sleeve.name}
        targetPct={sleeve.targetPct}
        cashBufferPct={sleeve.cashBufferPct}
        totals={totals}
        commitmentDetails={commitmentDetails}
        liquidPositions={liquidInputs}
        clientId={clientId}
        sleeveId={sleeve.id}
        approvedFunds={approvedFunds}
        products={products}
        bufferConfig={bufferConfig}
        liquidityAssessment={liquidityAssessment}
        activeAlerts={activeAlerts.map((a) => ({
          id: a.id,
          severity: a.severity,
          message: a.message,
          createdAt: a.createdAt.toISOString(),
        }))}
        sellRecommendation={sellRecommendation}
        buyRecommendation={buyRecommendation}
        sellWaterfall={sellWaterfall}
        buyWaterfall={buyWaterfall}
        minTradeAmount={sleeve.minTradeAmount}
        recommendations={recommendationsForUI}
      />
    </div>
  );
}
