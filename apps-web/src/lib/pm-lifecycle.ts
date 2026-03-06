/**
 * Pure PM lifecycle calculations: event aggregation, template selection, projections.
 * Client-safe (no DB imports).
 */

import type { CurvePoint } from "./pm-curves";
import { curveCumToIncremental, scaleIncrementalPctToDollars, computeFundMetrics } from "./pm-curves";

// ── Types ──────────────────────────────────────────────

export type CashflowEvent = {
  type: "CALL" | "DISTRIBUTION";
  eventDate: string; // ISO date
  amount: number;
  currency: string;
};

export type NAVPoint = {
  date: string; // ISO date
  navAmount: number;
};

export type EventSnapshot = {
  paidIn: number;
  distributions: number;
  latestNav: number | null;
  latestNavDate: string | null;
  source: "events" | "stored";
};

export type TemplateChoice = {
  templateId: string;
  templateName: string;
  source: "scenario_override" | "fund_default" | "none";
};

export type ProjectionResult = {
  projectedCalls: { month: string; amount: number }[];
  projectedDistributions: { month: string; amount: number }[];
  templateName: string;
  templateSource: string;
};

// ── Event Aggregation ──────────────────────────────────

/**
 * Compute snapshot from cashflow events and NAV points.
 * Falls back to stored values if no events exist.
 */
export function computeSnapshotFromEvents(
  events: CashflowEvent[],
  navPoints: NAVPoint[],
  storedFunded: number,
  storedNav: number,
  storedDistributions: number,
  storedNavDate: string | null,
): EventSnapshot {
  if (events.length === 0 && navPoints.length === 0) {
    return {
      paidIn: storedFunded,
      distributions: storedDistributions,
      latestNav: storedNav,
      latestNavDate: storedNavDate,
      source: "stored",
    };
  }

  const paidIn = events
    .filter((e) => e.type === "CALL")
    .reduce((sum, e) => sum + e.amount, 0);

  const distributions = events
    .filter((e) => e.type === "DISTRIBUTION")
    .reduce((sum, e) => sum + e.amount, 0);

  let latestNav: number | null = null;
  let latestNavDate: string | null = null;
  if (navPoints.length > 0) {
    const sorted = [...navPoints].sort((a, b) => b.date.localeCompare(a.date));
    latestNav = sorted[0].navAmount;
    latestNavDate = sorted[0].date;
  }

  return {
    paidIn: paidIn || storedFunded,
    distributions: distributions || storedDistributions,
    latestNav: latestNav ?? storedNav,
    latestNavDate: latestNavDate ?? storedNavDate,
    source: events.length > 0 ? "events" : "stored",
  };
}

/**
 * Compute full metrics from a snapshot.
 */
export function computeMetricsFromSnapshot(
  snapshot: EventSnapshot,
  commitmentAmount: number,
) {
  return computeFundMetrics(
    snapshot.paidIn,
    snapshot.latestNav ?? 0,
    snapshot.distributions,
    commitmentAmount,
  );
}

// ── Template Selection ─────────────────────────────────

/**
 * Determine which projection template to use for a commitment.
 * Priority: scenario override > fund default > none
 */
export function selectTemplate(
  scenarioOverride: { templateId: string; templateName: string } | null,
  fundDefault: { templateId: string; templateName: string } | null,
): TemplateChoice {
  if (scenarioOverride) {
    return {
      templateId: scenarioOverride.templateId,
      templateName: scenarioOverride.templateName,
      source: "scenario_override",
    };
  }
  if (fundDefault) {
    return {
      templateId: fundDefault.templateId,
      templateName: fundDefault.templateName,
      source: "fund_default",
    };
  }
  return { templateId: "", templateName: "", source: "none" };
}

// ── Projections ────────────────────────────────────────

/**
 * Generate projected calls and distributions from a template's curves
 * scaled by commitment amount.
 */
export function computeProjections(
  callCurveJson: string,
  distCurveJson: string,
  commitmentAmount: number,
  templateName: string,
  templateSource: string,
): ProjectionResult {
  let projectedCalls: { month: string; amount: number }[] = [];
  let projectedDistributions: { month: string; amount: number }[] = [];

  try {
    const callCurve: CurvePoint[] = JSON.parse(callCurveJson);
    const incCalls = curveCumToIncremental(callCurve);
    projectedCalls = scaleIncrementalPctToDollars(incCalls, commitmentAmount);
  } catch { /* empty */ }

  try {
    const distCurve: CurvePoint[] = JSON.parse(distCurveJson);
    const incDist = curveCumToIncremental(distCurve);
    projectedDistributions = scaleIncrementalPctToDollars(incDist, commitmentAmount);
  } catch { /* empty */ }

  return {
    projectedCalls,
    projectedDistributions,
    templateName,
    templateSource,
  };
}
