/**
 * Pure functions for sleeve liquid bucket management:
 * weight validation, cash product detection, mirror portfolio, reordering.
 */

const CASH_PRODUCT_IDS = ["__AUD_CASH__", "__USD_CASH__"];

/** Check if a product ID is a cash product (prefixed with __) */
export function isCashProduct(productId: string): boolean {
  return CASH_PRODUCT_IDS.includes(productId);
}

export interface WeightedEntry {
  productId: string;
  productName: string;
  weightPct: number; // 0-100
}

/**
 * Given a client's existing holdings (productId → marketValue), derive
 * proportional weights summing to 100%. Ensures AUD/USD Cash rows exist.
 */
export function mirrorPortfolioWeights(
  holdings: { productId: string; productName: string; marketValue: number }[],
): WeightedEntry[] {
  const total = holdings.reduce((s, h) => s + h.marketValue, 0);
  if (total === 0) return ensureCashEntries([]);

  const entries: WeightedEntry[] = holdings.map((h) => ({
    productId: h.productId,
    productName: h.productName,
    weightPct: +((h.marketValue / total) * 100).toFixed(2),
  }));

  return ensureCashEntries(entries);
}

/**
 * Validate that weights sum to 100% (within tolerance).
 * Returns null if valid, or an error message if not.
 */
export function validateWeightSum(entries: WeightedEntry[], tolerance = 0.5): string | null {
  const sum = entries.reduce((s, e) => s + e.weightPct, 0);
  if (Math.abs(sum - 100) > tolerance) {
    return `Weights sum to ${sum.toFixed(1)}%, must equal 100% (±${tolerance}%).`;
  }
  return null;
}

/**
 * Ensure AUD Cash and USD Cash rows exist in the entries list.
 * If they don't exist, add them with 0% weight.
 */
export function ensureCashEntries(entries: WeightedEntry[]): WeightedEntry[] {
  const result = [...entries];
  for (const cashId of CASH_PRODUCT_IDS) {
    if (!result.some((e) => e.productId === cashId)) {
      const name = cashId === "__AUD_CASH__" ? "AUD Cash" : "USD Cash";
      result.push({ productId: cashId, productName: name, weightPct: 0 });
    }
  }
  return result;
}

/** Move element at `fromIndex` up or down by one position. */
export function reorderArray<T>(arr: T[], fromIndex: number, direction: "up" | "down"): T[] {
  const result = [...arr];
  const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
  if (toIndex < 0 || toIndex >= result.length) return result;
  [result[fromIndex], result[toIndex]] = [result[toIndex], result[fromIndex]];
  return result;
}

/**
 * Convert weight-based allocations to dollar market values.
 * totalBucket is the total dollar value for the liquid bucket.
 */
export function weightsToDollars(
  entries: WeightedEntry[],
  totalBucket: number,
): { productId: string; productName: string; marketValue: number }[] {
  return entries
    .filter((e) => e.weightPct > 0)
    .map((e) => ({
      productId: e.productId,
      productName: e.productName,
      marketValue: +(totalBucket * (e.weightPct / 100)).toFixed(2),
    }));
}
