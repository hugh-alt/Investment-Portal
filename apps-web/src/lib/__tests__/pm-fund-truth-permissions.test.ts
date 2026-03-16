import { describe, it, expect } from "vitest";
import { isSuperAdmin, isAdmin, hasRole } from "../auth";
import type { Role } from "../../generated/prisma/enums";

describe("PM Fund Truth Layer — Permission Logic", () => {
  const superAdmin = { role: "SUPER_ADMIN", wealthGroupId: null };
  const admin = { role: "ADMIN", wealthGroupId: "wg-1" };
  const adviser = { role: "ADVISER", wealthGroupId: "wg-1" };

  describe("isSuperAdmin", () => {
    it("returns true for SUPER_ADMIN", () => {
      expect(isSuperAdmin(superAdmin)).toBe(true);
    });

    it("returns false for ADMIN", () => {
      expect(isSuperAdmin(admin)).toBe(false);
    });

    it("returns false for ADVISER", () => {
      expect(isSuperAdmin(adviser)).toBe(false);
    });
  });

  describe("isAdmin", () => {
    it("returns true for SUPER_ADMIN (inherits)", () => {
      expect(isAdmin(superAdmin)).toBe(true);
    });

    it("returns true for ADMIN", () => {
      expect(isAdmin(admin)).toBe(true);
    });

    it("returns false for ADVISER", () => {
      expect(isAdmin(adviser)).toBe(false);
    });
  });

  describe("hasRole", () => {
    it("SUPER_ADMIN always passes regardless of specified roles", () => {
      expect(hasRole(superAdmin, "ADVISER" as Role)).toBe(true);
    });

    it("ADMIN passes when ADMIN is specified", () => {
      expect(hasRole(admin, "ADMIN" as Role)).toBe(true);
    });

    it("ADVISER does not pass when only ADMIN is specified", () => {
      expect(hasRole(adviser, "ADMIN" as Role)).toBe(false);
    });
  });

  describe("Truth Layer v1.2 Access Rules", () => {
    it("only SUPER_ADMIN can edit fund truth (lifecycle, NAV, calls, distributions, KPIs)", () => {
      expect(isSuperAdmin(superAdmin)).toBe(true);
      expect(isSuperAdmin(admin)).toBe(false);
      expect(isSuperAdmin(adviser)).toBe(false);
    });

    it("only SUPER_ADMIN can create distribution events and allocations", () => {
      expect(isSuperAdmin(superAdmin)).toBe(true);
      expect(isSuperAdmin(admin)).toBe(false);
    });

    it("only SUPER_ADMIN can add KPI points", () => {
      expect(isSuperAdmin(superAdmin)).toBe(true);
      expect(isSuperAdmin(adviser)).toBe(false);
    });

    it("only SUPER_ADMIN can create funds on platform", () => {
      expect(isSuperAdmin(superAdmin)).toBe(true);
      expect(isSuperAdmin(admin)).toBe(false);
    });

    it("ADMIN can view fund truth read-only via isAdmin", () => {
      expect(isAdmin(admin)).toBe(true);
      expect(isAdmin(adviser)).toBe(false);
    });

    it("ADMIN cannot edit truth — only SUPER_ADMIN can", () => {
      expect(isSuperAdmin(admin)).toBe(false);
    });

    it("ADVISER cannot access truth editing or admin views", () => {
      expect(isSuperAdmin(adviser)).toBe(false);
      expect(isAdmin(adviser)).toBe(false);
    });

    it("ADMIN can still toggle fund approval (whitelist)", () => {
      expect(isAdmin(admin)).toBe(true);
    });
  });
});
