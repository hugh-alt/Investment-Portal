/**
 * Pure CMA (Capital Market Assumptions) calculations.
 * Client-safe (no DB imports).
 *
 * Expected return = sum(weight(i) * expReturn(i))
 * Expected income = sum(weight(i) * incomeYieldPct(i))
 * Risk proxy (v1) = sum(weight(i) * vol(i))  — weighted average vol, no correlations
 * Portfolio vol (v2) = sqrt(w^T * Cov * w) where Cov = diag(vol) * Corr * diag(vol)
 * Sharpe proxy = (expReturn - riskFreeRate) / vol  (guard vol==0)
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
  portfolioVolPct: number | null; // correlation-based vol; null if correlations missing
  sharpeProxy: number | null; // null when vol == 0
  details: CMADetailRow[];
  missingCoveragePct: number; // weight of nodes without CMA assumptions
  correlationWarning: string | null; // warning if correlations incomplete or not PSD
};

// ── Correlation matrix types ──

export type CorrelationEntry = {
  nodeIdA: string;
  nodeIdB: string;
  corr: number;
};

export type CorrelationValidation = {
  isSymmetric: boolean;
  isPSD: boolean;
  coveragePct: number; // 0–1: fraction of pairs filled
  eigenvalues: number[];
  errors: string[];
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
  correlations?: CorrelationEntry[],
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

  // Attempt correlation-based portfolio vol
  let portfolioVolPct: number | null = null;
  let correlationWarning: string | null = null;

  if (correlations && correlations.length > 0) {
    const nodesWithWeights = details.filter((d) => d.hasCMA && d.weight > 0);
    const nodeIds = nodesWithWeights.map((d) => d.nodeId);
    const w = nodesWithWeights.map((d) => d.weight);
    const vols = nodesWithWeights.map((d) => d.volPct);

    const corrMatrix = buildCorrelationMatrix(nodeIds, correlations);
    const validation = validateCorrelationMatrix(corrMatrix);

    if (!validation.isPSD) {
      correlationWarning = "Correlation matrix is not positive semi-definite. Using weighted-average risk proxy.";
    } else if (validation.coveragePct < 1) {
      correlationWarning = `Incomplete correlation coverage (${(validation.coveragePct * 100).toFixed(0)}%). Missing pairs default to 0.`;
      portfolioVolPct = computePortfolioVol(w, vols, corrMatrix);
    } else {
      portfolioVolPct = computePortfolioVol(w, vols, corrMatrix);
    }
  }

  // Use portfolio vol for Sharpe if available, otherwise fall back to risk proxy
  const effectiveVol = portfolioVolPct ?? riskProxyPct;
  let sharpeProxy: number | null = null;
  if (effectiveVol > 0) {
    sharpeProxy = (expectedReturnPct - riskFreeRatePct) / effectiveVol;
  }

  return {
    expectedReturnPct,
    expectedIncomePct,
    riskProxyPct,
    portfolioVolPct,
    sharpeProxy,
    details,
    missingCoveragePct: missingWeight,
    correlationWarning,
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

// ── Correlation matrix functions ──

/**
 * Build an NxN correlation matrix from sparse entries.
 * Diagonal is always 1.0. Missing off-diagonal pairs default to 0.
 * Enforces symmetry: stores max(corr[A,B], corr[B,A]) for both directions.
 */
export function buildCorrelationMatrix(
  nodeIds: string[],
  entries: CorrelationEntry[],
): number[][] {
  const n = nodeIds.length;
  const indexMap = new Map(nodeIds.map((id, i) => [id, i]));
  const matrix: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1.0 : 0.0)),
  );

  for (const { nodeIdA, nodeIdB, corr } of entries) {
    const i = indexMap.get(nodeIdA);
    const j = indexMap.get(nodeIdB);
    if (i !== undefined && j !== undefined && i !== j) {
      matrix[i][j] = corr;
      matrix[j][i] = corr; // enforce symmetry
    }
  }

  return matrix;
}

/**
 * Validate a correlation matrix: symmetry, bounds, PSD, coverage.
 */
