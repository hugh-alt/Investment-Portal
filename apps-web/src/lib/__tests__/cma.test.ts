import { describe, it, expect } from "vitest";
import { computeExpectedOutcomes, computeHorizonOutcomes } from "../cma";
import type { WeightInput, CMAInput } from "../cma";

describe("computeExpectedOutcomes", () => {
  it("computes weighted expected return, income, and risk proxy", () => {
    const weights: WeightInput[] = [
      { nodeId: "aus-eq", nodeName: "Australian Equities", weight: 0.4 },
      { nodeId: "intl-eq", nodeName: "International Equities", weight: 0.3 },
      { nodeId: "fi", nodeName: "Fixed Income", weight: 0.3 },
    ];
    const assumptions: CMAInput[] = [
      { nodeId: "aus-eq", expReturnPct: 0.08, volPct: 0.16, incomeYieldPct: 0.04 },
      { nodeId: "intl-eq", expReturnPct: 0.09, volPct: 0.18, incomeYieldPct: 0.02 },
      { nodeId: "fi", expReturnPct: 0.04, volPct: 0.05, incomeYieldPct: 0.035 },
    ];

    const result = computeExpectedOutcomes(weights, assumptions);

    // Expected return: 0.4*0.08 + 0.3*0.09 + 0.3*0.04 = 0.032 + 0.027 + 0.012 = 0.071
    expect(result.expectedReturnPct).toBeCloseTo(0.071, 6);
    // Risk proxy: 0.4*0.16 + 0.3*0.18 + 0.3*0.05 = 0.064 + 0.054 + 0.015 = 0.133
    expect(result.riskProxyPct).toBeCloseTo(0.133, 6);
    // Income: 0.4*0.04 + 0.3*0.02 + 0.3*0.035 = 0.016 + 0.006 + 0.0105 = 0.0325
    expect(result.expectedIncomePct).toBeCloseTo(0.0325, 6);
    expect(result.missingCoveragePct).toBe(0);
    expect(result.details).toHaveLength(3);
    expect(result.details.every((d) => d.hasCMA)).toBe(true);
  });

  it("reports missing CMA coverage for nodes without assumptions", () => {
    const weights: WeightInput[] = [
      { nodeId: "aus-eq", nodeName: "Australian Equities", weight: 0.6 },
      { nodeId: "other", nodeName: "Other", weight: 0.4 },
    ];
    const assumptions: CMAInput[] = [
      { nodeId: "aus-eq", expReturnPct: 0.08, volPct: 0.16 },
    ];

    const result = computeExpectedOutcomes(weights, assumptions);

    expect(result.expectedReturnPct).toBeCloseTo(0.048, 6);
    expect(result.riskProxyPct).toBeCloseTo(0.096, 6);
    expect(result.missingCoveragePct).toBeCloseTo(0.4, 6);
    expect(result.details[1].hasCMA).toBe(false);
  });

  it("handles empty weights", () => {
    const result = computeExpectedOutcomes(
      [],
      [{ nodeId: "aus-eq", expReturnPct: 0.08, volPct: 0.16 }],
    );

    expect(result.expectedReturnPct).toBe(0);
    expect(result.riskProxyPct).toBe(0);
    expect(result.expectedIncomePct).toBe(0);
    expect(result.missingCoveragePct).toBe(0);
    expect(result.details).toHaveLength(0);
  });

  it("handles empty assumptions — all missing", () => {
    const weights: WeightInput[] = [
      { nodeId: "aus-eq", nodeName: "Australian Equities", weight: 0.5 },
      { nodeId: "fi", nodeName: "Fixed Income", weight: 0.5 },
    ];

    const result = computeExpectedOutcomes(weights, []);

    expect(result.expectedReturnPct).toBe(0);
    expect(result.riskProxyPct).toBe(0);
    expect(result.expectedIncomePct).toBe(0);
    expect(result.missingCoveragePct).toBeCloseTo(1.0, 6);
  });

  it("works for SAA target weights", () => {
    const saaWeights: WeightInput[] = [
      { nodeId: "aus-eq", nodeName: "Australian Equities", weight: 0.30 },
      { nodeId: "intl-eq", nodeName: "International Equities", weight: 0.25 },
      { nodeId: "fi", nodeName: "Fixed Income", weight: 0.30 },
    ];
    const assumptions: CMAInput[] = [
      { nodeId: "aus-eq", expReturnPct: 0.08, volPct: 0.16 },
      { nodeId: "intl-eq", expReturnPct: 0.09, volPct: 0.18 },
      { nodeId: "fi", expReturnPct: 0.04, volPct: 0.05 },
    ];

    const result = computeExpectedOutcomes(saaWeights, assumptions);

    // 0.30*0.08 + 0.25*0.09 + 0.30*0.04 = 0.024 + 0.0225 + 0.012 = 0.0585
    expect(result.expectedReturnPct).toBeCloseTo(0.0585, 6);
    expect(result.missingCoveragePct).toBe(0);
  });

  it("treats missing incomeYieldPct as 0", () => {
    const weights: WeightInput[] = [
      { nodeId: "eq", nodeName: "Equities", weight: 1.0 },
    ];
    const assumptions: CMAInput[] = [
      { nodeId: "eq", expReturnPct: 0.08, volPct: 0.16 },
    ];

    const result = computeExpectedOutcomes(weights, assumptions);
    expect(result.expectedIncomePct).toBe(0);
  });
});

