import { describe, it, expect } from "vitest";
import {
  generateRebalanceTrades,
  type RebalanceHolding,
  type RebalanceTarget,
} from "../rebalance";

const targets: RebalanceTarget[] = [
  { nodeId: "n-aus-eq", nodeName: "Australian Equities", targetWeight: 0.30, minWeight: 0.28, maxWeight: 0.32 },
  { nodeId: "n-intl-eq", nodeName: "International Equities", targetWeight: 0.25, minWeight: 0.23, maxWeight: 0.27 },
  { nodeId: "n-def-eq", nodeName: "Defensive Equities", targetWeight: 0.15, minWeight: 0.13, maxWeight: 0.17 },
  { nodeId: "n-fi", nodeName: "Fixed Income", targetWeight: 0.30, minWeight: 0.28, maxWeight: 0.32 },
];

describe("generateRebalanceTrades", () => {
  it("returns no trades when portfolio is within tolerance", () => {
    const holdings: RebalanceHolding[] = [
      { productId: "p1", productName: "BHP", marketValue: 30000, nodeId: "n-aus-eq", nodeName: "Australian Equities" },
      { productId: "p2", productName: "VGS", marketValue: 25000, nodeId: "n-intl-eq", nodeName: "International Equities" },
      { productId: "p3", productName: "TLS", marketValue: 15000, nodeId: "n-def-eq", nodeName: "Defensive Equities" },
      { productId: "p4", productName: "F1", marketValue: 30000, nodeId: "n-fi", nodeName: "Fixed Income" },
    ];
    const result = generateRebalanceTrades(holdings, targets);
    expect(result.trades).toHaveLength(0);
    expect(result.breachesBefore).toBe(0);
    expect(result.breachesAfter).toBe(0);
  });

  it("generates sells for overweight and buys for underweight", () => {
    // Aus Eq 45%, Intl 25%, Def 15%, FI 15% → Aus Eq overweight, FI underweight
    const holdings: RebalanceHolding[] = [
      { productId: "p1", productName: "BHP", marketValue: 25000, nodeId: "n-aus-eq", nodeName: "Australian Equities" },
      { productId: "p2", productName: "CBA", marketValue: 20000, nodeId: "n-aus-eq", nodeName: "Australian Equities" },
      { productId: "p3", productName: "VGS", marketValue: 25000, nodeId: "n-intl-eq", nodeName: "International Equities" },
      { productId: "p4", productName: "TLS", marketValue: 15000, nodeId: "n-def-eq", nodeName: "Defensive Equities" },
      { productId: "p5", productName: "F1", marketValue: 15000, nodeId: "n-fi", nodeName: "Fixed Income" },
    ];
    const result = generateRebalanceTrades(holdings, targets);
    expect(result.breachesBefore).toBeGreaterThan(0);

    const sells = result.trades.filter((t) => t.side === "SELL");
    const buys = result.trades.filter((t) => t.side === "BUY");
    expect(sells.length).toBeGreaterThan(0);
    expect(buys.length).toBeGreaterThan(0);

    // Sells should be from overweight Aus Eq, largest position first
    expect(sells[0].nodeId).toBe("n-aus-eq");
    expect(sells[0].productId).toBe("p1"); // BHP is largest at 25k

    // Buys should be in underweight FI
    expect(buys[0].nodeId).toBe("n-fi");

    // Total sells should roughly equal total buys
    const totalSell = sells.reduce((s, t) => s + t.amount, 0);
    const totalBuy = buys.reduce((s, t) => s + t.amount, 0);
    expect(totalBuy).toBeLessThanOrEqual(totalSell + 0.01);

    // After-drift should have fewer breaches
    expect(result.breachesAfter).toBeLessThan(result.breachesBefore);
  });

  it("respects minTradeAmount", () => {
    // Slightly out of tolerance — trades would be small
    const holdings: RebalanceHolding[] = [
      { productId: "p1", productName: "BHP", marketValue: 3300, nodeId: "n-aus-eq", nodeName: "Australian Equities" },
      { productId: "p2", productName: "VGS", marketValue: 2500, nodeId: "n-intl-eq", nodeName: "International Equities" },
      { productId: "p3", productName: "TLS", marketValue: 1500, nodeId: "n-def-eq", nodeName: "Defensive Equities" },
      { productId: "p4", productName: "F1", marketValue: 2700, nodeId: "n-fi", nodeName: "Fixed Income" },
    ];
    // Total = 10000, Aus Eq at 33% (slightly above 32% max)
    const result = generateRebalanceTrades(holdings, targets, { minTradeAmount: 500 });
    // The overweight amount is small, so no trades should be generated
    expect(result.trades).toHaveLength(0);
  });

  it("respects doNotTrade list", () => {
    const holdings: RebalanceHolding[] = [
      { productId: "p1", productName: "BHP", marketValue: 25000, nodeId: "n-aus-eq", nodeName: "Australian Equities" },
      { productId: "p2", productName: "CBA", marketValue: 20000, nodeId: "n-aus-eq", nodeName: "Australian Equities" },
      { productId: "p3", productName: "VGS", marketValue: 25000, nodeId: "n-intl-eq", nodeName: "International Equities" },
      { productId: "p4", productName: "TLS", marketValue: 15000, nodeId: "n-def-eq", nodeName: "Defensive Equities" },
      { productId: "p5", productName: "F1", marketValue: 15000, nodeId: "n-fi", nodeName: "Fixed Income" },
    ];
    const result = generateRebalanceTrades(holdings, targets, {
      doNotTradeProductIds: ["p1"], // BHP excluded from sells
    });
    const sells = result.trades.filter((t) => t.side === "SELL");
    expect(sells.every((t) => t.productId !== "p1")).toBe(true);
  });

  it("handles empty portfolio", () => {
    const result = generateRebalanceTrades([], targets);
    expect(result.trades).toHaveLength(0);
    expect(result.totalPortfolioValue).toBe(0);
  });

  it("handles empty targets", () => {
    const holdings: RebalanceHolding[] = [
      { productId: "p1", productName: "BHP", marketValue: 10000, nodeId: "n-aus-eq", nodeName: "Australian Equities" },
    ];
    const result = generateRebalanceTrades(holdings, []);
    expect(result.trades).toHaveLength(0);
  });

  it("sells largest positions first within overweight node", () => {
    const holdings: RebalanceHolding[] = [
      { productId: "p-small", productName: "Small", marketValue: 5000, nodeId: "n-aus-eq", nodeName: "Australian Equities" },
      { productId: "p-large", productName: "Large", marketValue: 40000, nodeId: "n-aus-eq", nodeName: "Australian Equities" },
      { productId: "p3", productName: "VGS", marketValue: 25000, nodeId: "n-intl-eq", nodeName: "International Equities" },
      { productId: "p4", productName: "TLS", marketValue: 15000, nodeId: "n-def-eq", nodeName: "Defensive Equities" },
      { productId: "p5", productName: "F1", marketValue: 15000, nodeId: "n-fi", nodeName: "Fixed Income" },
    ];
    const result = generateRebalanceTrades(holdings, targets);
    const sells = result.trades.filter((t) => t.side === "SELL");
    expect(sells.length).toBeGreaterThan(0);
    expect(sells[0].productId).toBe("p-large"); // largest sold first
  });
});
