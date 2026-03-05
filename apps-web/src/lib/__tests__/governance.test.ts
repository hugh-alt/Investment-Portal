import { describe, it, expect } from "vitest";
import {
  buildClientDriftRows,
  buildSleeveGovernanceRows,
  buildRebalanceGovernanceRows,
  summarizeOrders,
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

describe("buildRebalanceGovernanceRows", () => {
  it("maps clients with and without plans", () => {
    const rows = buildRebalanceGovernanceRows([
      {
        clientId: "c1",
        clientName: "Alice",
        adviserName: "A",
        adviserId: "a1",
        breachCount: 3,
        latestPlan: { status: "DRAFT", tradeCount: 5, createdAt: "2026-03-01T00:00:00Z" },
        orders: [],
      },
      {
        clientId: "c2",
        clientName: "Bob",
        adviserName: "A",
        adviserId: "a1",
        breachCount: 0,
        latestPlan: null,
        orders: [],
      },
      {
        clientId: "c3",
        clientName: "Carol",
        adviserName: "B",
        adviserId: "a2",
        breachCount: 1,
        latestPlan: { status: "CLIENT_APPROVED", tradeCount: 3, createdAt: "2026-03-02T00:00:00Z" },
        orders: [{ status: "FILLED" }, { status: "FILLED" }, { status: "SUBMITTED" }],
      },
    ]);

    expect(rows).toHaveLength(3);
    expect(rows[0].latestPlanStatus).toBe("DRAFT");
    expect(rows[0].tradeCount).toBe(5);
    expect(rows[0].ordersSummary).toBe("—");
    expect(rows[1].latestPlanStatus).toBeNull();
    expect(rows[1].tradeCount).toBe(0);
    expect(rows[2].latestPlanStatus).toBe("CLIENT_APPROVED");
    expect(rows[2].ordersSummary).toBe("2 filled / 1 submitted");
  });
});

describe("summarizeOrders", () => {
  it("returns dash for empty orders", () => {
    expect(summarizeOrders([])).toBe("—");
  });

  it("groups and labels order statuses", () => {
    const result = summarizeOrders([
      { status: "FILLED" },
      { status: "SUBMITTED" },
      { status: "FILLED" },
      { status: "PARTIALLY_FILLED" },
    ]);
    expect(result).toContain("2 filled");
    expect(result).toContain("1 submitted");
    expect(result).toContain("1 partially filled");
  });
});

describe("computeSummary", () => {
  it("aggregates totals correctly including rebalance", () => {
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

    const rebalanceRows = buildRebalanceGovernanceRows([
      { clientId: "c1", clientName: "Alice", adviserName: "A", adviserId: "a1", breachCount: 3, latestPlan: { status: "DRAFT", tradeCount: 5, createdAt: "2026-03-01" }, orders: [] },
      { clientId: "c2", clientName: "Bob", adviserName: "A", adviserId: "a1", breachCount: 0, latestPlan: { status: "CLIENT_APPROVED", tradeCount: 3, createdAt: "2026-03-01" }, orders: [{ status: "SUBMITTED" }] },
      { clientId: "c3", clientName: "Carol", adviserName: "B", adviserId: "a2", breachCount: 1, latestPlan: { status: "ADVISER_APPROVED", tradeCount: 2, createdAt: "2026-03-01" }, orders: [] },
    ]);

    const summary = computeSummary(driftRows, sleeveRows, 4, rebalanceRows, 2);

    expect(summary.totalClients).toBe(3);
    expect(summary.clientsOutOfTolerance).toBe(1);
    expect(summary.sleevesWarnOrCritical).toBe(2);
    expect(summary.pendingApprovals).toBe(4);
    expect(summary.rebalanceDraft).toBe(1);
    expect(summary.rebalanceAdviserApproved).toBe(1);
    expect(summary.rebalanceClientApproved).toBe(1);
    expect(summary.rebalanceOrdersPendingFill).toBe(2);
  });
});