describe("sharpeProxy", () => {
  it("computes Sharpe proxy = (return - riskFree) / vol", () => {
    const weights: WeightInput[] = [
      { nodeId: "eq", nodeName: "Equities", weight: 1.0 },
    ];
    const assumptions: CMAInput[] = [
      { nodeId: "eq", expReturnPct: 0.08, volPct: 0.16 },
    ];

    const result = computeExpectedOutcomes(weights, assumptions, 0.03);

    // (0.08 - 0.03) / 0.16 = 0.3125
    expect(result.sharpeProxy).toBeCloseTo(0.3125, 4);
  });

  it("returns null when vol is 0", () => {
    const weights: WeightInput[] = [
      { nodeId: "cash", nodeName: "Cash", weight: 1.0 },
    ];
    const assumptions: CMAInput[] = [
      { nodeId: "cash", expReturnPct: 0.02, volPct: 0 },
    ];

    const result = computeExpectedOutcomes(weights, assumptions, 0.03);
    expect(result.sharpeProxy).toBeNull();
  });

  it("returns null when no weights (vol = 0)", () => {
    const result = computeExpectedOutcomes([], [], 0.03);
    expect(result.sharpeProxy).toBeNull();
  });

  it("can be negative when return < riskFree", () => {
    const weights: WeightInput[] = [
      { nodeId: "eq", nodeName: "Equities", weight: 1.0 },
    ];
    const assumptions: CMAInput[] = [
      { nodeId: "eq", expReturnPct: 0.02, volPct: 0.10 },
    ];

    const result = computeExpectedOutcomes(weights, assumptions, 0.03);
    // (0.02 - 0.03) / 0.10 = -0.1
    expect(result.sharpeProxy).toBeCloseTo(-0.1, 4);
  });

  it("defaults riskFreeRate to 0 when not provided", () => {
    const weights: WeightInput[] = [
      { nodeId: "eq", nodeName: "Equities", weight: 1.0 },
    ];
    const assumptions: CMAInput[] = [
      { nodeId: "eq", expReturnPct: 0.08, volPct: 0.16 },
    ];

    const result = computeExpectedOutcomes(weights, assumptions);
    // (0.08 - 0) / 0.16 = 0.5
    expect(result.sharpeProxy).toBeCloseTo(0.5, 4);
  });
});

describe("computeHorizonOutcomes", () => {
  it("computes compounded returns over 1, 5, 10 years", () => {
    const horizons = computeHorizonOutcomes(0.08, 0.03);

    expect(horizons).toHaveLength(3);
    expect(horizons[0].years).toBe(1);
    expect(horizons[1].years).toBe(5);
    expect(horizons[2].years).toBe(10);

    // 1yr: (1.08)^1 - 1 = 0.08
    expect(horizons[0].compoundedReturnPct).toBeCloseTo(0.08, 6);
    // 5yr: (1.08)^5 - 1 = 0.4693
    expect(horizons[1].compoundedReturnPct).toBeCloseTo(0.4693, 3);
    // 10yr: (1.08)^10 - 1 = 1.1589
    expect(horizons[2].compoundedReturnPct).toBeCloseTo(1.1589, 3);
  });

  it("computes cumulative income (simple, not compounded)", () => {
    const horizons = computeHorizonOutcomes(0.08, 0.03);

    expect(horizons[0].cumulativeIncomePct).toBeCloseTo(0.03, 6);
    expect(horizons[1].cumulativeIncomePct).toBeCloseTo(0.15, 6);
    expect(horizons[2].cumulativeIncomePct).toBeCloseTo(0.30, 6);
  });

  it("computes total return = compounded + income", () => {
    const horizons = computeHorizonOutcomes(0.08, 0.03);

    expect(horizons[0].totalReturnPct).toBeCloseTo(0.08 + 0.03, 4);
    expect(horizons[1].totalReturnPct).toBeCloseTo(0.4693 + 0.15, 3);
  });

  it("handles zero return and income", () => {
    const horizons = computeHorizonOutcomes(0, 0);
    expect(horizons[0].compoundedReturnPct).toBe(0);
    expect(horizons[0].cumulativeIncomePct).toBe(0);
    expect(horizons[0].totalReturnPct).toBe(0);
  });

  it("handles negative returns", () => {
    const horizons = computeHorizonOutcomes(-0.05, 0.02);
    // 1yr: (0.95)^1 - 1 = -0.05
    expect(horizons[0].compoundedReturnPct).toBeCloseTo(-0.05, 6);
    // 5yr: (0.95)^5 - 1 = -0.2262
    expect(horizons[1].compoundedReturnPct).toBeCloseTo(-0.2262, 3);
  });
});
