import { describe, it, expect } from "vitest";
import {
  isCashProduct,
  mirrorPortfolioWeights,
  validateWeightSum,
  ensureCashEntries,
  reorderArray,
  weightsToDollars,
} from "../sleeve-liquid-bucket";

describe("isCashProduct", () => {
  it("returns true for AUD and USD cash IDs", () => {
    expect(isCashProduct("__AUD_CASH__")).toBe(true);
    expect(isCashProduct("__USD_CASH__")).toBe(true);
  });

  it("returns false for regular product IDs", () => {
    expect(isCashProduct("prod-bhp")).toBe(false);
    expect(isCashProduct("")).toBe(false);
  });
});

describe("ensureCashEntries", () => {
  it("adds missing cash rows with 0% weight", () => {
    const result = ensureCashEntries([]);
    expect(result).toHaveLength(2);
    expect(result.find((e) => e.productId === "__AUD_CASH__")?.weightPct).toBe(0);
    expect(result.find((e) => e.productId === "__USD_CASH__")?.weightPct).toBe(0);
  });

  it("does not duplicate existing cash rows", () => {
    const existing = [{ productId: "__AUD_CASH__", productName: "AUD Cash", weightPct: 10 }];
    const result = ensureCashEntries(existing);
    expect(result.filter((e) => e.productId === "__AUD_CASH__")).toHaveLength(1);
    expect(result.find((e) => e.productId === "__AUD_CASH__")?.weightPct).toBe(10);
    expect(result.find((e) => e.productId === "__USD_CASH__")?.weightPct).toBe(0);
  });
});

describe("mirrorPortfolioWeights", () => {
  it("derives proportional weights from holdings", () => {
    const holdings = [
      { productId: "A", productName: "Product A", marketValue: 60000 },
      { productId: "B", productName: "Product B", marketValue: 40000 },
    ];
    const result = mirrorPortfolioWeights(holdings);
    const a = result.find((e) => e.productId === "A");
    const b = result.find((e) => e.productId === "B");
    expect(a?.weightPct).toBe(60);
    expect(b?.weightPct).toBe(40);
  });

  it("ensures cash entries exist", () => {
    const result = mirrorPortfolioWeights([
      { productId: "X", productName: "X", marketValue: 100000 },
    ]);
    expect(result.some((e) => e.productId === "__AUD_CASH__")).toBe(true);
    expect(result.some((e) => e.productId === "__USD_CASH__")).toBe(true);
  });

  it("returns only cash entries for empty holdings", () => {
    const result = mirrorPortfolioWeights([]);
    expect(result).toHaveLength(2);
  });
});

describe("validateWeightSum", () => {
  it("returns null when weights sum to 100%", () => {
    const entries = [
      { productId: "A", productName: "A", weightPct: 60 },
      { productId: "B", productName: "B", weightPct: 40 },
    ];
    expect(validateWeightSum(entries)).toBeNull();
  });

  it("returns null within tolerance", () => {
    const entries = [
      { productId: "A", productName: "A", weightPct: 60 },
      { productId: "B", productName: "B", weightPct: 40.3 },
    ];
    expect(validateWeightSum(entries)).toBeNull();
  });

  it("returns error when sum is too far from 100%", () => {
    const entries = [
      { productId: "A", productName: "A", weightPct: 60 },
      { productId: "B", productName: "B", weightPct: 30 },
    ];
    expect(validateWeightSum(entries)).toContain("90.0%");
  });
});

describe("reorderArray", () => {
  it("moves an item up", () => {
    expect(reorderArray(["a", "b", "c"], 1, "up")).toEqual(["b", "a", "c"]);
  });

  it("moves an item down", () => {
    expect(reorderArray(["a", "b", "c"], 1, "down")).toEqual(["a", "c", "b"]);
  });

  it("does not move first item up", () => {
    expect(reorderArray(["a", "b", "c"], 0, "up")).toEqual(["a", "b", "c"]);
  });

  it("does not move last item down", () => {
    expect(reorderArray(["a", "b", "c"], 2, "down")).toEqual(["a", "b", "c"]);
  });
});

describe("weightsToDollars", () => {
  it("converts weights to dollar amounts", () => {
    const entries = [
      { productId: "A", productName: "A", weightPct: 60 },
      { productId: "B", productName: "B", weightPct: 40 },
    ];
    const result = weightsToDollars(entries, 100000);
    expect(result.find((e) => e.productId === "A")?.marketValue).toBe(60000);
    expect(result.find((e) => e.productId === "B")?.marketValue).toBe(40000);
  });

  it("excludes 0% entries", () => {
    const entries = [
      { productId: "A", productName: "A", weightPct: 100 },
      { productId: "B", productName: "B", weightPct: 0 },
    ];
    const result = weightsToDollars(entries, 50000);
    expect(result).toHaveLength(1);
  });
});
