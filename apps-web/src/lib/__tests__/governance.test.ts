import { describe, it, expect } from "vitest";
import {
  buildClientDriftRows,
  buildSleeveGovernanceRows,
  computeSummary,
} from "../governance";
import type { DriftResult } from "../drift";
import type { LiquidityAssessment } from "../liquidity";

const makeDrift = (breachCount: number, maxAbsDrift: number): DriftResult => ({
  rows: [],
  totalCurrentWeight: 1,
  totalTargetWeight: 1,
  maxAbsDrift,
  breachCount,
});

const makeLiquidity = (
  severity: "OK" | "WARN" | "CRITICAL",
  shortfall: number,
): LiquidityAssessment => ({
  requirements: [],
  liquidBucketValue: 100_000,
  portfolioCurrency: "AUD",
  totalRequired: shortfall > 0 ? shortfall + 100_000 : 50_000,
  shortfall,
  severity,
  nonCoveredCurrencies: [],
});

describe("buildClientDriftRows", () => {
  it("maps clients with and without SAA", () => {
    const rows = buildClientDriftRows([
      {
        clientId: "c1",
        clientName: "Alice",
        adviserName: "Adv1",
        adviserId: "a1",
        driftResult: makeDrift(2, 0.05),
      },
      {
        clientId: "c2",
        clientName: "Bob",
        adviserName: "Adv1",
        adviserId: "a1",
        driftResult: null,
      },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].breachCount).toBe(2);
    expect(rows[0].maxAbsDrift).toBe(0.05);
    expect(rows[0].hasSAA).toBe(true);
    expect(rows[1].breachCount).toBe(0);
    expect(rows[1].hasSAA).toBe(false);
  });
});

describe("computeSummary", () => {
  it("aggregates totals correctly", () => {
    const driftRows = buildClientDriftRows([
      { clientId: "c1", clientName: "Alice", adviserName: "A", adviserId: "a1", driftResult: makeDrift(3, 0.1) },
      { clientId: "c2", clientName: "Bob", adviserName: "A", adviserId: "a1", driftResult: makeDrift(0, 0.0) },
      { clientId: "c3", clientName: "Carol", adviserName: "B", adviserId: "a2", driftResult: null },
    ]);

    const sleeveRows = buildSleeveGovernanceRows([
      { clientId: "c1", clientName: "Alice", adviserName: "A", adviserId: "a1", liquidity: makeLiquidity("WARN", 5000), activeAlertCount: 1 },
      { clientId: "c2", clientName: "Bob", adviserName: "A", adviserId: "a1", liquidity: makeLiquidity("OK", 0), activeAlertCount: 0 },
      { clientId: "c3", clientName: "Carol", adviserName: "B", adviserId: "a2", liquidity: makeLiquidity("CRITICAL", 20000), activeAlertCount: 2 },
    ]);

    const summary = computeSummary(driftRows, sleeveRows, 4);

    expect(summary.totalClients).toBe(3);
    expect(summary.clientsOutOfTolerance).toBe(1); // only Alice has breachCount > 0
    expect(summary.sleevesWarnOrCritical).toBe(2); // WARN + CRITICAL
    expect(summary.pendingApprovals).toBe(4);
  });
});
