/**
 * Pure liquidity stress testing logic.
 * Computes whether a client can meet cash demands within specific horizons,
 * considering stressed liquidity from profiles, PM projected calls, and buffer.
 * Client-safe (no DB imports).
 */

import type { LiquidityProfileData, ProductMapping, TaxonomyNode, ExposureInput } from "./liquidity-profile";
import { resolveProfile, computeGatedAvailableValue } from "./liquidity-profile";

// ── Types ─────────────────────────────────────────────────

export type StressRule = {
  horizonDays: number;
  extraCashDemandPct: number; // 0–1
  extraCashDemandAmount: number; // absolute $
};

export type PMCallInput = {
  currency: string;
  month: string; // YYYY-MM
  amount: number;
};

export type BufferInput = {
  method: "VS_UNFUNDED_PCT" | "VS_PROJECTED_CALLS";
  unfundedAUD: number;
  bufferPctOfUnfunded: number;
  projectedCallsWithinMonths: number;
  projectedCallsAUD: number; // pre-computed sum of AUD calls within buffer months
};

export type StressHorizonResult = {
  horizonDays: number;
  availableLiquidity: number;
  requiredLiquidity: number;
  coverageRatio: number;
  shortfall: number;
  status: "OK" | "WARN" | "CRITICAL";
  details: {
    stressedLiquidityByHorizon: number;
    pmCallsWithinHorizon: number;
    bufferRequirement: number;
    extraDemandPct: number;
    extraDemandAmount: number;
    foreignCurrencyCalls: { currency: string; amount: number }[];
  };
};

export type ClientStressResult = {
  clientId: string;
  totalPortfolioValue: number;
  horizons: StressHorizonResult[];
  worstStatus: "OK" | "WARN" | "CRITICAL";
  worstCoverage30d: number;
  worstCoverage90d: number;
};

// ── Available liquidity (stressed + gating-adjusted) ─────

/**
 * Compute cumulative stressed liquidity available within a given horizon.
 * Now applies gating mechanics: notice delays and gate fraction limits.
 */
export function computeAvailableLiquidity(
  exposures: ExposureInput[],
  productMappings: ProductMapping[],
  overrides: Map<string, LiquidityProfileData>,
  taxonomyDefaults: Map<string, LiquidityProfileData>,
  nodes: Map<string, TaxonomyNode>,
  scenarioHorizonDays: number,
  adviserOverrides?: Map<string, LiquidityProfileData>,
): number {
  let available = 0;
  for (const exp of exposures) {
    const profile = resolveProfile(exp.productId, productMappings, overrides, taxonomyDefaults, nodes, adviserOverrides);
    available += computeGatedAvailableValue(exp.marketValue, profile, scenarioHorizonDays);
  }
  return available;
}

// ── Required liquidity ────────────────────────────────────

/**
 * Compute PM call $ within a given horizon (months).
 * Horizon 30d ~= 1 month, 90d ~= 3 months, 365d ~= 12 months.
 */
export function horizonToMonths(horizonDays: number): number {
  return Math.ceil(horizonDays / 30);
}

/**
 * Sum projected calls within a number of months for a specific currency.
 * Months are sorted chronologically; takes first N months.
 */
export function sumCallsWithinMonths(
  calls: PMCallInput[],
  months: number,
  currency: string,
): number {
  const currencyCalls = calls.filter((c) => c.currency === currency);
  const allMonths = [...new Set(currencyCalls.map((c) => c.month))].sort();
  const relevantMonths = new Set(allMonths.slice(0, months));

  let total = 0;
  for (const call of currencyCalls) {
    if (relevantMonths.has(call.month)) {
      total += call.amount;
    }
  }
  return total;
}

/**
 * Sum ALL projected calls within horizon months, grouped by currency.
 */
export function sumCallsByCurrency(
  calls: PMCallInput[],
  months: number,
): Map<string, number> {
  const byCurrency = new Map<string, PMCallInput[]>();
  for (const c of calls) {
    const list = byCurrency.get(c.currency) ?? [];
    list.push(c);
    byCurrency.set(c.currency, list);
  }

  const result = new Map<string, number>();
  for (const [currency, currencyCalls] of byCurrency) {
    const allMonths = [...new Set(currencyCalls.map((c) => c.month))].sort();
    const relevantMonths = new Set(allMonths.slice(0, months));
    let total = 0;
    for (const call of currencyCalls) {
      if (relevantMonths.has(call.month)) total += call.amount;
    }
    if (total > 0) result.set(currency, total);
  }
  return result;
}

/**
 * Compute required liquidity for a single horizon.
 */
