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
    const avail30 = computeAvailableLiquidity(exposures, productMappings, overrides, taxonomyDefaults, nodes, 30);
    // Listed: 500k * 0.98 = 490k, Fund: 300k * 0.95 = 285k
    expect(avail30).toBeCloseTo(490_000 + 285_000, 0);
  });

  it("includes private at 365d horizon", () => {
    const avail365 = computeAvailableLiquidity(exposures, productMappings, overrides, taxonomyDefaults, nodes, 365);
    expect(avail365).toBeCloseTo(490_000 + 285_000 + 120_000, 0);
  });

  it("excludes LOCKED tier when horizon < lockup", () => {
    const avail365 = computeAvailableLiquidity(exposures, productMappings, overrides, taxonomyDefaults, nodes, 365);
    expect(avail365).toBeCloseTo(895_000, 0);
  });

  it("reduces available liquidity for gated assets", () => {
    const gatedOverrides = new Map<string, LiquidityProfileData>([
      ["prod-gated", {
        tier: "FUND_SEMI_LIQUID",
        horizonDays: 30,
        stressedHaircutPct: 0.10,
        gateOrSuspendRisk: true,
        gatePctPerPeriod: 0.10,
        gatePeriodDays: 90,
      }],
    ]);
    const gatedExposures: ExposureInput[] = [
      { productId: "prod-gated", productName: "Gated Fund", marketValue: 100_000 },
    ];
    // At 30d: fraction = floor(30/90)*0.10 = 0 → available = 0
    const avail30 = computeAvailableLiquidity(gatedExposures, [], gatedOverrides, new Map(), nodes, 30);
    expect(avail30).toBe(0);
    // At 90d: fraction = floor(90/90)*0.10 = 0.10 → 90k * 0.10 = 9k
    const avail90 = computeAvailableLiquidity(gatedExposures, [], gatedOverrides, new Map(), nodes, 90);
    expect(avail90).toBeCloseTo(9_000);
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
    expect(result.required).toBe(70_000);
  });

  it("includes extra demand pct", () => {
    const ruleWithExtra: StressRule = { horizonDays: 30, extraCashDemandPct: 0.05, extraCashDemandAmount: 0 };
    const result = computeRequiredLiquidity(ruleWithExtra, 1_000_000, calls, null);
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

    expect(rows[0].clientId).toBe("c1");
    expect(rows[0].worstStatus).toBe("CRITICAL");
    expect(rows[1].clientId).toBe("c2");
    expect(rows[1].worstStatus).toBe("OK");
  });
});
