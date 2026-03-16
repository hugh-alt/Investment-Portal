/**
 * Pure CMA (Capital Market Assumptions) calculations.
 * Client-safe (no DB imports).
 *
 * Expected return = sum(weight(i) * expReturn(i))
 * Expected income = sum(weight(i) * incomeYieldPct(i))
 * Risk proxy (v1) = sum(weight(i) * vol(i))  — weighted average vol, no correlations
 * Sharpe proxy = (expReturn - riskFreeRate) / riskProxy  (guard vol==0)
 */

export type CMAInput = {
  nodeId: string;
  expReturnPct: number; // 0–1 (e.g. 0.08 for 8%)
  volPct: number;       // 0–1 (e.g. 0.15 for 15%)
  incomeYieldPct?: number; // 0–1 (e.g. 0.04 for 4%)
};

export type WeightInput = {
  nodeId: string;
  nodeName: string;
  weight: number; // 0–1
};

export type CMADetailRow = {
  nodeId: string;
  nodeName: string;
  weight: number;
  expReturnPct: number;
  volPct: number;
  incomeYieldPct: number;
  returnContribution: number; // weight * expReturn
  volContribution: number;    // weight * vol
  incomeContribution: number; // weight * incomeYield
  hasCMA: boolean;
};

export type CMAResult = {
  expectedReturnPct: number;
  expectedIncomePct: number;
  riskProxyPct: number;
  sharpeProxy: number | null; // null when vol == 0
  details: CMADetailRow[];
  missingCoveragePct: number; // weight of nodes without CMA assumptions
};

export type HorizonOutcome = {
  years: number;
  compoundedReturnPct: number;   // (1 + expReturn)^h - 1
  cumulativeIncomePct: number;   // expIncome * h (simple, no reinvestment)
  totalReturnPct: number;        // compounded + cumulative income
};

export function computeExpectedOutcomes(
  weights: WeightInput[],
  assumptions: CMAInput[],
  riskFreeRatePct: number = 0,
): CMAResult {
  const cmaMap = new Map<string, CMAInput>();
  for (const a of assumptions) {
    cmaMap.set(a.nodeId, a);
  }

  const details: CMADetailRow[] = [];
  let missingWeight = 0;

  for (const w of weights) {
    const cma = cmaMap.get(w.nodeId);
    if (cma) {
      const income = cma.incomeYieldPct ?? 0;
      details.push({
        nodeId: w.nodeId,
        nodeName: w.nodeName,
        weight: w.weight,
        expReturnPct: cma.expReturnPct,
        volPct: cma.volPct,
        incomeYieldPct: income,
        returnContribution: w.weight * cma.expReturnPct,
        volContribution: w.weight * cma.volPct,
        incomeContribution: w.weight * income,
        hasCMA: true,
      });
    } else {
      missingWeight += w.weight;
      details.push({
        nodeId: w.nodeId,
        nodeName: w.nodeName,
        weight: w.weight,
        expReturnPct: 0,
        volPct: 0,
        incomeYieldPct: 0,
        returnContribution: 0,
        volContribution: 0,
        incomeContribution: 0,
        hasCMA: false,
      });
    }
  }

  const expectedReturnPct = details.reduce((s, d) => s + d.returnContribution, 0);
  const expectedIncomePct = details.reduce((s, d) => s + d.incomeContribution, 0);
  const riskProxyPct = details.reduce((s, d) => s + d.volContribution, 0);

  let sharpeProxy: number | null = null;
  if (riskProxyPct > 0) {
    sharpeProxy = (expectedReturnPct - riskFreeRatePct) / riskProxyPct;
  }

  return {
    expectedReturnPct,
    expectedIncomePct,
    riskProxyPct,
    sharpeProxy,
    details,
    missingCoveragePct: missingWeight,
  };
}

/**
 * Compute horizon outcomes for 1, 5, and 10 year periods.
 * Returns illustrative compounded returns and cumulative income.
 */
export function computeHorizonOutcomes(
  annualReturn: number,
  annualIncome: number,
): HorizonOutcome[] {
  return [1, 5, 10].map((years) => {
    const compoundedReturnPct = Math.pow(1 + annualReturn, years) - 1;
    const cumulativeIncomePct = annualIncome * years;
    return {
      years,
      compoundedReturnPct,
      cumulativeIncomePct,
      totalReturnPct: compoundedReturnPct + cumulativeIncomePct,
    };
  });
}
