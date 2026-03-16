import { describe, it, expect } from "vitest";
import {
  resolveProfile,
  buildLiquidityLadder,
  buildClientLiquidityRiskRows,
  computeMaxLiquidatableFraction,
  computeGatedAvailableValue,
  type LiquidityProfileData,
  type ProductMapping,
  type TaxonomyNode,
} from "../liquidity-profile";

const listed: LiquidityProfileData = { tier: "LISTED", horizonDays: 2, stressedHaircutPct: 0.02, gateOrSuspendRisk: false };
const semiLiquid: LiquidityProfileData = { tier: "FUND_SEMI_LIQUID", horizonDays: 90, stressedHaircutPct: 0.10, gateOrSuspendRisk: false };
const privateTier: LiquidityProfileData = { tier: "PRIVATE", horizonDays: 365, stressedHaircutPct: 0.20, gateOrSuspendRisk: false };
const locked: LiquidityProfileData = { tier: "LOCKED", horizonDays: 730, stressedHaircutPct: 0.25, gateOrSuspendRisk: true };

const nodes = new Map<string, TaxonomyNode>([
  ["root", { id: "root", parentId: null }],
  ["growth", { id: "growth", parentId: "root" }],
  ["au-eq", { id: "au-eq", parentId: "growth" }],
]);

const mappings: ProductMapping[] = [
  { productId: "prod-bhp", nodeId: "au-eq" },
  { productId: "prod-xyz", nodeId: "growth" },
];

describe("resolveProfile", () => {
  it("uses product override when available", () => {
    const overrides = new Map([["prod-bhp", semiLiquid]]);
    const taxDefaults = new Map([["au-eq", listed]]);
    const result = resolveProfile("prod-bhp", mappings, overrides, taxDefaults, nodes);
    expect(result.source).toBe("PRODUCT_OVERRIDE");
    expect(result.horizonDays).toBe(90);
  });

  it("uses taxonomy default at mapped node", () => {
    const overrides = new Map<string, LiquidityProfileData>();
    const taxDefaults = new Map([["au-eq", listed]]);
    const result = resolveProfile("prod-bhp", mappings, overrides, taxDefaults, nodes);
    expect(result.source).toBe("TAXONOMY_DEFAULT");
    expect(result.horizonDays).toBe(2);
  });

  it("walks up taxonomy tree to find default", () => {
    const overrides = new Map<string, LiquidityProfileData>();
    const taxDefaults = new Map([["growth", semiLiquid]]);
    const result = resolveProfile("prod-bhp", mappings, overrides, taxDefaults, nodes);
    expect(result.source).toBe("TAXONOMY_DEFAULT");
    expect(result.horizonDays).toBe(90);
  });

  it("returns ASSUMED fallback when no match", () => {
    const overrides = new Map<string, LiquidityProfileData>();
    const taxDefaults = new Map<string, LiquidityProfileData>();
    const result = resolveProfile("prod-unknown", [], overrides, taxDefaults, nodes);
    expect(result.source).toBe("ASSUMED");
    expect(result.horizonDays).toBe(2);
    expect(result.stressedHaircutPct).toBe(0);
    expect(result.gateOrSuspendRisk).toBe(false);
  });

  it("carries gateOrSuspendRisk from profile", () => {
    const overrides = new Map([["prod-bhp", locked]]);
    const result = resolveProfile("prod-bhp", mappings, overrides, new Map(), nodes);
    expect(result.gateOrSuspendRisk).toBe(true);
    expect(result.tier).toBe("LOCKED");
  });

  // Hierarchy tests: platform > adviser > taxonomy > fallback
  it("platform override takes precedence over adviser override", () => {
    const platformOverrides = new Map([["prod-bhp", listed]]);
    const adviserOverrides = new Map([["prod-bhp", semiLiquid]]);
    const result = resolveProfile("prod-bhp", mappings, platformOverrides, new Map(), nodes, adviserOverrides);
    expect(result.source).toBe("PRODUCT_OVERRIDE");
    expect(result.tier).toBe("LISTED");
  });

  it("adviser override takes precedence over taxonomy default", () => {
    const overrides = new Map<string, LiquidityProfileData>();
    const adviserOverrides = new Map([["prod-bhp", semiLiquid]]);
    const taxDefaults = new Map([["au-eq", listed]]);
    const result = resolveProfile("prod-bhp", mappings, overrides, taxDefaults, nodes, adviserOverrides);
    expect(result.source).toBe("ADVISER_OVERRIDE");
    expect(result.tier).toBe("FUND_SEMI_LIQUID");
  });

  it("adviser override takes precedence over fallback", () => {
    const overrides = new Map<string, LiquidityProfileData>();
    const adviserOverrides = new Map([["prod-unknown", privateTier]]);
    const result = resolveProfile("prod-unknown", [], overrides, new Map(), nodes, adviserOverrides);
    expect(result.source).toBe("ADVISER_OVERRIDE");
    expect(result.tier).toBe("PRIVATE");
  });

  it("taxonomy default used when no adviser override", () => {
    const overrides = new Map<string, LiquidityProfileData>();
    const adviserOverrides = new Map<string, LiquidityProfileData>(); // empty
    const taxDefaults = new Map([["au-eq", listed]]);
    const result = resolveProfile("prod-bhp", mappings, overrides, taxDefaults, nodes, adviserOverrides);
    expect(result.source).toBe("TAXONOMY_DEFAULT");
  });
});

