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

export type GovernanceSummary = {
  totalClients: number;
  clientsOutOfTolerance: number;
  sleevesWarnOrCritical: number;
  pendingApprovals: number;
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

export function computeSummary(
  driftRows: ClientDriftRow[],
  sleeveRows: SleeveGovernanceRow[],
  pendingApprovals: number,
): GovernanceSummary {
  return {
    totalClients: driftRows.length,
    clientsOutOfTolerance: driftRows.filter((r) => r.breachCount > 0).length,
    sleevesWarnOrCritical: sleeveRows.filter(
      (r) => r.severity === "WARN" || r.severity === "CRITICAL",
    ).length,
    pendingApprovals,
  };
}
