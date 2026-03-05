import { describe, it, expect } from "vitest";
import {
  validateMonotonicCumPct,
  curveCumToIncremental,
  scaleIncrementalPctToDollars,
  computeFundMetrics,
  type CurvePoint,
} from "../pm-curves";

describe("validateMonotonicCumPct", () => {
  it("accepts valid monotonic curve", () => {
    const curve: CurvePoint[] = [
      { month: "2026-04", cumPct: 0.05 },
      { month: "2026-05", cumPct: 0.10 },
      { month: "2026-06", cumPct: 0.10 },
      { month: "2026-07", cumPct: 0.20 },
    ];
    expect(validateMonotonicCumPct(curve)).toEqual({ valid: true });
  });

  it("accepts empty curve", () => {
    expect(validateMonotonicCumPct([])).toEqual({ valid: true });
  });

  it("rejects decreasing cumPct", () => {
    const curve: CurvePoint[] = [
      { month: "2026-04", cumPct: 0.10 },
      { month: "2026-05", cumPct: 0.05 },
    ];
    const result = validateMonotonicCumPct(curve);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("less than previous");
    }
  });

  it("rejects cumPct > 1", () => {
    const curve: CurvePoint[] = [{ month: "2026-04", cumPct: 1.1 }];
    const result = validateMonotonicCumPct(curve);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("must be between 0 and 1");
    }
  });

  it("rejects cumPct < 0", () => {
    const curve: CurvePoint[] = [{ month: "2026-04", cumPct: -0.1 }];
    const result = validateMonotonicCumPct(curve);
    expect(result.valid).toBe(false);
  });
});

describe("curveCumToIncremental", () => {
  it("converts cumulative to incremental percentages", () => {
    const curve: CurvePoint[] = [
      { month: "2026-04", cumPct: 0.10 },
      { month: "2026-05", cumPct: 0.25 },
      { month: "2026-06", cumPct: 0.25 },
      { month: "2026-07", cumPct: 0.40 },
    ];
    const inc = curveCumToIncremental(curve);
    expect(inc).toHaveLength(4);
    expect(inc[0]).toEqual({ month: "2026-04", incrementalPct: 0.10 });
    expect(inc[1].month).toBe("2026-05");
    expect(inc[1].incrementalPct).toBeCloseTo(0.15);
    expect(inc[2].incrementalPct).toBeCloseTo(0);
    expect(inc[3].incrementalPct).toBeCloseTo(0.15);
  });

  it("handles empty curve", () => {
    expect(curveCumToIncremental([])).toEqual([]);
  });
});

describe("scaleIncrementalPctToDollars", () => {
  it("scales incremental pcts to dollar amounts (rounded)", () => {
    const inc = [
      { month: "2026-04", incrementalPct: 0.10 },
      { month: "2026-05", incrementalPct: 0.15 },
    ];
    const result = scaleIncrementalPctToDollars(inc, 500000);
    expect(result).toEqual([
      { month: "2026-04", amount: 50000 },
      { month: "2026-05", amount: 75000 },
    ]);
  });

  it("rounds to nearest dollar", () => {
    const inc = [{ month: "2026-04", incrementalPct: 0.033 }];
    const result = scaleIncrementalPctToDollars(inc, 100000);
    expect(result[0].amount).toBe(3300);
  });
});

describe("computeFundMetrics", () => {
  it("computes all metrics correctly", () => {
    const m = computeFundMetrics(200000, 220000, 10000, 500000);
    expect(m.unfunded).toBe(300000);
    expect(m.pctCalled).toBeCloseTo(0.4);
    expect(m.dpi).toBeCloseTo(0.05);
    expect(m.rvpi).toBeCloseTo(1.1);
    expect(m.tvpi).toBeCloseTo(1.15);
  });

  it("returns null ratios when paidIn is 0", () => {
    const m = computeFundMetrics(0, 0, 0, 500000);
    expect(m.unfunded).toBe(500000);
    expect(m.pctCalled).toBe(0);
    expect(m.dpi).toBeNull();
    expect(m.rvpi).toBeNull();
    expect(m.tvpi).toBeNull();
  });

  it("clamps unfunded to 0 when overfunded", () => {
    const m = computeFundMetrics(600000, 650000, 50000, 500000);
    expect(m.unfunded).toBe(0);
  });

  it("handles zero commitment", () => {
    const m = computeFundMetrics(0, 0, 0, 0);
    expect(m.pctCalled).toBe(0);
    expect(m.unfunded).toBe(0);
  });
});