describe("computeMaxLiquidatableFraction", () => {
  it("returns 0 when horizon < profile horizonDays", () => {
    const profile: LiquidityProfileData = { ...semiLiquid, horizonDays: 90 };
    expect(computeMaxLiquidatableFraction(profile, 30)).toBe(0);
  });

  it("returns 1 for simple profile (no gating)", () => {
    expect(computeMaxLiquidatableFraction(listed, 30)).toBe(1);
  });

  it("returns 0 when notice period exceeds horizon", () => {
    const profile: LiquidityProfileData = {
      ...semiLiquid,
      horizonDays: 30,
      noticeDays: 45,
    };
    expect(computeMaxLiquidatableFraction(profile, 30)).toBe(0);
  });

  it("applies notice + gate correctly", () => {
    // noticeDays=15, gatePctPerPeriod=0.10, gatePeriodDays=90
    // At horizon 30d: effective = 30-15 = 15, periods = floor(15/90) = 0 → 0
    const profile: LiquidityProfileData = {
      tier: "FUND_SEMI_LIQUID",
      horizonDays: 30,
      stressedHaircutPct: 0.10,
      gateOrSuspendRisk: true,
      noticeDays: 15,
      gatePctPerPeriod: 0.10,
      gatePeriodDays: 90,
    };
    expect(computeMaxLiquidatableFraction(profile, 30)).toBe(0);
  });

  it("applies gate fraction over multiple periods", () => {
    // gatePctPerPeriod=0.10, gatePeriodDays=90
    // At horizon 365d: periods = floor(365/90) = 4, fraction = min(1, 0.10 * 4) = 0.4
    const profile: LiquidityProfileData = {
      tier: "FUND_SEMI_LIQUID",
      horizonDays: 30,
      stressedHaircutPct: 0.10,
      gateOrSuspendRisk: true,
      gatePctPerPeriod: 0.10,
      gatePeriodDays: 90,
    };
    expect(computeMaxLiquidatableFraction(profile, 365)).toBeCloseTo(0.4);
  });

  it("caps fraction at 1.0", () => {
    // gatePctPerPeriod=0.25, gatePeriodDays=90
    // At horizon 365d: periods = 4, fraction = min(1, 0.25*4) = 1.0
    const profile: LiquidityProfileData = {
      tier: "FUND_SEMI_LIQUID",
      horizonDays: 30,
      stressedHaircutPct: 0.10,
      gateOrSuspendRisk: false,
      gatePctPerPeriod: 0.25,
      gatePeriodDays: 90,
    };
    expect(computeMaxLiquidatableFraction(profile, 365)).toBe(1);
  });

  it("notice delays then gate fraction applied", () => {
    // noticeDays=10, gatePctPerPeriod=0.10, gatePeriodDays=90
    // At horizon 365d: effective = 365-10 = 355, periods = floor(355/90) = 3, fraction = 0.3
    const profile: LiquidityProfileData = {
      tier: "FUND_SEMI_LIQUID",
      horizonDays: 30,
      stressedHaircutPct: 0.10,
      gateOrSuspendRisk: true,
      noticeDays: 10,
      gatePctPerPeriod: 0.10,
      gatePeriodDays: 90,
    };
    expect(computeMaxLiquidatableFraction(profile, 365)).toBeCloseTo(0.3);
  });

  it("returns 0 for LOCKED beyond horizon", () => {
    expect(computeMaxLiquidatableFraction(locked, 365)).toBe(0);
  });
});

