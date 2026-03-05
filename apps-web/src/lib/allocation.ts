/**
 * Pure allocation rollup: takes holdings + look-through + taxonomy mappings,
 * returns grouped allocations by risk bucket and asset class.
 * Client-safe (no DB imports).
 */

export type HoldingInput = {
  productId: string;
  productName: string;
  productType: string;
  marketValue: number;
  lookthrough: {
    underlyingProductId: string;
    underlyingProductName: string;
    underlyingMarketValue: number;
    weight: number;
  }[];
};

export type MappingInput = {
  productId: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  riskBucketId: string | null;
  riskBucketName: string | null;
};

export type AllocationBucket = {
  riskBucketId: string;
  riskBucketName: string;
  totalValue: number;
  pctOfTotal: number;
  assetClasses: {
    nodeId: string;
    nodeName: string;
    totalValue: number;
    pctOfTotal: number;
  }[];
};

export type AllocationResult = {
  totalValue: number;
  buckets: AllocationBucket[];
  unmapped: { productId: string; productName: string; marketValue: number }[];
};

/**
 * Compute allocation rollup.
 *
 * For MANAGED_PORTFOLIO holdings, we use look-through exposures (each underlying
 * is mapped individually). For all other holdings we map the top-level product.
 */
export function computeAllocation(
  holdings: HoldingInput[],
  mappings: MappingInput[],
): AllocationResult {
  const mapByProduct = new Map<string, MappingInput>();
  for (const m of mappings) {
    mapByProduct.set(m.productId, m);
  }

  // Accumulate value per node
  const nodeValues = new Map<string, number>();
  const unmapped: AllocationResult["unmapped"] = [];
  let totalValue = 0;

  for (const h of holdings) {
    totalValue += h.marketValue;

    if (h.productType === "MANAGED_PORTFOLIO" && h.lookthrough.length > 0) {
      // Use look-through: map each underlying
      for (const lt of h.lookthrough) {
        const m = mapByProduct.get(lt.underlyingProductId);
        if (m) {
          nodeValues.set(m.nodeId, (nodeValues.get(m.nodeId) ?? 0) + lt.underlyingMarketValue);
        } else {
          const existing = unmapped.find((u) => u.productId === lt.underlyingProductId);
          if (existing) {
            existing.marketValue += lt.underlyingMarketValue;
          } else {
            unmapped.push({
              productId: lt.underlyingProductId,
              productName: lt.underlyingProductName,
              marketValue: lt.underlyingMarketValue,
            });
          }
        }
      }
    } else {
      // Map top-level product
      const m = mapByProduct.get(h.productId);
      if (m) {
        nodeValues.set(m.nodeId, (nodeValues.get(m.nodeId) ?? 0) + h.marketValue);
      } else {
        unmapped.push({
          productId: h.productId,
          productName: h.productName,
          marketValue: h.marketValue,
        });
      }
    }
  }

  // Group into risk buckets
  const bucketMap = new Map<
    string,
    { name: string; assetClasses: Map<string, { name: string; value: number }> }
  >();

  for (const m of mappings) {
    const val = nodeValues.get(m.nodeId);
    if (!val || !m.riskBucketId || !m.riskBucketName) continue;

    if (!bucketMap.has(m.riskBucketId)) {
      bucketMap.set(m.riskBucketId, { name: m.riskBucketName, assetClasses: new Map() });
    }
    const bucket = bucketMap.get(m.riskBucketId)!;
    const existing = bucket.assetClasses.get(m.nodeId);
    if (existing) {
      existing.value += val;
    } else {
      bucket.assetClasses.set(m.nodeId, { name: m.nodeName, value: val });
    }
  }

  const buckets: AllocationBucket[] = [];
  for (const [riskBucketId, bucket] of bucketMap) {
    const assetClasses = Array.from(bucket.assetClasses.entries()).map(
      ([nodeId, { name, value }]) => ({
        nodeId,
        nodeName: name,
        totalValue: value,
        pctOfTotal: totalValue > 0 ? value / totalValue : 0,
      }),
    );
    assetClasses.sort((a, b) => b.totalValue - a.totalValue);

    const bucketTotal = assetClasses.reduce((s, ac) => s + ac.totalValue, 0);
    buckets.push({
      riskBucketId,
      riskBucketName: bucket.name,
      totalValue: bucketTotal,
      pctOfTotal: totalValue > 0 ? bucketTotal / totalValue : 0,
      assetClasses,
    });
  }
  buckets.sort((a, b) => b.totalValue - a.totalValue);

  return { totalValue, buckets, unmapped };
}
