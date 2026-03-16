import { describe, it, expect } from "vitest";
import {
  fmt4dp,
  fmtNav,
  fmtPct,
  deriveCallAmount,
  computeDistributionAllocations,
  type CommitmentForAllocation,
} from "../pm-fund-truth";

describe("pm-fund-truth", () => {
  // ── Formatting ──

  describe("fmt4dp", () => {
    it("formats to exactly 4 decimal places", () => {
      expect(fmt4dp(1.23456789)).toBe("1.2346");
      expect(fmt4dp(100)).toBe("100.0000");
      expect(fmt4dp(0.1)).toBe("0.1000");
    });
  });

  describe("fmtNav", () => {
    it("formats with currency prefix and 4dp", () => {
      const result = fmtNav(1234.5678, "AUD");
      expect(result).toContain("AUD");
      // locale may use comma or space separators, just check 4dp suffix
      expect(result).toMatch(/5678$/);
    });
  });

  describe("fmtPct", () => {
    it("formats 0..1 as percentage with 2dp", () => {
      expect(fmtPct(0.025)).toBe("2.50%");
      expect(fmtPct(0.1)).toBe("10.00%");
      expect(fmtPct(1)).toBe("100.00%");
    });
  });

  // ── Call Derivation ──

  describe("deriveCallAmount", () => {
    it("multiplies callPct by commitmentAmount", () => {
      expect(deriveCallAmount(0.025, 500000)).toBe(12500);
    });

    it("rounds to 2 decimal places", () => {
      expect(deriveCallAmount(0.033, 100000)).toBe(3300);
    });

    it("handles zero callPct", () => {
      expect(deriveCallAmount(0, 500000)).toBe(0);
    });

    it("handles zero commitment", () => {
      expect(deriveCallAmount(0.1, 0)).toBe(0);
    });
  });

  // ── Distribution Allocation ──

  describe("computeDistributionAllocations", () => {
    const commitments: CommitmentForAllocation[] = [
      { id: "c1", commitmentAmount: 500000, fundedAmount: 200000 },
      { id: "c2", commitmentAmount: 300000, fundedAmount: 100000 },
      { id: "c3", commitmentAmount: 200000, fundedAmount: 150000 },
    ];

    it("allocates pro-rata by commitment", () => {
      const result = computeDistributionAllocations(100000, commitments, "PRO_RATA_COMMITMENT");
      expect(result).toHaveLength(3);
      // Total commitment = 1M. c1=50%, c2=30%, c3=20%
      expect(result[0].amount).toBe(50000);
      expect(result[1].amount).toBe(30000);
      expect(result[2].amount).toBe(20000);
    });

    it("allocates pro-rata by paid-in", () => {
      const result = computeDistributionAllocations(100000, commitments, "PRO_RATA_PAIDIN");
      // Total funded = 450k. c1=200/450=44.4%, c2=100/450=22.2%, c3=150/450=33.3%
      expect(result).toHaveLength(3);
      const sum = result.reduce((s, r) => s + r.amount, 0);
      expect(Math.round(sum * 100) / 100).toBe(100000);
    });

    it("allocations sum to totalAmount (rounding test)", () => {
      const result = computeDistributionAllocations(99999.99, commitments, "PRO_RATA_COMMITMENT");
      const sum = result.reduce((s, r) => s + r.amount, 0);
      expect(Math.round(sum * 100) / 100).toBe(99999.99);
    });

    it("handles single commitment", () => {
      const result = computeDistributionAllocations(50000, [commitments[0]], "PRO_RATA_COMMITMENT");
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(50000);
      expect(result[0].commitmentId).toBe("c1");
    });

    it("handles empty commitments", () => {
      const result = computeDistributionAllocations(50000, [], "PRO_RATA_COMMITMENT");
      expect(result).toHaveLength(0);
    });

    it("computes pctOfCommitment for each allocation", () => {
      const result = computeDistributionAllocations(100000, commitments, "PRO_RATA_COMMITMENT");
      // c1: 50000/500000 = 0.1
      expect(result[0].pctOfCommitment).toBe(0.1);
      // c2: 30000/300000 = 0.1
      expect(result[1].pctOfCommitment).toBe(0.1);
    });

    it("handles zero-weight commitments with equal split", () => {
      const zeroCommitments: CommitmentForAllocation[] = [
        { id: "z1", commitmentAmount: 100, fundedAmount: 0 },
        { id: "z2", commitmentAmount: 100, fundedAmount: 0 },
      ];
      const result = computeDistributionAllocations(1000, zeroCommitments, "PRO_RATA_PAIDIN");
      const sum = result.reduce((s, r) => s + r.amount, 0);
      expect(Math.round(sum * 100) / 100).toBe(1000);
    });

    it("remainder goes to largest allocation", () => {
      // With 3 commitments at 1/3 each, $100 can't split evenly
      const equalCommits: CommitmentForAllocation[] = [
        { id: "e1", commitmentAmount: 100, fundedAmount: 100 },
        { id: "e2", commitmentAmount: 100, fundedAmount: 100 },
        { id: "e3", commitmentAmount: 100, fundedAmount: 100 },
      ];
      const result = computeDistributionAllocations(100, equalCommits, "PRO_RATA_COMMITMENT");
      const sum = result.reduce((s, r) => s + r.amount, 0);
      expect(Math.round(sum * 100) / 100).toBe(100);
      // One of them should have the extra penny
      const amounts = result.map((r) => r.amount).sort();
      expect(amounts).toEqual([33.33, 33.33, 33.34]);
    });
  });
});
