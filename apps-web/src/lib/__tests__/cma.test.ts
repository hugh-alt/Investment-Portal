import { describe, it, expect } from "vitest";
import {
  computeExpectedOutcomes,
  computeHorizonOutcomes,
  buildCorrelationMatrix,
  validateCorrelationMatrix,
  computePortfolioVol,
  computeEigenvalues,
  repairToNearestPSD,
  generateTypicalCorrelations,
} from "../cma";
import type { WeightInput, CMAInput, CorrelationEntry } from "../cma";

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

describe("buildCorrelationMatrix", () => {
  it("builds matrix with diagonal = 1 and symmetric entries", () => {
    const nodeIds = ["A", "B"];
    const entries: CorrelationEntry[] = [{ nodeIdA: "A", nodeIdB: "B", corr: 0.5 }];
    const m = buildCorrelationMatrix(nodeIds, entries);

    expect(m[0][0]).toBe(1.0);
    expect(m[1][1]).toBe(1.0);
    expect(m[0][1]).toBe(0.5);
    expect(m[1][0]).toBe(0.5); // symmetric
  });

  it("defaults missing pairs to 0", () => {
    const nodeIds = ["A", "B", "C"];
    const entries: CorrelationEntry[] = [{ nodeIdA: "A", nodeIdB: "B", corr: 0.3 }];
    const m = buildCorrelationMatrix(nodeIds, entries);

    expect(m[0][2]).toBe(0); // A-C missing → 0
    expect(m[1][2]).toBe(0); // B-C missing → 0
  });
});

describe("validateCorrelationMatrix", () => {
  it("passes for identity matrix", () => {
    const identity = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const v = validateCorrelationMatrix(identity);
    expect(v.isSymmetric).toBe(true);
    expect(v.isPSD).toBe(true);
    expect(v.errors).toHaveLength(0);
  });

  it("passes for valid PSD correlation matrix", () => {
    const m = [
      [1.0, 0.5],
      [0.5, 1.0],
    ];
    const v = validateCorrelationMatrix(m);
    expect(v.isSymmetric).toBe(true);
    expect(v.isPSD).toBe(true);
    expect(v.eigenvalues).toHaveLength(2);
    expect(v.eigenvalues[0]).toBeCloseTo(1.5, 4);
    expect(v.eigenvalues[1]).toBeCloseTo(0.5, 4);
  });

  it("detects non-PSD matrix", () => {
    // This matrix has eigenvalues 1+0.9+0.9=? Let's construct a known non-PSD one
    // For 2x2: [[1, 1.5], [1.5, 1]] → eigenvalues 2.5 and -0.5
    const m = [
      [1.0, 1.5],
      [1.5, 1.0],
    ];
    const v = validateCorrelationMatrix(m);
    expect(v.isPSD).toBe(false);
    expect(v.errors.length).toBeGreaterThan(0);
  });

  it("detects asymmetric matrix", () => {
    const m = [
      [1.0, 0.3],
      [0.5, 1.0],
    ];
    const v = validateCorrelationMatrix(m);
    expect(v.isSymmetric).toBe(false);
  });

  it("reports coverage percentage", () => {
    // 3x3 with only 1 of 3 off-diagonal pairs filled
    const nodeIds = ["A", "B", "C"];
    const entries: CorrelationEntry[] = [{ nodeIdA: "A", nodeIdB: "B", corr: 0.5 }];
    const m = buildCorrelationMatrix(nodeIds, entries);
    const v = validateCorrelationMatrix(m);
    expect(v.coveragePct).toBeCloseTo(1 / 3, 4);
  });
});

describe("computeEigenvalues", () => {
  it("returns correct eigenvalues for 2x2", () => {
    const m = [
      [1.0, 0.6],
      [0.6, 1.0],
    ];
    const ev = computeEigenvalues(m);
    expect(ev).toHaveLength(2);
    expect(ev[0]).toBeCloseTo(1.6, 4); // 1 + 0.6
    expect(ev[1]).toBeCloseTo(0.4, 4); // 1 - 0.6
  });

  it("handles 1x1 matrix", () => {
    expect(computeEigenvalues([[1.0]])).toEqual([1.0]);
  });

  it("handles empty matrix", () => {
    expect(computeEigenvalues([])).toEqual([]);
  });
});

