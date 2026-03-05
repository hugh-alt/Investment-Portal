import { describe, it, expect } from "vitest";
import {
  computeRequiredVsUnfunded,
  computeRequiredVsProjectedCalls,
  assessLiquidity,
  buildAlertMessage,
} from "../liquidity";

describe("computeRequiredVsUnfunded", () => {
  it("computes required as unfunded * pct", () => {
    const result = computeRequiredVsUnfunded(
      [{ currency: "AUD", totalUnfunded: 500000 }],
      0.10,
    );
    expect(result).toEqual([{ currency: "AUD", requiredLiquidity: 50000 }]);
  });

  it("handles multiple currencies", () => {
    const result = computeRequiredVsUnfunded(
      [
        { currency: "AUD", totalUnfunded: 300000 },
        { currency: "USD", totalUnfunded: 200000 },
      ],
      0.15,
    );
    expect(result).toEqual([
      { currency: "AUD", requiredLiquidity: 45000 },
      { currency: "USD", requiredLiquidity: 30000 },
    ]);
  });

  it("returns 0 when unfunded is 0", () => {
    const result = computeRequiredVsUnfunded(
      [{ currency: "AUD", totalUnfunded: 0 }],
      0.10,
    );
    expect(result).toEqual([{ currency: "AUD", requiredLiquidity: 0 }]);
  });
});

describe("computeRequiredVsProjectedCalls", () => {
  it("sums calls over the first N months", () => {
    const calls = [
      { currency: "AUD", month: "2026-04", amount: 10000 },
      { currency: "AUD", month: "2026-05", amount: 15000 },
      { currency: "AUD", month: "2026-06", amount: 20000 },
      { currency: "AUD", month: "2026-07", amount: 25000 },
    ];
    const result = computeRequiredVsProjectedCalls(calls, 3);
    expect(result).toEqual([{ currency: "AUD", requiredLiquidity: 45000 }]);
  });

  it("handles multiple currencies", () => {
    const calls = [
      { currency: "AUD", month: "2026-04", amount: 10000 },
      { currency: "USD", month: "2026-04", amount: 5000 },
      { currency: "AUD", month: "2026-05", amount: 12000 },
      { currency: "USD", month: "2026-05", amount: 6000 },
    ];
    const result = computeRequiredVsProjectedCalls(calls, 2);
    expect(result).toEqual([
      { currency: "AUD", requiredLiquidity: 22000 },
      { currency: "USD", requiredLiquidity: 11000 },
    ]);
  });

  it("returns empty array when no calls", () => {
    expect(computeRequiredVsProjectedCalls([], 6)).toEqual([]);
  });
});

describe("assessLiquidity", () => {
  it("returns OK when liquid bucket covers required", () => {
    const result = assessLiquidity(
      [{ currency: "AUD", requiredLiquidity: 50000 }],
      60000,
    );
    expect(result.severity).toBe("OK");
    expect(result.shortfall).toBe(0);
  });

  it("returns WARN when shortfall <= 25% of required", () => {
    // required=100k, liquid=80k, shortfall=20k, 20% of required
    const result = assessLiquidity(
      [{ currency: "AUD", requiredLiquidity: 100000 }],
      80000,
    );
    expect(result.severity).toBe("WARN");
    expect(result.shortfall).toBe(20000);
  });

  it("returns CRITICAL when shortfall > 25% of required", () => {
    // required=100k, liquid=50k, shortfall=50k, 50% of required
    const result = assessLiquidity(
      [{ currency: "AUD", requiredLiquidity: 100000 }],
      50000,
    );
    expect(result.severity).toBe("CRITICAL");
    expect(result.shortfall).toBe(50000);
  });

  it("flags non-portfolio currencies as uncovered", () => {
    const result = assessLiquidity(
      [
        { currency: "AUD", requiredLiquidity: 30000 },
        { currency: "USD", requiredLiquidity: 20000 },
      ],
      60000,
    );
    expect(result.severity).toBe("OK");
    expect(result.nonCoveredCurrencies).toEqual(["USD"]);
  });

  it("ignores non-portfolio currency requirements for severity", () => {
    // AUD covered, USD not — but severity based on AUD only
    const result = assessLiquidity(
      [
        { currency: "AUD", requiredLiquidity: 10000 },
        { currency: "USD", requiredLiquidity: 50000 },
      ],
      15000,
    );
    expect(result.severity).toBe("OK");
    expect(result.totalRequired).toBe(10000);
    expect(result.nonCoveredCurrencies).toEqual(["USD"]);
  });

  it("returns OK when no requirements", () => {
    const result = assessLiquidity([], 60000);
    expect(result.severity).toBe("OK");
    expect(result.shortfall).toBe(0);
  });
});

describe("buildAlertMessage", () => {
  it("returns sufficient for OK", () => {
    const assessment = assessLiquidity(
      [{ currency: "AUD", requiredLiquidity: 50000 }],
      60000,
    );
    expect(buildAlertMessage(assessment)).toBe("Liquidity sufficient");
  });

  it("includes shortfall details for WARN/CRITICAL", () => {
    const assessment = assessLiquidity(
      [{ currency: "AUD", requiredLiquidity: 100000 }],
      80000,
    );
    const msg = buildAlertMessage(assessment);
    expect(msg).toContain("$20,000");
    expect(msg).toContain("20%");
    expect(msg).toContain("AUD");
  });
});