describe("computeGatedAvailableValue", () => {
  it("returns full stressed value with no gating", () => {
    expect(computeGatedAvailableValue(100_000, listed, 30)).toBeCloseTo(98_000);
  });

  it("reduces value by gate fraction", () => {
    const gated: LiquidityProfileData = {
      tier: "FUND_SEMI_LIQUID",
      horizonDays: 30,
      stressedHaircutPct: 0.10,
      gateOrSuspendRisk: true,
      gatePctPerPeriod: 0.10,
      gatePeriodDays: 90,
    };
    // 30d horizon: periods = floor(30/90)=0, fraction=0 → 0
    expect(computeGatedAvailableValue(100_000, gated, 30)).toBe(0);
    // 90d: periods=1, fraction=0.10 → 90k * 0.10 = 9k
    expect(computeGatedAvailableValue(100_000, gated, 90)).toBeCloseTo(9_000);
  });
});

describe("buildLiquidityLadder", () => {
  it("groups exposures into horizon buckets with haircuts", () => {
    const overrides = new Map([["prod-priv", privateTier]]);
    const taxDefaults = new Map([["au-eq", listed]]);

    const result = buildLiquidityLadder(
      [
        { productId: "prod-bhp", productName: "BHP", marketValue: 100_000 },
        { productId: "prod-priv", productName: "Private Fund", marketValue: 50_000 },
      ],
      mappings,
      overrides,
      taxDefaults,
      nodes,
    );

    expect(result.totalPortfolioValue).toBe(150_000);
    expect(result.assumedCount).toBe(0);
    expect(result.buckets).toHaveLength(5);

    // T+2 bucket: BHP 100k with 2% haircut -> 98k stressed
    const t2 = result.buckets[0];
    expect(t2.grossValue).toBe(100_000);
    expect(t2.stressedValue).toBeCloseTo(98_000);

    // 365 bucket: Private 50k with 20% haircut -> 40k stressed
    const t365 = result.buckets[3];
    expect(t365.grossValue).toBe(50_000);
    expect(t365.stressedValue).toBeCloseTo(40_000);

    // Locked bucket: empty
    const tLocked = result.buckets[4];
    expect(tLocked.grossValue).toBe(0);
  });

  it("assigns LOCKED tier to the locked bucket", () => {
    const overrides = new Map([
      ["prod-bhp", listed],
      ["prod-locked", locked],
    ]);

    const result = buildLiquidityLadder(
      [
        { productId: "prod-bhp", productName: "BHP", marketValue: 100_000 },
        { productId: "prod-locked", productName: "Locked Fund", marketValue: 40_000 },
      ],
      mappings,
      overrides,
      new Map(),
      nodes,
    );

    expect(result.buckets).toHaveLength(5);

    const lockedBucket = result.buckets[4];
    expect(lockedBucket.horizonLabel).toBe("Locked (>365d)");
    expect(lockedBucket.grossValue).toBe(40_000);
    expect(lockedBucket.stressedValue).toBeCloseTo(30_000);
    expect(lockedBucket.gatedCount).toBe(1);
    expect(result.gatedCount).toBe(1);
  });

  it("tracks gateOrSuspendRisk across buckets", () => {
    const gatedSemiLiquid: LiquidityProfileData = {
      ...semiLiquid,
      gateOrSuspendRisk: true,
    };
    const overrides = new Map([["prod-gated", gatedSemiLiquid]]);

    const result = buildLiquidityLadder(
      [{ productId: "prod-gated", productName: "Gated Fund", marketValue: 50_000 }],
      [],
      overrides,
      new Map(),
      nodes,
    );

    expect(result.gatedCount).toBe(1);
    const b90 = result.buckets[2];
    expect(b90.gatedCount).toBe(1);
  });

  it("counts assumed profiles", () => {
    const result = buildLiquidityLadder(
      [{ productId: "prod-unknown", productName: "Unknown", marketValue: 10_000 }],
      [],
      new Map(),
      new Map(),
      nodes,
    );
    expect(result.assumedCount).toBe(1);
    expect(result.gatedCount).toBe(0);
  });

  it("returns empty for no exposures", () => {
    const result = buildLiquidityLadder([], [], new Map(), new Map(), nodes);
    expect(result.buckets).toHaveLength(0);
    expect(result.totalPortfolioValue).toBe(0);
  });

  it("computes maxLiquidatablePct < 1 for gated assets", () => {
    const gated: LiquidityProfileData = {
      tier: "FUND_SEMI_LIQUID",
      horizonDays: 30,
      stressedHaircutPct: 0.10,
      gateOrSuspendRisk: true,
      gatePctPerPeriod: 0.10,
      gatePeriodDays: 90,
    };
    const overrides = new Map([["prod-gated", gated]]);

    const result = buildLiquidityLadder(
      [{ productId: "prod-gated", productName: "Gated", marketValue: 100_000 }],
      [],
      overrides,
      new Map(),
      nodes,
    );

    // 30d bucket: gate fraction at 30d horizon = floor(30/90)=0 → maxLiq = 0
    const b30 = result.buckets[1];
    expect(b30.maxLiquidatablePct).toBe(0);
  });

  it("passes adviser overrides to resolver", () => {
    const overrides = new Map<string, LiquidityProfileData>();
    const advOverrides = new Map([["prod-bhp", semiLiquid]]);
    const taxDefaults = new Map([["au-eq", listed]]);

    const result = buildLiquidityLadder(
      [{ productId: "prod-bhp", productName: "BHP", marketValue: 100_000 }],
      mappings,
      overrides,
      taxDefaults,
      nodes,
      advOverrides,
    );

    expect(result.exposures[0].profile.source).toBe("ADVISER_OVERRIDE");
    expect(result.exposures[0].profile.tier).toBe("FUND_SEMI_LIQUID");
  });
});

