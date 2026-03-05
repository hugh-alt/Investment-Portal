import { describe, it, expect } from "vitest";
import {
  computeUnfunded,
  computeSleeveTotals,
  summarizeCommitments,
  groupByCurrency,
  type CommitmentInput,
  type LiquidPositionInput,
} from "../sleeve";

describe("computeUnfunded", () => {
  it("returns commitment - funded", () => {
    expect(computeUnfunded(500000, 200000)).toBe(300000);
  });

  it("clamps to zero if funded exceeds commitment", () => {
    expect(computeUnfunded(100000, 150000)).toBe(0);
  });
});

describe("computeSleeveTotals", () => {
  const commitments: CommitmentInput[] = [
    { fundId: "f1", fundName: "Fund A", currency: "AUD", commitmentAmount: 500000, fundedAmount: 200000, navAmount: 220000, distributionsAmount: 10000 },
    { fundId: "f2", fundName: "Fund B", currency: "AUD", commitmentAmount: 300000, fundedAmount: 300000, navAmount: 350000, distributionsAmount: 50000 },
  ];

  const liquid: LiquidPositionInput[] = [
    { productId: "p1", productName: "BHP", marketValue: 25000 },
    { productId: "p2", productName: "CBA", marketValue: 35000 },
  ];

  it("aggregates commitment totals by currency", () => {
    const totals = computeSleeveTotals(commitments, liquid);
    expect(totals.byCurrency).toHaveLength(1);
    expect(totals.byCurrency[0].currency).toBe("AUD");
    expect(totals.byCurrency[0].totalCommitment).toBe(800000);
    expect(totals.byCurrency[0].totalFunded).toBe(500000);
    expect(totals.byCurrency[0].totalUnfunded).toBe(300000);
    expect(totals.byCurrency[0].totalNav).toBe(570000);
    expect(totals.byCurrency[0].totalDistributions).toBe(60000);
  });

  it("aggregates liquid bucket", () => {
    const totals = computeSleeveTotals(commitments, liquid);
    expect(totals.liquidBucketValue).toBe(60000);
  });

  it("flags single currency as not multi-currency", () => {
    const totals = computeSleeveTotals(commitments, liquid);
    expect(totals.multiCurrency).toBe(false);
  });

  it("handles empty inputs", () => {
    const totals = computeSleeveTotals([], []);
    expect(totals.byCurrency).toHaveLength(0);
    expect(totals.liquidBucketValue).toBe(0);
    expect(totals.multiCurrency).toBe(false);
  });
});

describe("groupByCurrency", () => {
  it("groups commitments by currency and sorts alphabetically", () => {
    const mixed: CommitmentInput[] = [
      { fundId: "f1", fundName: "USD Fund", currency: "USD", commitmentAmount: 200000, fundedAmount: 100000, navAmount: 110000, distributionsAmount: 5000 },
      { fundId: "f2", fundName: "AUD Fund", currency: "AUD", commitmentAmount: 500000, fundedAmount: 200000, navAmount: 220000, distributionsAmount: 10000 },
      { fundId: "f3", fundName: "USD Fund 2", currency: "USD", commitmentAmount: 300000, fundedAmount: 300000, navAmount: 320000, distributionsAmount: 15000 },
    ];
    const groups = groupByCurrency(mixed);
    expect(groups).toHaveLength(2);
    expect(groups[0].currency).toBe("AUD");
    expect(groups[0].totalCommitment).toBe(500000);
    expect(groups[1].currency).toBe("USD");
    expect(groups[1].totalCommitment).toBe(500000);
    expect(groups[1].totalNav).toBe(430000);
  });

  it("reports multi-currency in computeSleeveTotals", () => {
    const mixed: CommitmentInput[] = [
      { fundId: "f1", fundName: "A", currency: "AUD", commitmentAmount: 100000, fundedAmount: 50000, navAmount: 55000, distributionsAmount: 0 },
      { fundId: "f2", fundName: "B", currency: "USD", commitmentAmount: 200000, fundedAmount: 100000, navAmount: 110000, distributionsAmount: 0 },
    ];
    const totals = computeSleeveTotals(mixed, []);
    expect(totals.multiCurrency).toBe(true);
    expect(totals.byCurrency).toHaveLength(2);
  });
});

describe("summarizeCommitments", () => {
  it("adds unfundedAmount to each commitment", () => {
    const commitments: CommitmentInput[] = [
      { fundId: "f1", fundName: "Fund A", currency: "AUD", commitmentAmount: 500000, fundedAmount: 200000, navAmount: 220000, distributionsAmount: 10000 },
    ];
    const summaries = summarizeCommitments(commitments);
    expect(summaries[0].unfundedAmount).toBe(300000);
  });
});
