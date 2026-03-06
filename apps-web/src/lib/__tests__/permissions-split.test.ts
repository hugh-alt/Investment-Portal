import { describe, it, expect } from "vitest";

/**
 * Tests for the permissions split logic:
 * - Fund approvals are scoped by wealth group
 * - Approved fund filtering respects wealth group
 */

type Approval = {
  fundId: string;
  wealthGroupId: string | null;
  isApproved: boolean;
};

type Fund = {
  id: string;
  name: string;
  approvals: Approval[];
};

/** Simulates the approved funds query filter logic */
function getApprovedFundsForGroup(funds: Fund[], wealthGroupId: string | null): Fund[] {
  return funds.filter((f) =>
    f.approvals.some(
      (a) =>
        a.isApproved &&
        (wealthGroupId ? a.wealthGroupId === wealthGroupId : true),
    ),
  );
}

/** Simulates fund list isApproved resolution for a specific wealth group */
function resolveFundApproval(fund: Fund, wealthGroupId: string | null): boolean {
  if (!wealthGroupId) {
    // SUPER_ADMIN sees all approvals
    return fund.approvals.some((a) => a.isApproved);
  }
  return fund.approvals.some(
    (a) => a.isApproved && a.wealthGroupId === wealthGroupId,
  );
}

const testFunds: Fund[] = [
  {
    id: "fund-1",
    name: "Infrastructure Fund",
    approvals: [
      { fundId: "fund-1", wealthGroupId: "wg-1", isApproved: true },
      { fundId: "fund-1", wealthGroupId: "wg-2", isApproved: false },
    ],
  },
  {
    id: "fund-2",
    name: "PE Fund",
    approvals: [
      { fundId: "fund-2", wealthGroupId: "wg-1", isApproved: true },
      { fundId: "fund-2", wealthGroupId: "wg-2", isApproved: true },
    ],
  },
  {
    id: "fund-3",
    name: "VC Fund",
    approvals: [
      { fundId: "fund-3", wealthGroupId: "wg-1", isApproved: false },
      { fundId: "fund-3", wealthGroupId: "wg-2", isApproved: true },
    ],
  },
];

describe("fund approval scoping by wealth group", () => {
  it("wg-1 sees funds 1 and 2 as approved", () => {
    const approved = getApprovedFundsForGroup(testFunds, "wg-1");
    expect(approved.map((f) => f.id)).toEqual(["fund-1", "fund-2"]);
  });

  it("wg-2 sees funds 2 and 3 as approved", () => {
    const approved = getApprovedFundsForGroup(testFunds, "wg-2");
    expect(approved.map((f) => f.id)).toEqual(["fund-2", "fund-3"]);
  });

  it("SUPER_ADMIN (null wealthGroupId) sees all approved funds", () => {
    const approved = getApprovedFundsForGroup(testFunds, null);
    expect(approved.map((f) => f.id)).toEqual(["fund-1", "fund-2", "fund-3"]);
  });

  it("resolves approval correctly for wg-1", () => {
    expect(resolveFundApproval(testFunds[0], "wg-1")).toBe(true);
    expect(resolveFundApproval(testFunds[2], "wg-1")).toBe(false);
  });

  it("resolves approval correctly for wg-2", () => {
    expect(resolveFundApproval(testFunds[0], "wg-2")).toBe(false);
    expect(resolveFundApproval(testFunds[2], "wg-2")).toBe(true);
  });

  it("fund with no approvals for a group is not approved", () => {
    const noApprovalFund: Fund = {
      id: "fund-4",
      name: "New Fund",
      approvals: [],
    };
    expect(resolveFundApproval(noApprovalFund, "wg-1")).toBe(false);
    expect(getApprovedFundsForGroup([noApprovalFund], "wg-1")).toEqual([]);
  });
});
