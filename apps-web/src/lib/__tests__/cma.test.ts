import { describe, it, expect } from "vitest";
import { computeExpectedOutcomes } from "../cma";
import type { WeightInput, CMAInput } from "../cma";

describe("computeExpectedOutcomes", () => {
  it("computes weighted expected return and risk proxy", () => {
    const weights: WeightInput[] = [
      { nodeId: "aus-eq", nodeName: "Australian Equities", weight: 0.4 },
      { nodeId: "intl-eq", nodeName: "International Equities", weight: 0.3 },
      { nodeId: "fi", nodeName: "Fixed Income", weight: 0.3 },
    ];
    const assumptions: CMAInput[] = [
      { nodeId: "aus-eq", expReturnPct: 0.08, volPct: 0.16 },
      { nodeId: "intl-eq", expReturnPct: 0.09, volPct: 0.18 },
      { nodeId: "fi", expReturnPct: 0.04, volPct: 0.05 },
    ];

    const result = computeExpectedOutcomes(weights, assumptions);

    // Expected return: 0.4*0.08 + 0.3*0.09 + 0.3*0.04 = 0.032 + 0.027 + 0.012 = 0.071
    expect(result.expectedReturnPct).toBeCloseTo(0.071, 6);
    // Risk proxy: 0.4*0.16 + 0.3*0.18 + 0.3*0.05 = 0.064 + 0.054 + 0.015 = 0.133
    expect(result.riskProxyPct).toBeCloseTo(0.133, 6);
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

    // Only aus-eq contributes
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
    expect(result.missingCoveragePct).toBeCloseTo(1.0, 6);
  });

  it("works for SAA target weights", () => {
    // Same function works for SAA targets
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
    // missing: weights sum to 0.85, so 0.15 is missing
    expect(result.missingCoveragePct).toBe(0);
  });
});
