import { describe, it, expect } from "vitest";
import {
  computeAvailableLiquidity,
  computeRequiredLiquidity,
  computeClientStress,
  horizonToMonths,
  sumCallsWithinMonths,
  buildLiquidityStressGovRows,
} from "../liquidity-stress";
import type { StressRule, PMCallInput, BufferInput } from "../liquidity-stress";
import type { LiquidityProfileData, ProductMapping, TaxonomyNode, ExposureInput } from "../liquidity-profile";

// Test fixtures
const overrides = new Map<string, LiquidityProfileData>([
  ["prod-listed", { tier: "LISTED", horizonDays: 2, stressedHaircutPct: 0.02, gateOrSuspendRisk: false }],
  ["prod-fund", { tier: "FUND_LIQUID", horizonDays: 30, stressedHaircutPct: 0.05, gateOrSuspendRisk: false }],
  ["prod-private", { tier: "PRIVATE", horizonDays: 365, stressedHaircutPct: 0.20, gateOrSuspendRisk: false }],
  ["prod-locked", { tier: "LOCKED", horizonDays: 730, stressedHaircutPct: 0.25, gateOrSuspendRisk: true }],
]);
const taxonomyDefaults = new Map<string, LiquidityProfileData>();
const nodes = new Map<string, TaxonomyNode>();
const productMappings: ProductMapping[] = [];

const exposures: ExposureInput[] = [
  { productId: "prod-listed", productName: "Listed Equities", marketValue: 500_000 },
  { productId: "prod-fund", productName: "Bond Fund", marketValue: 300_000 },
  { productId: "prod-private", productName: "Private Credit", marketValue: 150_000 },
  { productId: "prod-locked", productName: "Locked Fund", marketValue: 50_000 },
];

describe("horizonToMonths", () => {
  it("converts 30d to 1 month", () => expect(horizonToMonths(30)).toBe(1));
  it("converts 90d to 3 months", () => expect(horizonToMonths(90)).toBe(3));
  it("converts 365d to 13 months (ceiling)", () => expect(horizonToMonths(365)).toBe(13));
});

describe("computeAvailableLiquidity", () => {
  it("includes only exposures with horizonDays <= scenario horizon", () => {
    // 30d: only listed (2d) and fund-liquid (30d)
    const avail30 = computeAvailableLiquidity(exposures, productMappings, overrides, taxonomyDefaults, nodes, 30);
    // Listed: 500k * 0.98 = 490k, Fund: 300k * 0.95 = 285k
    expect(avail30).toBeCloseTo(490_000 + 285_000, 0);
  });

  it("includes private at 365d horizon", () => {
    const avail365 = computeAvailableLiquidity(exposures, productMappings, overrides, taxonomyDefaults, nodes, 365);
    // Listed + Fund + Private (150k * 0.80 = 120k)
    expect(avail365).toBeCloseTo(490_000 + 285_000 + 120_000, 0);
  });

  it("excludes LOCKED tier when horizon < lockup", () => {
    const avail365 = computeAvailableLiquidity(exposures, productMappings, overrides, taxonomyDefaults, nodes, 365);
    // Locked has 730d > 365d, excluded
    expect(avail365).toBeCloseTo(895_000, 0);
  });
});

describe("sumCallsWithinMonths", () => {
  const calls: PMCallInput[] = [
    { currency: "AUD", month: "2026-04", amount: 50_000 },
    { currency: "AUD", month: "2026-05", amount: 30_000 },
    { currency: "AUD", month: "2026-06", amount: 20_000 },
    { currency: "USD", month: "2026-04", amount: 10_000 },
  ];

  it("sums AUD calls within 1 month", () => {
    expect(sumCallsWithinMonths(calls, 1, "AUD")).toBe(50_000);
  });

  it("sums AUD calls within 3 months", () => {
    expect(sumCallsWithinMonths(calls, 3, "AUD")).toBe(100_000);
  });

  it("sums USD calls separately", () => {
    expect(sumCallsWithinMonths(calls, 1, "USD")).toBe(10_000);
  });
});