export function validateCorrelationMatrix(matrix: number[][]): CorrelationValidation {
  const n = matrix.length;
  const errors: string[] = [];
  let isSymmetric = true;
  let filledPairs = 0;
  const totalOffDiagPairs = n > 1 ? (n * (n - 1)) / 2 : 0;

  for (let i = 0; i < n; i++) {
    if (Math.abs(matrix[i][i] - 1.0) > 1e-10) {
      errors.push(`Diagonal [${i},${i}] must be 1.0`);
    }
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(matrix[i][j] - matrix[j][i]) > 1e-10) {
        isSymmetric = false;
        errors.push(`Asymmetric at [${i},${j}]: ${matrix[i][j]} vs ${matrix[j][i]}`);
      }
      if (matrix[i][j] < -1 || matrix[i][j] > 1) {
        errors.push(`Out of bounds at [${i},${j}]: ${matrix[i][j]}`);
      }
      if (matrix[i][j] !== 0) {
        filledPairs++;
      }
    }
  }

  if (!isSymmetric) {
    errors.push("Matrix is not symmetric");
  }

  const eigenvalues = computeEigenvalues(matrix);
  const eps = -1e-8;
  const isPSD = eigenvalues.every((ev) => ev >= eps);

  if (!isPSD) {
    errors.push("Matrix is not positive semi-definite (has negative eigenvalues)");
  }

  return {
    isSymmetric,
    isPSD,
    coveragePct: totalOffDiagPairs > 0 ? filledPairs / totalOffDiagPairs : 1,
    eigenvalues,
    errors,
  };
}

/**
 * Compute eigenvalues of a symmetric matrix using Jacobi iteration.
 * Returns eigenvalues sorted descending.
 */
export function computeEigenvalues(matrix: number[][]): number[] {
  const n = matrix.length;
  if (n === 0) return [];
  if (n === 1) return [matrix[0][0]];

  // Copy matrix
  const A: number[][] = matrix.map((row) => [...row]);
  const maxIter = 100 * n * n;
  const tol = 1e-12;

  for (let iter = 0; iter < maxIter; iter++) {
    // Find largest off-diagonal element
    let maxVal = 0;
    let p = 0;
    let q = 1;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(A[i][j]) > maxVal) {
          maxVal = Math.abs(A[i][j]);
          p = i;
          q = j;
        }
      }
    }

    if (maxVal < tol) break;

    // Compute rotation
    const theta =
      Math.abs(A[p][p] - A[q][q]) < tol
        ? Math.PI / 4
        : 0.5 * Math.atan2(2 * A[p][q], A[p][p] - A[q][q]);
    const c = Math.cos(theta);
    const s = Math.sin(theta);

    // Apply Givens rotation
    const App = A[p][p];
    const Aqq = A[q][q];
    const Apq = A[p][q];

    A[p][p] = c * c * App + 2 * s * c * Apq + s * s * Aqq;
    A[q][q] = s * s * App - 2 * s * c * Apq + c * c * Aqq;
    A[p][q] = 0;
    A[q][p] = 0;

    for (let i = 0; i < n; i++) {
      if (i !== p && i !== q) {
        const aip = A[i][p];
        const aiq = A[i][q];
        A[i][p] = c * aip + s * aiq;
        A[p][i] = A[i][p];
        A[i][q] = -s * aip + c * aiq;
        A[q][i] = A[i][q];
      }
    }
  }

  const eigenvalues = Array.from({ length: n }, (_, i) => A[i][i]);
  eigenvalues.sort((a, b) => b - a);
  return eigenvalues;
}

/**
 * Compute portfolio volatility using correlation matrix.
 * var = w^T * Cov * w where Cov = diag(vol) * Corr * diag(vol)
 * vol = sqrt(var)
 */
export function computePortfolioVol(
  weights: number[],
  vols: number[],
  corrMatrix: number[][],
): number {
  const n = weights.length;
  let variance = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      variance += weights[i] * weights[j] * vols[i] * vols[j] * corrMatrix[i][j];
    }
  }
  return Math.sqrt(Math.max(0, variance));
}

