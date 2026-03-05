import { describe, it, expect } from "vitest";
import { computeAllocation, type HoldingInput, type MappingInput } from "../allocation";

const MAPPINGS: MappingInput[] = [
  { productId: "p1", nodeId: "n-aus-eq", nodeName: "Aus Equities", nodeType: "ASSET_CLASS", riskBucketId: "rb-growth", riskBucketName: "Growth" },
  { productId: "p2", nodeId: "n-intl-eq", nodeName: "Intl Equities", nodeType: "ASSET_CLASS", riskBucketId: "rb-growth", riskBucketName: "Growth" },
  { productId: "p3", nodeId: "n-fi", nodeName: "Fixed Income", nodeType: "ASSET_CLASS", riskBucketId: "rb-def", riskBucketName: "Defensive" },
];

describe("computeAllocation", () => {
  it("groups direct holdings by risk bucket", () => {
    const holdings: HoldingInput[] = [
      { productId: "p1", productName: "BHP", productType: "DIRECT", marketValue: 10000, lookthrough: [] },
      { productId: "p3", productName: "Gov Bond", productType: "DIRECT", marketValue: 5000, lookthrough: [] },
    ];
    const result = computeAllocation(holdings, MAPPINGS);

    expect(result.totalValue).toBe(15000);
    expect(result.buckets).toHaveLength(2);
    expect(result.unmapped).toHaveLength(0);

    const growth = result.buckets.find((b) => b.riskBucketName === "Growth")!;
    expect(growth.totalValue).toBe(10000);
    expect(growth.pctOfTotal).toBeCloseTo(10000 / 15000);

    const def = result.buckets.find((b) => b.riskBucketName === "Defensive")!;
    expect(def.totalValue).toBe(5000);
  });

  it("uses look-through for managed portfolios", () => {
    const holdings: HoldingInput[] = [
      {
        productId: "mp1", productName: "Managed Fund", productType: "MANAGED_PORTFOLIO", marketValue: 100000,
        lookthrough: [
          { underlyingProductId: "p1", underlyingProductName: "BHP", underlyingMarketValue: 60000, weight: 0.6 },
          { underlyingProductId: "p3", underlyingProductName: "Gov Bond", underlyingMarketValue: 40000, weight: 0.4 },
        ],
      },
    ];
    const result = computeAllocation(holdings, MAPPINGS);

    expect(result.totalValue).toBe(100000);
    const growth = result.buckets.find((b) => b.riskBucketName === "Growth")!;
    expect(growth.totalValue).toBe(60000);
    const def = result.buckets.find((b) => b.riskBucketName === "Defensive")!;
    expect(def.totalValue).toBe(40000);
  });

  it("reports unmapped products", () => {
    const holdings: HoldingInput[] = [
      { productId: "p1", productName: "BHP", productType: "DIRECT", marketValue: 10000, lookthrough: [] },
      { productId: "unknown", productName: "Mystery Fund", productType: "FUND", marketValue: 5000, lookthrough: [] },
    ];
    const result = computeAllocation(holdings, MAPPINGS);

    expect(result.unmapped).toHaveLength(1);
    expect(result.unmapped[0].productName).toBe("Mystery Fund");
    expect(result.unmapped[0].marketValue).toBe(5000);
  });

  it("reports unmapped look-through underlyings", () => {
    const holdings: HoldingInput[] = [
      {
        productId: "mp1", productName: "Managed", productType: "MANAGED_PORTFOLIO", marketValue: 100000,
        lookthrough: [
          { underlyingProductId: "p1", underlyingProductName: "BHP", underlyingMarketValue: 50000, weight: 0.5 },
          { underlyingProductId: "unmapped", underlyingProductName: "Unknown", underlyingMarketValue: 50000, weight: 0.5 },
        ],
      },
    ];
    const result = computeAllocation(holdings, MAPPINGS);
    expect(result.unmapped).toHaveLength(1);
    expect(result.unmapped[0].productId).toBe("unmapped");
  });

  it("bucket percentages sum to ≤ 1 (remainder is unmapped)", () => {
    const holdings: HoldingInput[] = [
      { productId: "p1", productName: "BHP", productType: "DIRECT", marketValue: 60000, lookthrough: [] },
      { productId: "p3", productName: "Bond", productType: "DIRECT", marketValue: 30000, lookthrough: [] },
      { productId: "xxx", productName: "Unmapped", productType: "FUND", marketValue: 10000, lookthrough: [] },
    ];
    const result = computeAllocation(holdings, MAPPINGS);
    const pctSum = result.buckets.reduce((s, b) => s + b.pctOfTotal, 0);
    expect(pctSum).toBeCloseTo(0.9); // 90% mapped
  });

  it("handles empty holdings", () => {
    const result = computeAllocation([], MAPPINGS);
    expect(result.totalValue).toBe(0);
    expect(result.buckets).toHaveLength(0);
    expect(result.unmapped).toHaveLength(0);
  });
});
