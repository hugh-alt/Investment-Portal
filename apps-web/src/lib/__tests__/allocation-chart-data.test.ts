import { describe, it, expect } from "vitest";
import {
  buildSunburstByAssetClass,
  buildSunburstByProduct,
  buildTreemapData,
  type PMCommitmentSummary,
  type ProductHolding,
  type SleeveAllocationData,
} from "../allocation-chart-data";
import type { AllocationResult } from "../allocation";

const allocation: AllocationResult = {
  totalValue: 300000,
  buckets: [
    {
      riskBucketId: "rb-1",
      riskBucketName: "Growth",
      totalValue: 200000,
      pctOfTotal: 200000 / 300000,
      assetClasses: [
        { nodeId: "ac-1", nodeName: "Aus Equities", totalValue: 120000, pctOfTotal: 120000 / 300000 },
        { nodeId: "ac-2", nodeName: "Intl Equities", totalValue: 80000, pctOfTotal: 80000 / 300000 },
      ],
    },
    {
      riskBucketId: "rb-2",
      riskBucketName: "Defensive",
      totalValue: 100000,
      pctOfTotal: 100000 / 300000,
      assetClasses: [
        { nodeId: "ac-3", nodeName: "Fixed Income", totalValue: 100000, pctOfTotal: 100000 / 300000 },
      ],
    },
  ],
  unmapped: [],
};

const pmCommitments: PMCommitmentSummary[] = [
  { fundName: "PE Fund A", assetClassNodeId: "ac-1", funded: 30000, unfunded: 20000 },
];

const sleeveData: SleeveAllocationData = {
  liquidBucketValue: 50000,
  positions: [
    { productId: "sp1", productName: "AUD Cash", marketValue: 30000 },
    { productId: "sp2", productName: "USD Cash", marketValue: 20000 },
  ],
};

const productHoldings: ProductHolding[] = [
  { productId: "p1", productName: "BHP", marketValue: 50000, riskBucketId: "rb-1", riskBucketName: "Growth" },
  { productId: "p2", productName: "VGS", marketValue: 80000, riskBucketId: "rb-1", riskBucketName: "Growth" },
  { productId: "p3", productName: "Bonds", marketValue: 100000, riskBucketId: "rb-2", riskBucketName: "Defensive" },
];

describe("buildSunburstByAssetClass", () => {
  it("inner ring has Portfolio and Sleeve when sleeve data present", () => {
    const points = buildSunburstByAssetClass(allocation, [], sleeveData);
    expect(points.find((p) => p.id === "portfolio" && p.parent === "")).toBeTruthy();
    expect(points.find((p) => p.id === "sleeve" && p.parent === "")).toBeTruthy();
  });

  it("ring 2 has Growth/Defensive under Portfolio", () => {
    const points = buildSunburstByAssetClass(allocation);
    const growth = points.find((p) => p.id === "p-rb-1");
    expect(growth?.parent).toBe("portfolio");
    expect(growth?.name).toBe("Growth");
  });

  it("ring 3 has asset classes under risk buckets", () => {
    const points = buildSunburstByAssetClass(allocation);
    expect(points.find((p) => p.id === "p-ac-ac-1")?.parent).toBe("p-rb-1");
    expect(points.find((p) => p.id === "p-ac-ac-3")?.parent).toBe("p-rb-2");
  });

  it("ring 4 adds PM funded/unfunded", () => {
    const points = buildSunburstByAssetClass(allocation, pmCommitments);
    const funded = points.find((p) => p.name === "PE Fund A (Funded)");
    const unfunded = points.find((p) => p.name === "PE Fund A (Unfunded)");
    expect(funded?.custom?.isFunded).toBe(true);
    expect(funded?.value).toBe(30000);
    expect(unfunded?.custom?.isUnfunded).toBe(true);
    expect(unfunded?.value).toBe(20000);
  });

  it("sleeve positions appear under sleeve node", () => {
    const points = buildSunburstByAssetClass(allocation, [], sleeveData);
    const cashPos = points.find((p) => p.name === "AUD Cash");
    expect(cashPos?.parent).toBe("sleeve");
  });

  it("returns empty for zero total", () => {
    const empty: AllocationResult = { totalValue: 0, buckets: [], unmapped: [] };
    expect(buildSunburstByAssetClass(empty)).toHaveLength(0);
  });
});

describe("buildSunburstByProduct", () => {
  it("inner ring has Portfolio/Sleeve", () => {
    const points = buildSunburstByProduct(allocation, productHoldings, [], sleeveData);
    expect(points.find((p) => p.id === "portfolio")).toBeTruthy();
    expect(points.find((p) => p.id === "sleeve")).toBeTruthy();
  });

  it("products appear under their risk bucket", () => {
    const points = buildSunburstByProduct(allocation, productHoldings);
    expect(points.find((p) => p.id === "p-prod-p1")?.parent).toBe("p-rb-1");
    expect(points.find((p) => p.id === "p-prod-p3")?.parent).toBe("p-rb-2");
  });
});

describe("buildTreemapData", () => {
  it("has Portfolio and Sleeve top-level nodes", () => {
    const points = buildTreemapData(allocation, productHoldings, [], sleeveData);
    expect(points.find((p) => p.id === "portfolio")).toBeTruthy();
    expect(points.find((p) => p.id === "sleeve")).toBeTruthy();
  });

  it("PM funded/unfunded appear as children of asset class", () => {
    const points = buildTreemapData(allocation, productHoldings, pmCommitments);
    expect(points.find((p) => p.name === "PE Fund A (Funded)")?.custom?.isFunded).toBe(true);
    expect(points.find((p) => p.name === "PE Fund A (Unfunded)")?.custom?.isUnfunded).toBe(true);
  });

  it("includes unmapped bucket", () => {
    const withUnmapped: AllocationResult = {
      ...allocation,
      unmapped: [{ productId: "x", productName: "Unknown", marketValue: 5000 }],
    };
    const points = buildTreemapData(withUnmapped, productHoldings);
    expect(points.find((p) => p.id === "tm-unmapped")).toBeTruthy();
  });
});