describe("computeRequiredLiquidity", () => {
  const rule: StressRule = { horizonDays: 30, extraCashDemandPct: 0, extraCashDemandAmount: 0 };
  const calls: PMCallInput[] = [
    { currency: "AUD", month: "2026-04", amount: 50_000 },
  ];

  it("includes PM calls in required liquidity", () => {
    const result = computeRequiredLiquidity(rule, 1_000_000, calls, null);
    expect(result.required).toBe(50_000);
    expect(result.pmCallsAUD).toBe(50_000);
  });

  it("includes buffer requirement (VS_UNFUNDED_PCT)", () => {
    const buffer: BufferInput = {
      method: "VS_UNFUNDED_PCT",
      unfundedAUD: 200_000,
      bufferPctOfUnfunded: 0.10,
      projectedCallsWithinMonths: 3,
      projectedCallsAUD: 0,
    };
    const result = computeRequiredLiquidity(rule, 1_000_000, calls, buffer);
    // 50k calls + 20k buffer
    expect(result.required).toBe(70_000);
  });

  it("includes extra demand pct", () => {
    const ruleWithExtra: StressRule = { horizonDays: 30, extraCashDemandPct: 0.05, extraCashDemandAmount: 0 };
    const result = computeRequiredLiquidity(ruleWithExtra, 1_000_000, calls, null);
    // 50k calls + 50k (5% of 1M)
    expect(result.required).toBe(100_000);
  });

  it("includes extra demand absolute", () => {
    const ruleWithExtra: StressRule = { horizonDays: 30, extraCashDemandPct: 0, extraCashDemandAmount: 25_000 };
    const result = computeRequiredLiquidity(ruleWithExtra, 1_000_000, calls, null);
    expect(result.required).toBe(75_000);
  });

  it("reports foreign currency calls separately", () => {
    const mixedCalls: PMCallInput[] = [
      { currency: "AUD", month: "2026-04", amount: 50_000 },
      { currency: "USD", month: "2026-04", amount: 10_000 },
    ];
    const result = computeRequiredLiquidity(rule, 1_000_000, mixedCalls, null);
    expect(result.foreignCalls).toEqual([{ currency: "USD", amount: 10_000 }]);
    // Foreign calls NOT included in required (AUD-only)
    expect(result.required).toBe(50_000);
  });
});

describe("computeClientStress", () => {
  const rules: StressRule[] = [
    { horizonDays: 30, extraCashDemandPct: 0, extraCashDemandAmount: 0 },
    { horizonDays: 90, extraCashDemandPct: 0, extraCashDemandAmount: 0 },
    { horizonDays: 365, extraCashDemandPct: 0, extraCashDemandAmount: 0 },
  ];

  it("returns OK when available > required at all horizons", () => {
    const smallCalls: PMCallInput[] = [
      { currency: "AUD", month: "2026-04", amount: 10_000 },
    ];
    const result = computeClientStress(
      "c1", exposures, productMappings, overrides, taxonomyDefaults, nodes,
      rules, smallCalls, null,
    );
    expect(result.worstStatus).toBe("OK");
    expect(result.horizons[0].coverageRatio).toBeGreaterThan(1);
  });

  it("returns CRITICAL when required >> available at 30d", () => {
    // Available at 30d ≈ 775k. Need > 775/0.8 ≈ 969k for CRITICAL
    const hugeCalls: PMCallInput[] = [
      { currency: "AUD", month: "2026-04", amount: 1_200_000 },
    ];
    const result = computeClientStress(
      "c1", exposures, productMappings, overrides, taxonomyDefaults, nodes,
      rules, hugeCalls, null,
    );
    expect(result.horizons[0].status).toBe("CRITICAL");
    expect(result.horizons[0].shortfall).toBeGreaterThan(0);
    expect(result.worstStatus).toBe("CRITICAL");
  });

  it("returns WARN when coverage between 0.8 and 1.0", () => {
    // Available at 30d ≈ 775k. Need ~850k for WARN
    const calls: PMCallInput[] = [
      { currency: "AUD", month: "2026-04", amount: 850_000 },
    ];
    const result = computeClientStress(
      "c1", exposures, productMappings, overrides, taxonomyDefaults, nodes,
      rules, calls, null,
    );
    expect(result.horizons[0].status).toBe("WARN");
  });

  it("handles zero required (no calls, no buffer)", () => {
    const result = computeClientStress(
      "c1", exposures, productMappings, overrides, taxonomyDefaults, nodes,
      rules, [], null,
    );
    expect(result.horizons[0].status).toBe("OK");
    expect(result.horizons[0].coverageRatio).toBeGreaterThan(1);
  });
});

describe("buildLiquidityStressGovRows", () => {
  it("sorts by worst 30d coverage ascending", () => {
    const rules: StressRule[] = [
      { horizonDays: 30, extraCashDemandPct: 0, extraCashDemandAmount: 0 },
      { horizonDays: 90, extraCashDemandPct: 0, extraCashDemandAmount: 0 },
    ];

    const stress1 = computeClientStress(
      "c1", exposures, productMappings, overrides, taxonomyDefaults, nodes,
      rules, [{ currency: "AUD", month: "2026-04", amount: 1_200_000 }], null,
    );
    const stress2 = computeClientStress(
      "c2", exposures, productMappings, overrides, taxonomyDefaults, nodes,
      rules, [{ currency: "AUD", month: "2026-04", amount: 10_000 }], null,
    );

    const rows = buildLiquidityStressGovRows([
      { clientId: "c2", clientName: "Good", adviserName: "A", adviserId: "a1", stress: stress2 },
      { clientId: "c1", clientName: "Bad", adviserName: "A", adviserId: "a1", stress: stress1 },
    ]);

    expect(rows[0].clientId).toBe("c1"); // worst coverage first
    expect(rows[0].worstStatus).toBe("CRITICAL");
    expect(rows[1].clientId).toBe("c2");
    expect(rows[1].worstStatus).toBe("OK");
  });
});
