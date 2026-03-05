import { describe, it, expect } from "vitest";
import {
  generateSellLegs,
  generateBuyLegs,
  computeExcess,
  type WaterfallPosition,
  type SellWaterfallEntry,
  type BuyWaterfallEntry,
} from "../waterfall";

const positions: WaterfallPosition[] = [
  { productId: "p1", productName: "Vanguard Intl Shares ETF", productType: "ETF", marketValue: 10000 },
  { productId: "p2", productName: "BHP Group", productType: "DIRECT", marketValue: 8000 },
  { productId: "p3", productName: "Australian Foundation Fund", productType: "FUND", marketValue: 12000 },
  { productId: "p4", productName: "CBA", productType: "DIRECT", marketValue: 5000 },
];

describe("generateSellLegs", () => {
  it("returns null when no shortfall", () => {
    const wf: SellWaterfallEntry[] = [{ productId: "p1", maxSellPct: 1 }];
    expect(generateSellLegs(positions, wf, 0, 1000)).toBeNull();
  });

  it("sells in waterfall order respecting maxSellPct", () => {
    const wf: SellWaterfallEntry[] = [
      { productId: "p1", maxSellPct: 1.0 },  // can sell up to 10k
      { productId: "p2", maxSellPct: 0.5 },  // can sell up to 4k
    ];
    // shortfall=12k: p1 sells 10k, p2 sells 2k (capped by remaining, max would be 4k)
    const result = generateSellLegs(positions, wf, 12000, 1000);
    expect(result).not.toBeNull();
    expect(result!.legs).toHaveLength(2);
    expect(result!.legs[0]).toMatchObject({ productId: "p1", amount: 10000 });
    expect(result!.legs[1]).toMatchObject({ productId: "p2", amount: 2000 });
    expect(result!.summary).not.toContain("unable");
  });

  it("caps sell amount at maxSellPct of position value", () => {
    const wf: SellWaterfallEntry[] = [
      { productId: "p1", maxSellPct: 0.25 }, // max sell = 2500
    ];
    // shortfall=5000 but can only sell 2500
    const result = generateSellLegs(positions, wf, 5000, 1000);
    expect(result).not.toBeNull();
    expect(result!.legs).toHaveLength(1);
    expect(result!.legs[0].amount).toBe(2500);
    expect(result!.summary).toContain("unable to fully cover");
  });

  it("skips do-not-sell products (maxSellPct = 0)", () => {
    const wf: SellWaterfallEntry[] = [
      { productId: "p1", maxSellPct: 0 },    // do-not-sell
      { productId: "p2", maxSellPct: 1.0 },  // sell up to 8k
    ];
    const result = generateSellLegs(positions, wf, 5000, 1000);
    expect(result).not.toBeNull();
    expect(result!.legs).toHaveLength(1);
    expect(result!.legs[0].productId).toBe("p2"); // p1 skipped
    expect(result!.legs[0].amount).toBe(5000);
  });

  it("do-not-sell is respected even when needed to cover shortfall", () => {
    const wf: SellWaterfallEntry[] = [
      { productId: "p1", maxSellPct: 0 },    // do-not-sell, 10k
      { productId: "p4", maxSellPct: 1.0 },  // can sell 5k
    ];
    // shortfall=8k, p1 blocked, p4 sells 5k → 3k uncovered
    const result = generateSellLegs(positions, wf, 8000, 1000);
    expect(result).not.toBeNull();
    expect(result!.legs).toHaveLength(1);
    expect(result!.legs[0].productId).toBe("p4");
    expect(result!.legs[0].amount).toBe(5000);
    expect(result!.summary).toContain("unable to fully cover");
  });

  it("only considers products in the waterfall — ignores unlisted positions", () => {
    const wf: SellWaterfallEntry[] = [
      { productId: "p1", maxSellPct: 1.0 },
      // p2, p3, p4 not in waterfall → ignored
    ];
    // shortfall=15k, only p1 sellable (10k)
    const result = generateSellLegs(positions, wf, 15000, 1000);
    expect(result).not.toBeNull();
    expect(result!.legs).toHaveLength(1);
    expect(result!.legs[0].amount).toBe(10000);
    expect(result!.summary).toContain("unable to fully cover");
  });

  it("respects minTradeAmount", () => {
    const wf: SellWaterfallEntry[] = [
      { productId: "p1", maxSellPct: 0.05 }, // max sell = 500 < minTrade 1000
      { productId: "p2", maxSellPct: 1.0 },
    ];
    const result = generateSellLegs(positions, wf, 3000, 1000);
    expect(result).not.toBeNull();
    expect(result!.legs).toHaveLength(1);
    expect(result!.legs[0].productId).toBe("p2"); // p1 skipped (500 < 1000)
  });

  it("produces multi-leg result with varying maxSellPct", () => {
    const wf: SellWaterfallEntry[] = [
      { productId: "p1", maxSellPct: 0.50 },  // max 5k
      { productId: "p3", maxSellPct: 1.0 },   // max 12k
      { productId: "p2", maxSellPct: 0.25 },  // max 2k
    ];
    // shortfall=15k: p1 sells 5k, p3 sells 10k → covered
    const result = generateSellLegs(positions, wf, 15000, 1000);
    expect(result).not.toBeNull();
    expect(result!.legs).toHaveLength(2);
    expect(result!.legs[0]).toMatchObject({ productId: "p1", amount: 5000 });
    expect(result!.legs[1]).toMatchObject({ productId: "p3", amount: 10000 });
    expect(result!.summary).not.toContain("unable");
  });

  it("returns null when all entries are do-not-sell", () => {
    const wf: SellWaterfallEntry[] = [
      { productId: "p1", maxSellPct: 0 },
      { productId: "p2", maxSellPct: 0 },
    ];
    expect(generateSellLegs(positions, wf, 5000, 1000)).toBeNull();
  });

  it("reason includes waterfall position and maxSellPct", () => {
    const wf: SellWaterfallEntry[] = [
      { productId: "p1", maxSellPct: 0.25 },
    ];
    const result = generateSellLegs(positions, wf, 2000, 1000);
    expect(result).not.toBeNull();
    expect(result!.legs[0].reason).toContain("Waterfall #1");
    expect(result!.legs[0].reason).toContain("max 25%");
  });

  it("shows 'up to 100%' for fully liquidatable entries", () => {
    const wf: SellWaterfallEntry[] = [
      { productId: "p1", maxSellPct: 1.0 },
    ];
    const result = generateSellLegs(positions, wf, 5000, 1000);
    expect(result).not.toBeNull();
    expect(result!.legs[0].reason).toContain("up to 100%");
  });
});

