import { describe, it, expect } from "vitest";
import {
  computeSnapshotFromEvents,
  computeMetricsFromSnapshot,
  selectTemplate,
  computeProjections,
  type CashflowEvent,
  type NAVPoint,
} from "../pm-lifecycle";

describe("computeSnapshotFromEvents", () => {
  const storedFunded = 100000;
  const storedNav = 110000;
  const storedDistributions = 5000;
  const storedNavDate = "2026-01-31";

  it("falls back to stored values when no events exist", () => {
    const snap = computeSnapshotFromEvents([], [], storedFunded, storedNav, storedDistributions, storedNavDate);
    expect(snap.source).toBe("stored");
    expect(snap.paidIn).toBe(100000);
    expect(snap.distributions).toBe(5000);
    expect(snap.latestNav).toBe(110000);
    expect(snap.latestNavDate).toBe("2026-01-31");
  });

  it("aggregates call events into paidIn", () => {
    const events: CashflowEvent[] = [
      { type: "CALL", eventDate: "2025-06-15", amount: 50000, currency: "AUD" },
      { type: "CALL", eventDate: "2025-12-15", amount: 30000, currency: "AUD" },
    ];
    const snap = computeSnapshotFromEvents(events, [], storedFunded, storedNav, storedDistributions, storedNavDate);
    expect(snap.source).toBe("events");
    expect(snap.paidIn).toBe(80000);
    expect(snap.distributions).toBe(storedDistributions); // fallback since no dist events
  });

  it("aggregates distribution events", () => {
    const events: CashflowEvent[] = [
      { type: "CALL", eventDate: "2025-06-15", amount: 50000, currency: "AUD" },
      { type: "DISTRIBUTION", eventDate: "2026-01-15", amount: 8000, currency: "AUD" },
      { type: "DISTRIBUTION", eventDate: "2026-03-01", amount: 3000, currency: "AUD" },
    ];
    const snap = computeSnapshotFromEvents(events, [], storedFunded, storedNav, storedDistributions, storedNavDate);
    expect(snap.paidIn).toBe(50000);
    expect(snap.distributions).toBe(11000);
  });

  it("uses latest NAV point when available", () => {
    const navPoints: NAVPoint[] = [
      { date: "2025-09-30", navAmount: 52000 },
      { date: "2026-01-31", navAmount: 55000 },
      { date: "2025-12-31", navAmount: 53000 },
    ];
    const snap = computeSnapshotFromEvents([], navPoints, storedFunded, storedNav, storedDistributions, storedNavDate);
    expect(snap.latestNav).toBe(55000);
    expect(snap.latestNavDate).toBe("2026-01-31");
  });
});

describe("computeMetricsFromSnapshot", () => {
  it("computes DPI/RVPI/TVPI from snapshot", () => {
    const snap = {
      paidIn: 200000,
      distributions: 20000,
      latestNav: 220000,
      latestNavDate: "2026-02-28",
      source: "events" as const,
    };
    const metrics = computeMetricsFromSnapshot(snap, 500000);
    expect(metrics.unfunded).toBe(300000);
    expect(metrics.pctCalled).toBeCloseTo(0.4);
    expect(metrics.dpi).toBeCloseTo(0.1); // 20k/200k
    expect(metrics.rvpi).toBeCloseTo(1.1); // 220k/200k
    expect(metrics.tvpi).toBeCloseTo(1.2); // (220k+20k)/200k
  });
});

describe("selectTemplate", () => {
  const scenarioOverride = { templateId: "tmpl-fast", templateName: "Fast" };
  const fundDefault = { templateId: "tmpl-base", templateName: "Base" };

  it("prefers scenario override over fund default", () => {
    const choice = selectTemplate(scenarioOverride, fundDefault);
    expect(choice.templateId).toBe("tmpl-fast");
    expect(choice.source).toBe("scenario_override");
  });

  it("falls back to fund default when no override", () => {
    const choice = selectTemplate(null, fundDefault);
    expect(choice.templateId).toBe("tmpl-base");
    expect(choice.source).toBe("fund_default");
  });

  it("returns none when neither exists", () => {
    const choice = selectTemplate(null, null);
    expect(choice.source).toBe("none");
    expect(choice.templateId).toBe("");
  });
});

describe("computeProjections", () => {
  const callCurve = JSON.stringify([
    { month: "2026-04", cumPct: 0.1 },
    { month: "2026-05", cumPct: 0.2 },
    { month: "2026-06", cumPct: 0.3 },
  ]);
  const distCurve = JSON.stringify([
    { month: "2026-04", cumPct: 0 },
    { month: "2026-05", cumPct: 0.02 },
    { month: "2026-06", cumPct: 0.05 },
  ]);

  it("scales template curves by commitment amount", () => {
    const result = computeProjections(callCurve, distCurve, 500000, "Base", "fund_default");
    expect(result.projectedCalls).toHaveLength(3);
    expect(result.projectedCalls[0].amount).toBe(50000); // 10% of 500k
    expect(result.projectedCalls[1].amount).toBe(50000); // 10% incremental
    expect(result.projectedDistributions[1].amount).toBe(10000); // 2% of 500k
    expect(result.templateName).toBe("Base");
  });

  it("handles invalid JSON gracefully", () => {
    const result = computeProjections("invalid", "invalid", 500000, "Bad", "none");
    expect(result.projectedCalls).toEqual([]);
    expect(result.projectedDistributions).toEqual([]);
  });
});
