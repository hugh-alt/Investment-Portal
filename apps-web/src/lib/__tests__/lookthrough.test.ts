import { describe, it, expect } from "vitest";
import { MANAGED_UNDERLYINGS } from "../../../prisma/seed-holdings";

describe("look-through weights", () => {
  for (const [productId, underlyings] of Object.entries(MANAGED_UNDERLYINGS)) {
    it(`${productId} weights sum to 1.0`, () => {
      const total = underlyings.reduce((sum, u) => sum + u.weight, 0);
      expect(total).toBeCloseTo(1.0, 5);
    });

    it(`${productId} has at least 5 underlying holdings`, () => {
      expect(underlyings.length).toBeGreaterThanOrEqual(5);
    });

    it(`${productId} has all positive weights`, () => {
      for (const u of underlyings) {
        expect(u.weight).toBeGreaterThan(0);
      }
    });
  }
});
