import { describe, it, expect } from "vitest";
import {
  resolveProfile,
  buildLiquidityLadder,
  buildClientLiquidityRiskRows,
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

    // T+2 bucket: BHP 100k with 2% haircut → 98k stressed
    const t2 = result.buckets[0];
    expect(t2.grossValue).toBe(100_000);
    expect(t2.stressedValue).toBeCloseTo(98_000);

    // 365 bucket: Private 50k with 20% haircut → 40k stressed
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

    // Locked bucket should have the locked fund
    const lockedBucket = result.buckets[4];
    expect(lockedBucket.horizonLabel).toBe("Locked (>365d)");
    expect(lockedBucket.grossValue).toBe(40_000);
    expect(lockedBucket.stressedValue).toBeCloseTo(30_000); // 25% haircut
    expect(lockedBucket.gatedCount).toBe(1);

    // Total gated count on result
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
    // 30d cumulative = T+2 stressed (78.4k) / 100k = 0.784
    expect(rows[0].pctLiquid30d).toBeCloseTo(0.784);
    // 90d cumulative = same (no 30d/90d exposures) = 0.784
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