describe("computePortfolioVol", () => {
  it("computes 2-asset portfolio vol with known correlation", () => {
    // 50/50 split, vol 16% and 5%, corr 0.3
    const weights = [0.5, 0.5];
    const vols = [0.16, 0.05];
    const corr = [
      [1.0, 0.3],
      [0.3, 1.0],
    ];
    // var = 0.25*0.0256 + 0.25*0.0025 + 2*0.25*0.16*0.05*0.3
    //     = 0.0064 + 0.000625 + 0.0012
    //     = 0.008225
    // vol = sqrt(0.008225) ≈ 0.09069
    const vol = computePortfolioVol(weights, vols, corr);
    expect(vol).toBeCloseTo(0.09069, 4);
  });

  it("with perfect correlation, vol equals weighted sum", () => {
    const weights = [0.6, 0.4];
    const vols = [0.16, 0.05];
    const corr = [
      [1.0, 1.0],
      [1.0, 1.0],
    ];
    // perfect corr → vol = w1*v1 + w2*v2 = 0.096 + 0.02 = 0.116
    const vol = computePortfolioVol(weights, vols, corr);
    expect(vol).toBeCloseTo(0.116, 6);
  });

  it("with zero correlation, vol is sqrt of sum of squared weighted vols", () => {
    const weights = [0.5, 0.5];
    const vols = [0.16, 0.05];
    const corr = [
      [1.0, 0.0],
      [0.0, 1.0],
    ];
    // var = 0.25*0.0256 + 0.25*0.0025 = 0.007025
    // vol = sqrt(0.007025) ≈ 0.08381
    const vol = computePortfolioVol(weights, vols, corr);
    expect(vol).toBeCloseTo(0.08381, 4);
  });
});

describe("computeExpectedOutcomes with correlations", () => {
  const weights: WeightInput[] = [
    { nodeId: "eq", nodeName: "Equities", weight: 0.6 },
    { nodeId: "fi", nodeName: "Fixed Income", weight: 0.4 },
  ];
  const assumptions: CMAInput[] = [
    { nodeId: "eq", expReturnPct: 0.08, volPct: 0.16 },
    { nodeId: "fi", expReturnPct: 0.04, volPct: 0.05 },
  ];
  const corrs: CorrelationEntry[] = [{ nodeIdA: "eq", nodeIdB: "fi", corr: 0.3 }];

  it("uses correlation-based vol and computes Sharpe with it", () => {
    const result = computeExpectedOutcomes(weights, assumptions, 0.03, corrs);

    expect(result.portfolioVolPct).not.toBeNull();
    expect(result.portfolioVolPct!).toBeLessThan(result.riskProxyPct); // diversification benefit
    expect(result.correlationWarning).toBeNull();
    // Sharpe should use portfolioVol
    expect(result.sharpeProxy).toBeCloseTo(
      (result.expectedReturnPct - 0.03) / result.portfolioVolPct!,
      4,
    );
  });

  it("falls back to riskProxy when no correlations provided", () => {
    const result = computeExpectedOutcomes(weights, assumptions, 0.03);
    expect(result.portfolioVolPct).toBeNull();
    expect(result.correlationWarning).toBeNull();
    expect(result.sharpeProxy).toBeCloseTo(
      (result.expectedReturnPct - 0.03) / result.riskProxyPct,
      4,
    );
  });
});

describe("repairToNearestPSD", () => {
  it("repairs a non-PSD matrix to be PSD", () => {
    const nonPsd = [
      [1.0, 0.9, 0.9],
      [0.9, 1.0, -0.9],
      [0.9, -0.9, 1.0],
    ];
    const v1 = validateCorrelationMatrix(nonPsd);
    expect(v1.isPSD).toBe(false);

    const repaired = repairToNearestPSD(nonPsd);
    const v2 = validateCorrelationMatrix(repaired);
    expect(v2.isPSD).toBe(true);
    // Diagonal should remain 1.0
    expect(repaired[0][0]).toBeCloseTo(1.0, 4);
    expect(repaired[1][1]).toBeCloseTo(1.0, 4);
    expect(repaired[2][2]).toBeCloseTo(1.0, 4);
  });
});

describe("generateTypicalCorrelations", () => {
  it("generates higher correlation for equity-equity pairs", () => {
    const ids = ["eq1", "eq2", "fi"];
    const names = ["Australian Equities", "International Equities", "Fixed Income"];
    const entries = generateTypicalCorrelations(ids, names);

    const eqEq = entries.find((e) => e.nodeIdA === "eq1" && e.nodeIdB === "eq2");
    const eqFi = entries.find((e) => e.nodeIdA === "eq1" && e.nodeIdB === "fi");

    expect(eqEq?.corr).toBe(0.75);
    expect(eqFi?.corr).toBe(0.15);
  });
});