describe("generateBuyLegs", () => {
  it("returns null when no excess", () => {
    const wf: BuyWaterfallEntry[] = [{ productId: "p1", maxBuyPct: 1 }];
    expect(generateBuyLegs(positions, wf, 0, 1000)).toBeNull();
  });

  it("distributes excess among waterfall entries", () => {
    const wf: BuyWaterfallEntry[] = [{ productId: "p1", maxBuyPct: 1 }];
    const result = generateBuyLegs(positions, wf, 10000, 1000);
    expect(result).not.toBeNull();
    expect(result!.legs).toHaveLength(1);
    expect(result!.legs[0]).toMatchObject({ productId: "p1", amount: 10000 });
  });

  it("distributes equally among multiple entries", () => {
    const wf: BuyWaterfallEntry[] = [
      { productId: "p2", maxBuyPct: 1 },
      { productId: "p4", maxBuyPct: 1 },
    ];
    const result = generateBuyLegs(positions, wf, 10000, 1000);
    expect(result).not.toBeNull();
    expect(result!.legs).toHaveLength(2);
    expect(result!.legs[0].amount).toBe(5000);
    expect(result!.legs[1].amount).toBe(5000);
  });

  it("returns null when no waterfall entries match positions", () => {
    const wf: BuyWaterfallEntry[] = [{ productId: "unknown", maxBuyPct: 1 }];
    expect(generateBuyLegs(positions, wf, 10000, 1000)).toBeNull();
  });

  it("skips legs below minTradeAmount", () => {
    const wf: BuyWaterfallEntry[] = [
      { productId: "p1", maxBuyPct: 1 },
      { productId: "p2", maxBuyPct: 1 },
      { productId: "p3", maxBuyPct: 1 },
      { productId: "p4", maxBuyPct: 1 },
    ];
    // 3000 / 4 = 750 each < 1000 min
    expect(generateBuyLegs(positions, wf, 3000, 1000)).toBeNull();
  });

  it("reason includes waterfall position", () => {
    const wf: BuyWaterfallEntry[] = [{ productId: "p1", maxBuyPct: 1 }];
    const result = generateBuyLegs(positions, wf, 5000, 1000);
    expect(result).not.toBeNull();
    expect(result!.legs[0].reason).toContain("Waterfall #1");
  });
});

describe("computeExcess", () => {
  it("returns 0 when no excess", () => {
    expect(computeExcess(50000, 50000)).toBe(0);
  });

  it("returns 0 when within threshold", () => {
    expect(computeExcess(54000, 50000, 5000)).toBe(0);
  });

  it("returns excess above threshold", () => {
    expect(computeExcess(60000, 50000, 5000)).toBe(5000);
  });

  it("uses default 5000 threshold", () => {
    expect(computeExcess(60000, 50000)).toBe(5000);
  });
});
