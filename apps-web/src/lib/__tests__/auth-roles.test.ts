import { describe, it, expect } from "vitest";
import { hasRole, isAdmin, isSuperAdmin } from "../auth";
import type { Role } from "../../generated/prisma/enums";

describe("hasRole", () => {
  it("SUPER_ADMIN passes any role check", () => {
    const user = { role: "SUPER_ADMIN" };
    expect(hasRole(user, "ADMIN")).toBe(true);
    expect(hasRole(user, "ADVISER")).toBe(true);
    expect(hasRole(user, "ADMIN", "ADVISER")).toBe(true);
  });

  it("ADMIN passes when ADMIN is in the list", () => {
    const user = { role: "ADMIN" };
    expect(hasRole(user, "ADMIN")).toBe(true);
    expect(hasRole(user, "ADMIN", "ADVISER")).toBe(true);
  });

  it("ADMIN fails when only ADVISER is in the list", () => {
    expect(hasRole({ role: "ADMIN" }, "ADVISER")).toBe(false);
  });

  it("ADVISER passes when ADVISER is in the list", () => {
    expect(hasRole({ role: "ADVISER" }, "ADVISER")).toBe(true);
  });

  it("ADVISER fails when only ADMIN is in the list", () => {
    expect(hasRole({ role: "ADVISER" }, "ADMIN")).toBe(false);
  });
});

describe("isAdmin", () => {
  it("returns true for ADMIN", () => {
    expect(isAdmin({ role: "ADMIN" })).toBe(true);
  });

  it("returns true for SUPER_ADMIN", () => {
    expect(isAdmin({ role: "SUPER_ADMIN" })).toBe(true);
  });

  it("returns false for ADVISER", () => {
    expect(isAdmin({ role: "ADVISER" })).toBe(false);
  });
});

describe("isSuperAdmin", () => {
  it("returns true only for SUPER_ADMIN", () => {
    expect(isSuperAdmin({ role: "SUPER_ADMIN" })).toBe(true);
    expect(isSuperAdmin({ role: "ADMIN" })).toBe(false);
    expect(isSuperAdmin({ role: "ADVISER" })).toBe(false);
  });
});

describe("hasRole — platform-only guard pattern", () => {
  it("only SUPER_ADMIN passes a SUPER_ADMIN-only check", () => {
    const superOnly: Role[] = ["SUPER_ADMIN"];
    expect(hasRole({ role: "SUPER_ADMIN" }, ...superOnly)).toBe(true);
    expect(hasRole({ role: "ADMIN" }, ...superOnly)).toBe(false);
    expect(hasRole({ role: "ADVISER" }, ...superOnly)).toBe(false);
  });

  it("ADMIN + ADVISER check works for dual-access pages", () => {
    const both: Role[] = ["ADMIN", "ADVISER"];
    expect(hasRole({ role: "ADMIN" }, ...both)).toBe(true);
    expect(hasRole({ role: "ADVISER" }, ...both)).toBe(true);
    expect(hasRole({ role: "SUPER_ADMIN" }, ...both)).toBe(true);
  });
});
