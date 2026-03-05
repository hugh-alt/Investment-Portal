/**
 * Pure PM fund curve + metrics calculations.
 * Client-safe (no DB imports).
 */

export type CurvePoint = { month: string; cumPct: number };

export type FundMetrics = {
  unfunded: number;
  pctCalled: number;
  dpi: number | null;
  rvpi: number | null;
  tvpi: number | null;
};

export type IncrementalPoint = { month: string; incrementalPct: number };

/**
 * Validate that cumPct values are monotonically non-decreasing and within [0, 1].
 */
export function validateMonotonicCumPct(
  curve: CurvePoint[],
): { valid: true } | { valid: false; error: string } {
  for (let i = 0; i < curve.length; i++) {
    const p = curve[i];
    if (p.cumPct < 0 || p.cumPct > 1) {
      return { valid: false, error: `Point ${i + 1} (${p.month}): cumPct ${p.cumPct} must be between 0 and 1` };
    }
    if (i > 0 && p.cumPct < curve[i - 1].cumPct) {
      return {
        valid: false,
        error: `Point ${i + 1} (${p.month}): cumPct ${p.cumPct} is less than previous ${curve[i - 1].cumPct}`,
      };
    }
  }
  return { valid: true };
}

/**
 * Convert cumulative % curve to incremental % per month.
 */
export function curveCumToIncremental(curve: CurvePoint[]): IncrementalPoint[] {
  return curve.map((p, i) => ({
    month: p.month,
    incrementalPct: i === 0 ? p.cumPct : p.cumPct - curve[i - 1].cumPct,
  }));
}

/**
 * Scale incremental % points to dollar amounts for a given commitment.
 */
export function scaleIncrementalPctToDollars(
  incremental: IncrementalPoint[],
  commitmentAmount: number,
): { month: string; amount: number }[] {
  return incremental.map((p) => ({
    month: p.month,
    amount: Math.round(p.incrementalPct * commitmentAmount),
  }));
}

/**
 * Compute fund-level metrics from today's snapshot values.
 * Returns null for ratios when paidIn is 0 (division by zero).
 */
export function computeFundMetrics(
  paidIn: number,
  nav: number,
  distributions: number,
  commitment: number,
): FundMetrics {
  return {
    unfunded: Math.max(0, commitment - paidIn),
    pctCalled: commitment > 0 ? paidIn / commitment : 0,
    dpi: paidIn > 0 ? distributions / paidIn : null,
    rvpi: paidIn > 0 ? nav / paidIn : null,
    tvpi: paidIn > 0 ? (nav + distributions) / paidIn : null,
  };
}
