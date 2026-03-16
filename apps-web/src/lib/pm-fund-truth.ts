/**
 * PM Fund Truth Layer — pure business logic.
 * Allocation math, call derivation, formatting helpers.
 */

// ── Formatting ──────────────────────────────────────────

/** Format a number to exactly 4 decimal places. */
export function fmt4dp(v: number): string {
  return v.toFixed(4);
}

/** Format NAV/KPI with currency prefix and 4dp. */
export function fmtNav(v: number, currency: string): string {
  return `${currency} ${v.toLocaleString("en-AU", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
}

/** Format a percentage (0..1) as "X.XX%". */
export function fmtPct(v: number): string {
  return (v * 100).toFixed(2) + "%";
}

// ── Call Derivation ─────────────────────────────────────

/** Derive client call amount from callPct and commitment. */
export function deriveCallAmount(callPct: number, commitmentAmount: number): number {
  return Math.round(commitmentAmount * callPct * 100) / 100;
}

// ── Distribution Allocation ─────────────────────────────

export type CommitmentForAllocation = {
  id: string;
  commitmentAmount: number;
  fundedAmount: number;
};

export type AllocationResult = {
  commitmentId: string;
  amount: number;
  pctOfCommitment: number;
};

/**
 * Compute pro-rata distribution allocations.
 * basis = "PRO_RATA_COMMITMENT": weight by commitmentAmount
 * basis = "PRO_RATA_PAIDIN": weight by fundedAmount (paid-in capital)
 *
 * Rounding: allocations are rounded to 2dp, remainder goes to largest allocation.
 * Guarantees: sum(allocations) === totalAmount.
 */
export function computeDistributionAllocations(
  totalAmount: number,
  commitments: CommitmentForAllocation[],
  basis: "PRO_RATA_COMMITMENT" | "PRO_RATA_PAIDIN",
): AllocationResult[] {
  if (commitments.length === 0) return [];

  const weights = commitments.map((c) =>
    basis === "PRO_RATA_COMMITMENT" ? c.commitmentAmount : c.fundedAmount,
  );
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  if (totalWeight === 0) {
    // Equal split if all weights are 0
    const equalShare = Math.round((totalAmount / commitments.length) * 100) / 100;
    const results: AllocationResult[] = commitments.map((c) => ({
      commitmentId: c.id,
      amount: equalShare,
      pctOfCommitment: c.commitmentAmount > 0 ? equalShare / c.commitmentAmount : 0,
    }));
    // Fix rounding
    const sum = results.reduce((s, r) => s + r.amount, 0);
    const diff = Math.round((totalAmount - sum) * 100) / 100;
    if (diff !== 0 && results.length > 0) {
      results[0].amount = Math.round((results[0].amount + diff) * 100) / 100;
    }
    return results;
  }

  // Compute raw allocations
  const rawAllocations = weights.map((w) => (totalAmount * w) / totalWeight);

  // Round to 2dp
  const rounded = rawAllocations.map((a) => Math.round(a * 100) / 100);
  const roundedSum = rounded.reduce((s, a) => s + a, 0);
  const remainder = Math.round((totalAmount - roundedSum) * 100) / 100;

  // Put remainder on largest allocation
  if (remainder !== 0) {
    let maxIdx = 0;
    for (let i = 1; i < rounded.length; i++) {
      if (rounded[i] > rounded[maxIdx]) maxIdx = i;
    }
    rounded[maxIdx] = Math.round((rounded[maxIdx] + remainder) * 100) / 100;
  }

  return commitments.map((c, i) => ({
    commitmentId: c.id,
    amount: rounded[i],
    pctOfCommitment: c.commitmentAmount > 0 ? rounded[i] / c.commitmentAmount : 0,
  }));
}
