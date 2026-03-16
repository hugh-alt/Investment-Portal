import { describe, it, expect } from "vitest";
import { getNavForRole, getHomeRoute, SUPER_ADMIN_NAV, ADMIN_NAV, ADVISER_NAV } from "../nav-config";

describe("nav-config", () => {
  it("returns correct nav items per role", () => {
    expect(getNavForRole("SUPER_ADMIN")).toBe(SUPER_ADMIN_NAV);
    expect(getNavForRole("ADMIN")).toBe(ADMIN_NAV);
    expect(getNavForRole("ADVISER")).toBe(ADVISER_NAV);
  });

  it("defaults to ADVISER nav for unknown roles", () => {
    expect(getNavForRole("UNKNOWN")).toBe(ADVISER_NAV);
  });

  it("returns correct home routes per role", () => {
    expect(getHomeRoute("SUPER_ADMIN")).toBe("/platform");
    expect(getHomeRoute("ADMIN")).toBe("/admin");
    expect(getHomeRoute("ADVISER")).toBe("/adviser");
  });

  it("SUPER_ADMIN nav has 6 items", () => {
    expect(SUPER_ADMIN_NAV).toHaveLength(6);
  });

  it("ADMIN nav includes Policies group header", () => {
    const group = ADMIN_NAV.find((item) => item.isGroup && item.label === "Policies");
    expect(group).toBeDefined();
  });

  it("ADVISER nav includes Workflows group header", () => {
    const group = ADVISER_NAV.find((item) => item.isGroup && item.label === "Workflows");
    expect(group).toBeDefined();
  });

  it("all non-group nav items have valid href starting with /", () => {
    const allItems = [...SUPER_ADMIN_NAV, ...ADMIN_NAV, ...ADVISER_NAV];
    for (const item of allItems) {
      if (!item.isGroup) {
        expect(item.href).toMatch(/^\//);
      }
    }
  });
});
