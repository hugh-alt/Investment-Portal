/**
 * Pure sleeve calculations for Private Markets Sleeve.
 * Client-safe (no DB imports).
 */

export type CommitmentInput = {
  fundId: string;
  fundName: string;
  currency: string;
  commitmentAmount: number;
  fundedAmount: number;
  navAmount: number;
  distributionsAmount: number;
};

export type LiquidPositionInput = {
  productId: string;
  productName: string;
  marketValue: number;
};

export type CommitmentSummary = CommitmentInput & {
  unfundedAmount: number;
};

export type CurrencyTotals = {
  currency: string;
  totalCommitment: number;
  totalFunded: number;
  totalUnfunded: number;
  totalNav: number;
  totalDistributions: number;
};

export type SleeveTotals = {
  byCurrency: CurrencyTotals[];
  liquidBucketValue: number;
  multiCurrency: boolean;
};

export function computeUnfunded(commitment: number, funded: number): number {
  return Math.max(0, commitment - funded);
}

export function computeSleeveTotals(
  commitments: CommitmentInput[],
  liquidPositions: LiquidPositionInput[],
): SleeveTotals {
  const byCurrency = groupByCurrency(commitments);
  const liquidBucketValue = liquidPositions.reduce((s, p) => s + p.marketValue, 0);
  const currencies = new Set(commitments.map((c) => c.currency));

  return {
    byCurrency,
    liquidBucketValue,
    multiCurrency: currencies.size > 1,
  };
}

export function groupByCurrency(commitments: CommitmentInput[]): CurrencyTotals[] {
  const map = new Map<string, CommitmentInput[]>();
  for (const c of commitments) {
    const group = map.get(c.currency) ?? [];
    group.push(c);
    map.set(c.currency, group);
  }

  const result: CurrencyTotals[] = [];
  for (const [currency, group] of map) {
    result.push({
      currency,
      totalCommitment: group.reduce((s, c) => s + c.commitmentAmount, 0),
      totalFunded: group.reduce((s, c) => s + c.fundedAmount, 0),
      totalUnfunded: group.reduce(
        (s, c) => s + computeUnfunded(c.commitmentAmount, c.fundedAmount),
        0,
      ),
      totalNav: group.reduce((s, c) => s + c.navAmount, 0),
      totalDistributions: group.reduce((s, c) => s + c.distributionsAmount, 0),
    });
  }

  result.sort((a, b) => a.currency.localeCompare(b.currency));
  return result;
}

export function summarizeCommitments(commitments: CommitmentInput[]): CommitmentSummary[] {
  return commitments.map((c) => ({
    ...c,
    unfundedAmount: computeUnfunded(c.commitmentAmount, c.fundedAmount),
  }));
}