export function computeRequiredLiquidity(
  rule: StressRule,
  totalPortfolioValue: number,
  pmCalls: PMCallInput[],
  buffer: BufferInput | null,
): { required: number; pmCallsAUD: number; bufferReq: number; foreignCalls: { currency: string; amount: number }[] } {
  const months = horizonToMonths(rule.horizonDays);

  // PM calls within horizon — AUD only for now
  const callsByCurrency = sumCallsByCurrency(pmCalls, months);
  const pmCallsAUD = callsByCurrency.get("AUD") ?? 0;

  // Foreign currency calls (flagged but not added to AUD requirement)
  const foreignCalls: { currency: string; amount: number }[] = [];
  for (const [currency, amount] of callsByCurrency) {
    if (currency !== "AUD") {
      foreignCalls.push({ currency, amount });
    }
  }

  // Buffer requirement
  let bufferReq = 0;
  if (buffer) {
    if (buffer.method === "VS_UNFUNDED_PCT") {
      bufferReq = buffer.unfundedAUD * buffer.bufferPctOfUnfunded;
    } else {
      // VS_PROJECTED_CALLS: use pre-computed AUD calls within buffer months
      bufferReq = buffer.projectedCallsAUD;
    }
  }

  // Extra scenario demand
  const extraPct = rule.extraCashDemandPct * totalPortfolioValue;
  const extraAbs = rule.extraCashDemandAmount;

  const required = pmCallsAUD + bufferReq + extraPct + extraAbs;

  return { required, pmCallsAUD, bufferReq, foreignCalls };
}

// ── Full stress computation ───────────────────────────────

/**
 * Compute stress results for a single client across all horizons.
 */
export function computeClientStress(
  clientId: string,
  exposures: ExposureInput[],
  productMappings: ProductMapping[],
  overrides: Map<string, LiquidityProfileData>,
  taxonomyDefaults: Map<string, LiquidityProfileData>,
  nodes: Map<string, TaxonomyNode>,
  rules: StressRule[],
  pmCalls: PMCallInput[],
  buffer: BufferInput | null,
  adviserOverrides?: Map<string, LiquidityProfileData>,
): ClientStressResult {
  const totalPortfolioValue = exposures.reduce((s, e) => s + e.marketValue, 0);

  const horizons: StressHorizonResult[] = rules.map((rule) => {
    const available = computeAvailableLiquidity(
      exposures, productMappings, overrides, taxonomyDefaults, nodes,
      rule.horizonDays, adviserOverrides,
    );

    const { required, pmCallsAUD, bufferReq, foreignCalls } = computeRequiredLiquidity(
      rule, totalPortfolioValue, pmCalls, buffer,
    );

    const coverageRatio = required > 0 ? available / required : available > 0 ? Infinity : 1;
    const shortfall = Math.max(0, required - available);

    let status: "OK" | "WARN" | "CRITICAL";
    if (coverageRatio >= 1) {
      status = "OK";
    } else if (coverageRatio >= 0.8) {
      status = "WARN";
    } else {
      status = "CRITICAL";
    }

    return {
      horizonDays: rule.horizonDays,
      availableLiquidity: available,
      requiredLiquidity: required,
      coverageRatio: coverageRatio === Infinity ? 999 : coverageRatio,
      shortfall,
      status,
      details: {
        stressedLiquidityByHorizon: available,
        pmCallsWithinHorizon: pmCallsAUD,
        bufferRequirement: bufferReq,
        extraDemandPct: rule.extraCashDemandPct * totalPortfolioValue,
        extraDemandAmount: rule.extraCashDemandAmount,
        foreignCurrencyCalls: foreignCalls,
      },
    };
  });

  const statuses = horizons.map((h) => h.status);
  const worstStatus: "OK" | "WARN" | "CRITICAL" =
    statuses.includes("CRITICAL") ? "CRITICAL" :
    statuses.includes("WARN") ? "WARN" : "OK";

  const h30 = horizons.find((h) => h.horizonDays === 30);
  const h90 = horizons.find((h) => h.horizonDays === 90);

  return {
    clientId,
    totalPortfolioValue,
    horizons,
    worstStatus,
    worstCoverage30d: h30?.coverageRatio ?? 999,
    worstCoverage90d: h90?.coverageRatio ?? 999,
  };
}

// ── Governance row ────────────────────────────────────────

export type LiquidityStressGovRow = {
  clientId: string;
  clientName: string;
  adviserName: string;
  adviserId: string;
  status30d: "OK" | "WARN" | "CRITICAL";
  coverage30d: number;
  shortfall30d: number;
  status90d: "OK" | "WARN" | "CRITICAL";
  coverage90d: number;
  shortfall90d: number;
  worstStatus: "OK" | "WARN" | "CRITICAL";
};

export function buildLiquidityStressGovRows(
  inputs: {
    clientId: string;
    clientName: string;
    adviserName: string;
    adviserId: string;
    stress: ClientStressResult;
  }[],
): LiquidityStressGovRow[] {
  return inputs.map((inp) => {
    const h30 = inp.stress.horizons.find((h) => h.horizonDays === 30);
    const h90 = inp.stress.horizons.find((h) => h.horizonDays === 90);
    return {
      clientId: inp.clientId,
      clientName: inp.clientName,
      adviserName: inp.adviserName,
      adviserId: inp.adviserId,
      status30d: h30?.status ?? "OK",
      coverage30d: h30?.coverageRatio ?? 999,
      shortfall30d: h30?.shortfall ?? 0,
      status90d: h90?.status ?? "OK",
      coverage90d: h90?.coverageRatio ?? 999,
      shortfall90d: h90?.shortfall ?? 0,
      worstStatus: inp.stress.worstStatus,
    };
  }).sort((a, b) => a.coverage30d - b.coverage30d);
}
