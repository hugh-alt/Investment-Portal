/**
 * Liquidity profile resolution and ladder aggregation.
 * Pure functions — no DB imports.
 */

// ── Types ─────────────────────────────────────────────────

export type LiquidityProfileData = {
  tier: string;
  horizonDays: number;
  stressedHaircutPct: number;
  gateOrSuspendRisk: boolean;
};

export type ProductOverride = {
  productId: string;
  profile: LiquidityProfileData;
};

export type TaxonomyDefault = {
  nodeId: string;
  profile: LiquidityProfileData;
};

export type TaxonomyNode = {
  id: string;
  parentId: string | null;
};

export type ProductMapping = {
  productId: string;
  nodeId: string;
};

export type ResolvedProfile = LiquidityProfileData & {
  source: "PRODUCT_OVERRIDE" | "TAXONOMY_DEFAULT" | "ASSUMED";
};

export type ExposureInput = {
  productId: string;
  productName: string;
  marketValue: number;
};

export type LadderBucket = {
  horizonLabel: string;
  horizonDays: number;
  grossValue: number;
  stressedValue: number;
  pctOfPortfolio: number;
  cumulativeStressedValue: number;
  cumulativePct: number;
  gatedCount: number;
};

export type LiquidityLadderResult = {
  buckets: LadderBucket[];
  totalPortfolioValue: number;
  assumedCount: number;
  gatedCount: number;
  exposures: {
    productId: string;
    productName: string;
    marketValue: number;
    profile: ResolvedProfile;
  }[];
};

// ── Resolution ────────────────────────────────────────────

const FALLBACK_PROFILE: LiquidityProfileData = {
  tier: "LISTED",
  horizonDays: 2,
  stressedHaircutPct: 0,
  gateOrSuspendRisk: false,
};

/**
 * Resolve the effective liquidity profile for a product.
 * Priority: product override → taxonomy default (walk up parents) → fallback.
 */
export function resolveProfile(
  productId: string,
  productMappings: ProductMapping[],
  overrides: Map<string, LiquidityProfileData>,
  taxonomyDefaults: Map<string, LiquidityProfileData>,
  nodes: Map<string, TaxonomyNode>,
): ResolvedProfile {
  // 1. Product override
  const override = overrides.get(productId);
  if (override) {
    return { ...override, source: "PRODUCT_OVERRIDE" };
  }

  // 2. Taxonomy default — find mapping, walk up tree
  const mapping = productMappings.find((m) => m.productId === productId);
  if (mapping) {
    let nodeId: string | null = mapping.nodeId;
    while (nodeId) {
      const def = taxonomyDefaults.get(nodeId);
      if (def) {
        return { ...def, source: "TAXONOMY_DEFAULT" };
      }
      const node = nodes.get(nodeId);
      nodeId = node?.parentId ?? null;
    }
  }

  // 3. Fallback
  return { ...FALLBACK_PROFILE, source: "ASSUMED" };
}

// ── Ladder ────────────────────────────────────────────────

const HORIZON_BUCKETS = [
  { horizonLabel: "T+2 (Listed)", horizonDays: 2 },
  { horizonLabel: "30 days", horizonDays: 30 },
  { horizonLabel: "90 days", horizonDays: 90 },
  { horizonLabel: "365 days", horizonDays: 365 },
  { horizonLabel: "Locked (>365d)", horizonDays: Infinity },
];

/**
 * Build a liquidity ladder for a set of product exposures.
 * Groups exposures into horizon buckets, applies haircuts.
 */
export function buildLiquidityLadder(
  exposures: ExposureInput[],
  productMappings: ProductMapping[],
  overrides: Map<string, LiquidityProfileData>,
  taxonomyDefaults: Map<string, LiquidityProfileData>,
  nodes: Map<string, TaxonomyNode>,
): LiquidityLadderResult {
  const totalPortfolioValue = exposures.reduce((s, e) => s + e.marketValue, 0);
  if (totalPortfolioValue === 0) {
    return { buckets: [], totalPortfolioValue: 0, assumedCount: 0, gatedCount: 0, exposures: [] };
  }

  let assumedCount = 0;
  let gatedCount = 0;
  const resolvedExposures = exposures.map((e) => {
    const profile = resolveProfile(e.productId, productMappings, overrides, taxonomyDefaults, nodes);
    if (profile.source === "ASSUMED") assumedCount++;
    if (profile.gateOrSuspendRisk) gatedCount++;
    return { ...e, profile };
  });

  // Assign each exposure to the matching horizon bucket
  const bucketTotals = HORIZON_BUCKETS.map((b) => ({
    ...b,
    grossValue: 0,
    stressedValue: 0,
    gatedCount: 0,
  }));

  for (const exp of resolvedExposures) {
    const hz = exp.profile.horizonDays;
    const isLocked = exp.profile.tier === "LOCKED";
    // LOCKED always goes to the locked bucket (last); otherwise find first bucket >= horizonDays
    let bucketIdx: number;
    if (isLocked) {
      bucketIdx = bucketTotals.length - 1;
    } else {
      bucketIdx = bucketTotals.length - 1;
      for (let i = 0; i < bucketTotals.length - 1; i++) {
        if (hz <= bucketTotals[i].horizonDays) {
          bucketIdx = i;
          break;
        }
      }
    }
    bucketTotals[bucketIdx].grossValue += exp.marketValue;
    bucketTotals[bucketIdx].stressedValue +=
      exp.marketValue * (1 - exp.profile.stressedHaircutPct);
    if (exp.profile.gateOrSuspendRisk) {
      bucketTotals[bucketIdx].gatedCount++;
    }
  }

  let cumulativeStressed = 0;
  const buckets: LadderBucket[] = bucketTotals.map((b) => {
    cumulativeStressed += b.stressedValue;
    return {
      horizonLabel: b.horizonLabel,
      horizonDays: b.horizonDays,
      grossValue: b.grossValue,
      stressedValue: b.stressedValue,
      pctOfPortfolio: b.stressedValue / totalPortfolioValue,
      cumulativeStressedValue: cumulativeStressed,
      cumulativePct: cumulativeStressed / totalPortfolioValue,
      gatedCount: b.gatedCount,
    };
  });

  return {
    buckets,
    totalPortfolioValue,
    assumedCount,
    gatedCount,
    exposures: resolvedExposures,
  };
}

// ── Governance helpers ────────────────────────────────────

export type ClientLiquidityRiskRow = {
  clientId: string;
  clientName: string;
  adviserName: string;
  adviserId: string;
  pctLiquid30d: number;
  pctLiquid90d: number;
  totalValue: number;
  assumedCount: number;
  gatedCount: number;
};

export function buildClientLiquidityRiskRows(
  clients: {
    clientId: string;
    clientName: string;
    adviserName: string;
    adviserId: string;
    ladder: LiquidityLadderResult;
  }[],
): ClientLiquidityRiskRow[] {
  return clients.map((c) => {
    const b30 = c.ladder.buckets.find((b) => b.horizonDays === 30);
    const b90 = c.ladder.buckets.find((b) => b.horizonDays === 90);
    return {
      clientId: c.clientId,
      clientName: c.clientName,
      adviserName: c.adviserName,
      adviserId: c.adviserId,
      pctLiquid30d: b30?.cumulativePct ?? 0,
      pctLiquid90d: b90?.cumulativePct ?? 0,
      totalValue: c.ladder.totalPortfolioValue,
      assumedCount: c.ladder.assumedCount,
      gatedCount: c.ladder.gatedCount,
    };
  });
}
