/**
 * Pure waterfall recommendation logic for PM Sleeve.
 * Generates SELL or BUY legs based on product-specific ordered waterfalls.
 * Client-safe (no DB imports).
 */

export type WaterfallPosition = {
  productId: string;
  productName: string;
  productType: string;
  marketValue: number;
};

export type SellWaterfallEntry = {
  productId: string;
  maxSellPct: number; // 0–1: 0 = do-not-sell, 1 = can fully liquidate
};

export type BuyWaterfallEntry = {
  productId: string;
  maxBuyPct: number; // 0–1: fraction of excess to allocate (1 = no cap)
};

export type SellLeg = {
  productId: string;
  productName: string;
  amount: number;
  reason: string;
};

export type BuyLeg = {
  productId: string;
  productName: string;
  amount: number;
  reason: string;
};

export type SellRecommendation = {
  kind: "RAISE_LIQUIDITY";
  summary: string;
  legs: SellLeg[];
};

export type BuyRecommendation = {
  kind: "INVEST_EXCESS";
  summary: string;
  legs: BuyLeg[];
};

/**
 * Generate SELL legs to raise liquidity to cover a shortfall.
 *
 * Only considers products present in the sell waterfall (in that order).
 * For each entry:
 *   - maxSellPct == 0 → skip (do-not-sell)
 *   - maxSellAmount = positionValue * maxSellPct
 *   - sellAmount = min(maxSellAmount, remainingShortfall)
 *   - skip if sellAmount < minTradeAmount
 * If waterfall exhausted and shortfall remains, warns in summary.
 */
export function generateSellLegs(
  positions: WaterfallPosition[],
  sellWaterfall: SellWaterfallEntry[],
  shortfall: number,
  minTradeAmount: number,
): SellRecommendation | null {
  if (shortfall <= 0) return null;

  const positionMap = new Map(positions.map((p) => [p.productId, p]));
  const legs: SellLeg[] = [];
  let remaining = shortfall;

  for (let i = 0; i < sellWaterfall.length; i++) {
    if (remaining <= 0) break;

    const entry = sellWaterfall[i];
    if (entry.maxSellPct === 0) continue; // do-not-sell

    const pos = positionMap.get(entry.productId);
    if (!pos || pos.marketValue <= 0) continue;

    const maxSellAmount = Math.floor(pos.marketValue * entry.maxSellPct);
    const sellAmount = Math.min(maxSellAmount, remaining);

    if (sellAmount < minTradeAmount) continue;

    const pctLabel = entry.maxSellPct < 1
      ? `max ${(entry.maxSellPct * 100).toFixed(0)}%`
      : "up to 100%";

    legs.push({
      productId: pos.productId,
      productName: pos.productName,
      amount: Math.round(sellAmount),
      reason: `Waterfall #${i + 1}, ${pctLabel} of ${pos.productType}`,
    });

    remaining -= sellAmount;
  }

  if (legs.length === 0 && remaining > 0) return null;

  const totalRaised = legs.reduce((s, l) => s + l.amount, 0);
  const summary = remaining > 0
    ? `Raise $${totalRaised.toLocaleString()} of $${shortfall.toLocaleString()} needed — unable to fully cover shortfall with configured waterfall`
    : `Raise $${totalRaised.toLocaleString()} to cover liquidity shortfall`;

  return { kind: "RAISE_LIQUIDITY", summary, legs };
}

/**
 * Generate BUY legs to invest excess liquidity.
 *
 * Walks the buy waterfall in order. Distributes excess equally among
 * entries, respecting minTradeAmount.
 */
export function generateBuyLegs(
  positions: WaterfallPosition[],
  buyWaterfall: BuyWaterfallEntry[],
  excess: number,
  minTradeAmount: number,
): BuyRecommendation | null {
  if (excess <= 0) return null;

  const positionMap = new Map(positions.map((p) => [p.productId, p]));

  // Filter to entries that reference known products
  const validEntries = buyWaterfall.filter((e) => positionMap.has(e.productId));
  if (validEntries.length === 0) return null;

  const perPosition = Math.floor(excess / validEntries.length);
  const legs: BuyLeg[] = [];
  let allocated = 0;

  for (let i = 0; i < validEntries.length; i++) {
    const entry = validEntries[i];
    const pos = positionMap.get(entry.productId)!;
    const amount = Math.min(perPosition, excess - allocated);
    if (amount < minTradeAmount) continue;

    legs.push({
      productId: pos.productId,
      productName: pos.productName,
      amount: Math.round(amount),
      reason: `Waterfall #${i + 1}, buy ${pos.productType}`,
    });

    allocated += amount;
  }

  if (legs.length === 0) return null;

  const totalInvested = legs.reduce((s, l) => s + l.amount, 0);
  return {
    kind: "INVEST_EXCESS",
    summary: `Invest $${totalInvested.toLocaleString()} excess liquidity`,
    legs,
  };
}

/**
 * Compute excess liquidity beyond the required buffer.
 * Returns the amount above (required + excessThreshold).
 */
export function computeExcess(
  liquidBucketValue: number,
  totalRequired: number,
  excessThreshold: number = 5000,
): number {
  return Math.max(0, liquidBucketValue - totalRequired - excessThreshold);
}
