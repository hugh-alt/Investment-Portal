import { describe, it, expect } from "vitest";

// Test the pure wealthGroupFilter function logic
// Extracted to avoid importing server-only modules

type UserLike = { role: string; wealthGroupId: string | null };

function wealthGroupFilter(user: UserLike): { wealthGroupId: string } | undefined {
  if (user.role === "SUPER_ADMIN") return undefined;
  if (!user.wealthGroupId) return { wealthGroupId: "__none__" };
  return { wealthGroupId: user.wealthGroupId };
}

describe("wealthGroupFilter", () => {
  it("returns undefined for SUPER_ADMIN (no filtering)", () => {
    const user: UserLike = { role: "SUPER_ADMIN", wealthGroupId: null };
    expect(wealthGroupFilter(user)).toBeUndefined();
  });

  it("returns undefined for SUPER_ADMIN even with a wealthGroupId", () => {
    const user: UserLike = { role: "SUPER_ADMIN", wealthGroupId: "wg-1" };
    expect(wealthGroupFilter(user)).toBeUndefined();
  });

  it("returns wealthGroupId filter for ADMIN", () => {
    const user: UserLike = { role: "ADMIN", wealthGroupId: "wg-demo" };
    expect(wealthGroupFilter(user)).toEqual({ wealthGroupId: "wg-demo" });
  });

  it("returns wealthGroupId filter for ADVISER", () => {
    const user: UserLike = { role: "ADVISER", wealthGroupId: "wg-demo" };
    expect(wealthGroupFilter(user)).toEqual({ wealthGroupId: "wg-demo" });
  });

  it("returns __none__ sentinel when ADMIN has no wealthGroupId", () => {
    const user: UserLike = { role: "ADMIN", wealthGroupId: null };
    expect(wealthGroupFilter(user)).toEqual({ wealthGroupId: "__none__" });
  });

  it("returns __none__ sentinel when ADVISER has no wealthGroupId", () => {
    const user: UserLike = { role: "ADVISER", wealthGroupId: null };
    expect(wealthGroupFilter(user)).toEqual({ wealthGroupId: "__none__" });
  });
});

describe("scoping integration logic", () => {
  it("composes wealthGroupFilter with additional where clauses", () => {
    const user: UserLike = { role: "ADMIN", wealthGroupId: "wg-1" };
    const wgFilter = wealthGroupFilter(user);
    const where = { ...wgFilter, status: "ACTIVE" };
    expect(where).toEqual({ wealthGroupId: "wg-1", status: "ACTIVE" });
  });

  it("SUPER_ADMIN composed where has no wealthGroupId key", () => {
    const user: UserLike = { role: "SUPER_ADMIN", wealthGroupId: null };
    const wgFilter = wealthGroupFilter(user);
    const where = { ...wgFilter, status: "ACTIVE" };
    expect(where).toEqual({ status: "ACTIVE" });
    expect("wealthGroupId" in where).toBe(false);
  });
});
