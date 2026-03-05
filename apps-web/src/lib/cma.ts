/**
 * Pure CMA (Capital Market Assumptions) calculations.
 * Client-safe (no DB imports).
 *
 * Expected return = sum(weight(i) * expReturn(i))
 * Risk proxy (v1) = sum(weight(i) * vol(i))  — weighted average vol, no correlations
 */

export type CMAInput = {
  nodeId: string;
  expReturnPct: number; // 0–1 (e.g. 0.08 for 8%)
  volPct: number;       // 0–1 (e.g. 0.15 for 15%)
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
  returnContribution: number; // weight * expReturn
  volContribution: number;    // weight * vol
  hasCMA: boolean;
};

export type CMAResult = {
  expectedReturnPct: number;
  riskProxyPct: number;
  details: CMADetailRow[];
  missingCoveragePct: number; // weight of nodes without CMA assumptions
};

export function computeExpectedOutcomes(
  weights: WeightInput[],
  assumptions: CMAInput[],
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
      details.push({
        nodeId: w.nodeId,
        nodeName: w.nodeName,
        weight: w.weight,
        expReturnPct: cma.expReturnPct,
        volPct: cma.volPct,
        returnContribution: w.weight * cma.expReturnPct,
        volContribution: w.weight * cma.volPct,
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
        returnContribution: 0,
        volContribution: 0,
        hasCMA: false,
      });
    }
  }

  const expectedReturnPct = details.reduce((s, d) => s + d.returnContribution, 0);
  const riskProxyPct = details.reduce((s, d) => s + d.volContribution, 0);

  return {
    expectedReturnPct,
    riskProxyPct,
    details,
    missingCoveragePct: missingWeight,
  };
}
