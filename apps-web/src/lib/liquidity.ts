/**
 * Pure liquidity buffer calculations for PM Sleeve.
 * Client-safe (no DB imports).
 */

export type BufferConfig = {
  bufferMethod: "VS_UNFUNDED_PCT" | "VS_PROJECTED_CALLS";
  bufferPctOfUnfunded: number; // 0–1
  bufferMonthsForward: number;
};

export type CurrencyUnfunded = {
  currency: string;
  totalUnfunded: number;
};

export type ProjectedCall = {
  currency: string;
  month: string;
  amount: number;
};

export type CurrencyRequirement = {
  currency: string;
  requiredLiquidity: number;
};

export type LiquidityAssessment = {
  requirements: CurrencyRequirement[];
  liquidBucketValue: number;
  portfolioCurrency: string;
  totalRequired: number; // portfolio-currency only
  shortfall: number; // max(0, totalRequired - liquidBucket)
  severity: "OK" | "WARN" | "CRITICAL";
  nonCoveredCurrencies: string[]; // currencies other than portfolio currency
};

/**
 * Compute required liquidity per currency using VS_UNFUNDED_PCT method.
 * required = unfunded * bufferPctOfUnfunded
 */
export function computeRequiredVsUnfunded(
  unfundedByCurrency: CurrencyUnfunded[],
  bufferPctOfUnfunded: number,
): CurrencyRequirement[] {
  return unfundedByCurrency.map((u) => ({
    currency: u.currency,
    requiredLiquidity: Math.round(u.totalUnfunded * bufferPctOfUnfunded),
  }));
}

/**
 * Compute required liquidity per currency using VS_PROJECTED_CALLS method.
 * required = sum of projected calls over next N months
 */
export function computeRequiredVsProjectedCalls(
  projectedCalls: ProjectedCall[],
  monthsForward: number,
): CurrencyRequirement[] {
  // Get the first N months from all calls
  const allMonths = [...new Set(projectedCalls.map((c) => c.month))].sort();
  const relevantMonths = new Set(allMonths.slice(0, monthsForward));

  const byCurrency = new Map<string, number>();
  for (const call of projectedCalls) {
    if (!relevantMonths.has(call.month)) continue;
    byCurrency.set(call.currency, (byCurrency.get(call.currency) ?? 0) + call.amount);
  }

  return Array.from(byCurrency, ([currency, requiredLiquidity]) => ({
    currency,
    requiredLiquidity: Math.round(requiredLiquidity),
  })).sort((a, b) => a.currency.localeCompare(b.currency));
}

/**
 * Assess liquidity health for a sleeve.
 * The liquid bucket is in portfolio currency (AUD assumed).
 * Non-portfolio currencies have no liquid coverage and are flagged.
 */
export function assessLiquidity(
  requirements: CurrencyRequirement[],
  liquidBucketValue: number,
  portfolioCurrency: string = "AUD",
): LiquidityAssessment {
  const portfolioReq = requirements.find((r) => r.currency === portfolioCurrency);
  const totalRequired = portfolioReq?.requiredLiquidity ?? 0;
  const shortfall = Math.max(0, totalRequired - liquidBucketValue);
  const nonCoveredCurrencies = requirements
    .filter((r) => r.currency !== portfolioCurrency && r.requiredLiquidity > 0)
    .map((r) => r.currency);

  let severity: "OK" | "WARN" | "CRITICAL";
  if (shortfall === 0) {
    severity = "OK";
  } else if (totalRequired > 0 && shortfall / totalRequired <= 0.25) {
    severity = "WARN";
  } else {
    severity = "CRITICAL";
  }

  return {
    requirements,
    liquidBucketValue,
    portfolioCurrency,
    totalRequired,
    shortfall,
    severity,
    nonCoveredCurrencies,
  };
}

/**
 * Generate an alert message for a liquidity shortfall.
 */
export function buildAlertMessage(assessment: LiquidityAssessment): string {
  if (assessment.severity === "OK") return "Liquidity sufficient";
  const shortfallPct = assessment.totalRequired > 0
    ? ((assessment.shortfall / assessment.totalRequired) * 100).toFixed(0)
    : "0";
  return `Liquidity shortfall of $${assessment.shortfall.toLocaleString()} (${shortfallPct}% of required $${assessment.totalRequired.toLocaleString()}) in ${assessment.portfolioCurrency}`;
}
