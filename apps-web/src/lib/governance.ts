/**
 * Pure governance aggregation functions.
 * Takes pre-computed drift and liquidity results per client/sleeve
 * and produces dashboard summary data.
 * Client-safe (no DB imports).
 */

import type { DriftResult } from "./drift";
import type { LiquidityAssessment } from "./liquidity";

export type ClientDriftRow = {
  clientId: string;
  clientName: string;
  adviserName: string;
  adviserId: string;
  breachCount: number;
  maxAbsDrift: number;
  hasSAA: boolean;
};

export type SleeveGovernanceRow = {
  clientId: string;
  clientName: string;
  adviserName: string;
  adviserId: string;
  severity: "OK" | "WARN" | "CRITICAL";
  shortfall: number;
  activeAlertCount: number;
};

export type RebalanceGovernanceRow = {
  clientId: string;
  clientName: string;
  adviserName: string;
  adviserId: string;
  breachCount: number;
  latestPlanStatus: string | null;   // DRAFT, ADVISER_APPROVED, CLIENT_APPROVED, REJECTED, or null
  tradeCount: number;
  ordersSummary: string;             // e.g. "3 filled / 1 submitted" or "—"
  lastUpdated: string | null;        // ISO string
};

export type GovernanceSummary = {
  totalClients: number;
  clientsOutOfTolerance: number;
  sleevesWarnOrCritical: number;
  pendingApprovals: number;
  rebalanceDraft: number;
  rebalanceAdviserApproved: number;
  rebalanceClientApproved: number;
  rebalanceOrdersPendingFill: number;
};

export function buildClientDriftRows(
  clients: {
    clientId: string;
    clientName: string;
    adviserName: string;
    adviserId: string;
    driftResult: DriftResult | null;
  }[],
): ClientDriftRow[] {
  return clients.map((c) => ({
    clientId: c.clientId,
    clientName: c.clientName,
    adviserName: c.adviserName,
    adviserId: c.adviserId,
    breachCount: c.driftResult?.breachCount ?? 0,
    maxAbsDrift: c.driftResult?.maxAbsDrift ?? 0,
    hasSAA: c.driftResult !== null,
  }));
}

export function buildSleeveGovernanceRows(
  sleeves: {
    clientId: string;
    clientName: string;
    adviserName: string;
    adviserId: string;
    liquidity: LiquidityAssessment;
    activeAlertCount: number;
  }[],
): SleeveGovernanceRow[] {
  return sleeves.map((s) => ({
    clientId: s.clientId,
    clientName: s.clientName,
    adviserName: s.adviserName,
    adviserId: s.adviserId,
    severity: s.liquidity.severity,
    shortfall: s.liquidity.shortfall,
    activeAlertCount: s.activeAlertCount,
  }));
}

export type RebalanceGovernanceInput = {
  clientId: string;
  clientName: string;
  adviserName: string;
  adviserId: string;
  breachCount: number;
  latestPlan: {
    status: string;
    tradeCount: number;
    createdAt: string;
  } | null;
  orders: { status: string }[];
};

export function summarizeOrders(orders: { status: string }[]): string {
  if (orders.length === 0) return "—";
  const counts = new Map<string, number>();
  for (const o of orders) {
    counts.set(o.status, (counts.get(o.status) ?? 0) + 1);
  }
  const parts: string[] = [];
  for (const [status, count] of counts) {
    const label = status.toLowerCase().replace(/_/g, " ");
    parts.push(`${count} ${label}`);
  }
  return parts.join(" / ");
}

export function buildRebalanceGovernanceRows(
  inputs: RebalanceGovernanceInput[],
): RebalanceGovernanceRow[] {
  return inputs.map((inp) => ({
    clientId: inp.clientId,
    clientName: inp.clientName,
    adviserName: inp.adviserName,
    adviserId: inp.adviserId,
    breachCount: inp.breachCount,
    latestPlanStatus: inp.latestPlan?.status ?? null,
    tradeCount: inp.latestPlan?.tradeCount ?? 0,
    ordersSummary: summarizeOrders(inp.orders),
    lastUpdated: inp.latestPlan?.createdAt ?? null,
  }));
}

export function computeSummary(
  driftRows: ClientDriftRow[],
  sleeveRows: SleeveGovernanceRow[],
  pendingApprovals: number,
  rebalanceRows: RebalanceGovernanceRow[] = [],
  rebalanceOrdersPendingFill: number = 0,
): GovernanceSummary {
  return {
    totalClients: driftRows.length,
    clientsOutOfTolerance: driftRows.filter((r) => r.breachCount > 0).length,
    sleevesWarnOrCritical: sleeveRows.filter(
      (r) => r.severity === "WARN" || r.severity === "CRITICAL",
    ).length,
    pendingApprovals,
    rebalanceDraft: rebalanceRows.filter((r) => r.latestPlanStatus === "DRAFT").length,
    rebalanceAdviserApproved: rebalanceRows.filter((r) => r.latestPlanStatus === "ADVISER_APPROVED").length,
    rebalanceClientApproved: rebalanceRows.filter((r) => r.latestPlanStatus === "CLIENT_APPROVED").length,
    rebalanceOrdersPendingFill,
  };
}