describe("buildClientLiquidityRiskRows", () => {
  it("computes 30d and 90d percentages from ladder", () => {
    const ladder = buildLiquidityLadder(
      [
        { productId: "prod-bhp", productName: "BHP", marketValue: 80_000 },
        { productId: "prod-priv", productName: "Private", marketValue: 20_000 },
      ],
      mappings,
      new Map([["prod-priv", privateTier]]),
      new Map([["au-eq", listed]]),
      nodes,
    );

    const rows = buildClientLiquidityRiskRows([
      { clientId: "c1", clientName: "Alice", adviserName: "Adv", adviserId: "a1", ladder },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].pctLiquid30d).toBeCloseTo(0.784);
    expect(rows[0].pctLiquid90d).toBeCloseTo(0.784);
    expect(rows[0].totalValue).toBe(100_000);
    expect(rows[0].gatedCount).toBe(0);
  });

  it("includes gatedCount from ladder", () => {
    const ladder = buildLiquidityLadder(
      [{ productId: "prod-lock", productName: "Locked", marketValue: 50_000 }],
      [],
      new Map([["prod-lock", locked]]),
      new Map(),
      nodes,
    );

    const rows = buildClientLiquidityRiskRows([
      { clientId: "c1", clientName: "Alice", adviserName: "Adv", adviserId: "a1", ladder },
    ]);

    expect(rows[0].gatedCount).toBe(1);
  });
});