/**
 * Repair a non-PSD matrix to the nearest PSD matrix.
 * Clips negative eigenvalues to eps and reconstructs.
 */
export function repairToNearestPSD(matrix: number[][]): number[][] {
  const n = matrix.length;
  if (n <= 1) return matrix.map((r) => [...r]);

  const A = matrix.map((r) => [...r]);
  const eps = 1e-6;

  // Jacobi eigendecomposition: get eigenvalues + eigenvectors
  const V: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1.0 : 0.0)),
  );
  const D = A.map((r) => [...r]);
  const maxIter = 100 * n * n;
  const tol = 1e-12;

  for (let iter = 0; iter < maxIter; iter++) {
    let maxVal = 0;
    let p = 0;
    let q = 1;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(D[i][j]) > maxVal) {
          maxVal = Math.abs(D[i][j]);
          p = i;
          q = j;
        }
      }
    }
    if (maxVal < tol) break;

    const theta =
      Math.abs(D[p][p] - D[q][q]) < tol
        ? Math.PI / 4
        : 0.5 * Math.atan2(2 * D[p][q], D[p][p] - D[q][q]);
    const c = Math.cos(theta);
    const s = Math.sin(theta);

    const Dpp = D[p][p];
    const Dqq = D[q][q];
    const Dpq = D[p][q];
    D[p][p] = c * c * Dpp + 2 * s * c * Dpq + s * s * Dqq;
    D[q][q] = s * s * Dpp - 2 * s * c * Dpq + c * c * Dqq;
    D[p][q] = 0;
    D[q][p] = 0;

    for (let i = 0; i < n; i++) {
      if (i !== p && i !== q) {
        const dip = D[i][p];
        const diq = D[i][q];
        D[i][p] = c * dip + s * diq;
        D[p][i] = D[i][p];
        D[i][q] = -s * dip + c * diq;
        D[q][i] = D[i][q];
      }
    }

    // Accumulate eigenvectors
    for (let i = 0; i < n; i++) {
      const vip = V[i][p];
      const viq = V[i][q];
      V[i][p] = c * vip + s * viq;
      V[i][q] = -s * vip + c * viq;
    }
  }

  // Clip eigenvalues
  const eigenvalues = Array.from({ length: n }, (_, i) => Math.max(D[i][i], eps));

  // Reconstruct: V * diag(clipped) * V^T
  const result: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += V[i][k] * eigenvalues[k] * V[j][k];
      }
      result[i][j] = sum;
    }
  }

  // Normalize diagonal to 1.0 (correlation matrix)
  const diag = result.map((r, i) => Math.sqrt(r[i]));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      result[i][j] = i === j ? 1.0 : result[i][j] / (diag[i] * diag[j]);
      // Clamp to [-1, 1]
      result[i][j] = Math.max(-1, Math.min(1, result[i][j]));
    }
  }

  return result;
}

/**
 * Generate a "typical" correlation preset for common asset classes.
 * Equities: high correlation (0.7–0.85)
 * Bonds: moderate (0.5)
 * Equity–Bond: low (0.1–0.3)
 */
export function generateTypicalCorrelations(
  nodeIds: string[],
  nodeNames: string[],
): CorrelationEntry[] {
  const entries: CorrelationEntry[] = [];
  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = i + 1; j < nodeIds.length; j++) {
      const nameA = nodeNames[i].toLowerCase();
      const nameB = nodeNames[j].toLowerCase();
      const isEquityA = nameA.includes("equit");
      const isEquityB = nameB.includes("equit");
      const isBondA = nameA.includes("fixed") || nameA.includes("bond");
      const isBondB = nameB.includes("fixed") || nameB.includes("bond");

      let corr = 0.3; // default moderate
      if (isEquityA && isEquityB) corr = 0.75;
      else if (isBondA && isBondB) corr = 0.5;
      else if ((isEquityA && isBondB) || (isBondA && isEquityB)) corr = 0.15;

      entries.push({ nodeIdA: nodeIds[i], nodeIdB: nodeIds[j], corr });
    }
  }
  return entries;
}
