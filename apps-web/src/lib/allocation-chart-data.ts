/**
 * Pure functions to transform AllocationResult + sleeve data into
 * Highcharts sunburst / treemap data points.
 *
 * Hierarchy (Radial / Sunburst):
 *   Ring 1 (inner): Portfolio / Sleeve
 *   Ring 2: Growth / Defensive
 *   Ring 3: Asset Class  (or Product in "View by Product" mode)
 *   Ring 4 (outer): Funded / Unfunded (PM only)
 *
 * Hierarchy (Tree / Treemap):
 *   Level 1: Portfolio / Sleeve
 *   Level 2: Asset Class
 *   Level 3: Sub-Asset Class (if exists) or Product
 *   Level 4: Product
 */

import type { AllocationResult } from "./allocation";

// ── Types ────────────────────────────────────────────────

export type PMCommitmentSummary = {
  fundName: string;
  assetClassNodeId: string;
  funded: number;
  unfunded: number;
};

export type ProductHolding = {
  productId: string;
  productName: string;
  marketValue: number;
  riskBucketId: string | null;
  riskBucketName: string | null;
  /** Whether this product is in the sleeve liquid bucket */
  isSleeve?: boolean;
  assetClassNodeId?: string;
};

export type SleeveAllocationData = {
  liquidBucketValue: number;
  positions: { productId: string; productName: string; marketValue: number }[];
};

export type SunburstPoint = {
  id: string;
  parent: string;
  name: string;
  value: number;
  color?: string;
  custom?: { pctOfTotal: number; isFunded?: boolean; isUnfunded?: boolean };
};

// ── Colors ───────────────────────────────────────────────

const PORTFOLIO_COLOR = "#3b82f6";  // blue-500
const SLEEVE_COLOR = "#8b5cf6";     // violet-500

const BUCKET_COLORS: Record<string, Record<string, string>> = {
  portfolio: { Growth: "#60a5fa", Defensive: "#34d399" },   // blue-400, emerald-400
  sleeve: { Growth: "#a78bfa", Defensive: "#6ee7b7" },      // violet-400, emerald-300
};

const ASSET_SHADES: Record<string, string[]> = {
  Growth: ["#93c5fd", "#bfdbfe", "#60a5fa", "#3b82f6", "#2563eb"],
  Defensive: ["#86efac", "#bbf7d0", "#4ade80", "#22c55e", "#16a34a"],
};

const SLEEVE_ASSET_SHADES: Record<string, string[]> = {
  Growth: ["#c4b5fd", "#ddd6fe", "#a78bfa", "#8b5cf6", "#7c3aed"],
  Defensive: ["#a7f3d0", "#d1fae5", "#6ee7b7", "#34d399", "#10b981"],
};

export const PM_FUNDED_COLOR = "#7c3aed";   // violet-600
export const PM_UNFUNDED_COLOR = "#ddd6fe"; // violet-200

const FALLBACK_COLOR = "#a1a1aa";

// ── Sunburst: View by Asset Class ────────────────────────

export function buildSunburstByAssetClass(
  allocation: AllocationResult,
  pmCommitments: PMCommitmentSummary[] = [],
  sleeveData: SleeveAllocationData | null = null,
): SunburstPoint[] {
  const points: SunburstPoint[] = [];
  const total = allocation.totalValue + (sleeveData?.liquidBucketValue ?? 0);
  if (total === 0) return [];

  // Ring 1: Portfolio / Sleeve
  const portfolioValue = allocation.totalValue;
  points.push({
    id: "portfolio",
    parent: "",
    name: "Portfolio",
    value: portfolioValue,
    color: PORTFOLIO_COLOR,
    custom: { pctOfTotal: portfolioValue / total },
  });

  if (sleeveData && sleeveData.liquidBucketValue > 0) {
    points.push({
      id: "sleeve",
      parent: "",
      name: "Sleeve",
      value: sleeveData.liquidBucketValue,
      color: SLEEVE_COLOR,
      custom: { pctOfTotal: sleeveData.liquidBucketValue / total },
    });
  }

  // Ring 2 + 3: Growth/Defensive → Asset Classes (under Portfolio)
  for (const bucket of allocation.buckets) {
    const bucketId = `p-${bucket.riskBucketId}`;
    points.push({
      id: bucketId,
      parent: "portfolio",
      name: bucket.riskBucketName,
      value: bucket.totalValue,
      color: BUCKET_COLORS.portfolio[bucket.riskBucketName] ?? FALLBACK_COLOR,
      custom: { pctOfTotal: bucket.pctOfTotal },
    });

    const shades = ASSET_SHADES[bucket.riskBucketName] ?? [];
    for (let i = 0; i < bucket.assetClasses.length; i++) {
      const ac = bucket.assetClasses[i];
      const acId = `p-ac-${ac.nodeId}`;
      points.push({
        id: acId,
        parent: bucketId,
        name: ac.nodeName,
        value: ac.totalValue,
        color: shades[i % shades.length] ?? FALLBACK_COLOR,
        custom: { pctOfTotal: ac.pctOfTotal },
      });

      // Ring 4: PM funded/unfunded
      for (const pm of pmCommitments.filter((c) => c.assetClassNodeId === ac.nodeId)) {
        if (pm.funded > 0) {
          points.push({
            id: `pm-f-${pm.fundName}-${ac.nodeId}`,
            parent: acId,
            name: `${pm.fundName} (Funded)`,
            value: pm.funded,
            color: PM_FUNDED_COLOR,
            custom: { pctOfTotal: pm.funded / total, isFunded: true },
          });
        }
        if (pm.unfunded > 0) {
          points.push({
            id: `pm-u-${pm.fundName}-${ac.nodeId}`,
            parent: acId,
            name: `${pm.fundName} (Unfunded)`,
            value: pm.unfunded,
            color: PM_UNFUNDED_COLOR,
            custom: { pctOfTotal: pm.unfunded / total, isUnfunded: true },
          });
        }
      }
    }
  }

  // Sleeve positions (simplified — no taxonomy mapping, just products under Sleeve)
  if (sleeveData && sleeveData.positions.length > 0) {
    for (let i = 0; i < sleeveData.positions.length; i++) {
      const pos = sleeveData.positions[i];
      const slShades = SLEEVE_ASSET_SHADES.Growth;
      points.push({
        id: `s-pos-${pos.productId}`,
        parent: "sleeve",
        name: pos.productName,
        value: pos.marketValue,
        color: slShades[i % slShades.length] ?? FALLBACK_COLOR,
        custom: { pctOfTotal: pos.marketValue / total },
      });
    }
  }

  // Unmapped
  if (allocation.unmapped.length > 0) {
    const val = allocation.unmapped.reduce((s, u) => s + u.marketValue, 0);
    points.push({
      id: "unmapped",
      parent: "portfolio",
      name: "Unmapped",
      value: val,
      color: "#f59e0b",
      custom: { pctOfTotal: val / total },
    });
  }

  return points;
}

// ── Sunburst: View by Product ────────────────────────────

export function buildSunburstByProduct(
  allocation: AllocationResult,
  productHoldings: ProductHolding[],
  pmCommitments: PMCommitmentSummary[] = [],
  sleeveData: SleeveAllocationData | null = null,
): SunburstPoint[] {
  const points: SunburstPoint[] = [];
  const total = allocation.totalValue + (sleeveData?.liquidBucketValue ?? 0);
  if (total === 0) return [];

  // Ring 1: Portfolio / Sleeve
  points.push({
    id: "portfolio",
    parent: "",
    name: "Portfolio",
    value: allocation.totalValue,
    color: PORTFOLIO_COLOR,
    custom: { pctOfTotal: allocation.totalValue / total },
  });

  if (sleeveData && sleeveData.liquidBucketValue > 0) {
    points.push({
      id: "sleeve",
      parent: "",
      name: "Sleeve",
      value: sleeveData.liquidBucketValue,
      color: SLEEVE_COLOR,
      custom: { pctOfTotal: sleeveData.liquidBucketValue / total },
    });
  }

  // Ring 2: Growth/Defensive (under Portfolio)
  for (const bucket of allocation.buckets) {
    const bucketId = `p-${bucket.riskBucketId}`;
    points.push({
      id: bucketId,
      parent: "portfolio",
      name: bucket.riskBucketName,
      value: bucket.totalValue,
      color: BUCKET_COLORS.portfolio[bucket.riskBucketName] ?? FALLBACK_COLOR,
      custom: { pctOfTotal: bucket.pctOfTotal },
    });
  }

  // Ring 3: Products under their risk bucket
  const usedBuckets: Record<string, number> = {};
  for (const ph of productHoldings) {
    if (!ph.riskBucketId || ph.isSleeve) continue;
    const parentId = `p-${ph.riskBucketId}`;
    const bucketName = ph.riskBucketName ?? "Growth";
    if (!usedBuckets[ph.riskBucketId]) usedBuckets[ph.riskBucketId] = 0;
    const shades = ASSET_SHADES[bucketName] ?? [];
    const color = shades[usedBuckets[ph.riskBucketId]! % shades.length] ?? FALLBACK_COLOR;
    usedBuckets[ph.riskBucketId]!++;

    const prodId = `p-prod-${ph.productId}`;
    points.push({
      id: prodId,
      parent: parentId,
      name: ph.productName,
      value: ph.marketValue,
      color,
      custom: { pctOfTotal: ph.marketValue / total },
    });

    // Ring 4: PM funded/unfunded
    for (const pm of pmCommitments.filter((c) => c.fundName === ph.productName)) {
      if (pm.funded > 0) {
        points.push({
          id: `pm-f-${pm.fundName}-${ph.productId}`,
          parent: prodId,
          name: `${pm.fundName} (Funded)`,
          value: pm.funded,
          color: PM_FUNDED_COLOR,
          custom: { pctOfTotal: pm.funded / total, isFunded: true },
        });
      }
      if (pm.unfunded > 0) {
        points.push({
          id: `pm-u-${pm.fundName}-${ph.productId}`,
          parent: prodId,
          name: `${pm.fundName} (Unfunded)`,
          value: pm.unfunded,
          color: PM_UNFUNDED_COLOR,
          custom: { pctOfTotal: pm.unfunded / total, isUnfunded: true },
        });
      }
    }
  }

  // Sleeve positions
  if (sleeveData && sleeveData.positions.length > 0) {
    const slShades = SLEEVE_ASSET_SHADES.Growth;
    for (let i = 0; i < sleeveData.positions.length; i++) {
      const pos = sleeveData.positions[i];
      points.push({
        id: `s-prod-${pos.productId}`,
        parent: "sleeve",
        name: pos.productName,
        value: pos.marketValue,
        color: slShades[i % slShades.length] ?? FALLBACK_COLOR,
        custom: { pctOfTotal: pos.marketValue / total },
      });
    }
  }

  return points;
}

// ── Treemap data ─────────────────────────────────────────

export type TreemapPoint = {
  id: string;
  parent?: string;
  name: string;
  value?: number;
  color?: string;
  custom?: { pctOfTotal: number; isFunded?: boolean; isUnfunded?: boolean };
};

export function buildTreemapData(
  allocation: AllocationResult,
  productHoldings: ProductHolding[],
  pmCommitments: PMCommitmentSummary[] = [],
  sleeveData: SleeveAllocationData | null = null,
): TreemapPoint[] {
  const points: TreemapPoint[] = [];
  const total = allocation.totalValue + (sleeveData?.liquidBucketValue ?? 0);

  // Level 1: Portfolio / Sleeve
  points.push({ id: "portfolio", name: "Portfolio", color: PORTFOLIO_COLOR });

  if (sleeveData && sleeveData.liquidBucketValue > 0) {
    points.push({ id: "sleeve", name: "Sleeve", color: SLEEVE_COLOR });
    for (let i = 0; i < sleeveData.positions.length; i++) {
      const pos = sleeveData.positions[i];
      const slShades = SLEEVE_ASSET_SHADES.Growth;
      points.push({
        id: `s-tm-${pos.productId}`,
        parent: "sleeve",
        name: pos.productName,
        value: pos.marketValue,
        color: slShades[i % slShades.length] ?? FALLBACK_COLOR,
        custom: { pctOfTotal: total > 0 ? pos.marketValue / total : 0 },
      });
    }
  }

  // Level 2-3: Asset classes → Products (under Portfolio)
  for (const bucket of allocation.buckets) {
    const shades = ASSET_SHADES[bucket.riskBucketName] ?? [];
    for (let i = 0; i < bucket.assetClasses.length; i++) {
      const ac = bucket.assetClasses[i];
      const acId = `tm-ac-${ac.nodeId}`;

      // Get products for this asset class
      const acProducts = productHoldings.filter((ph) => ph.assetClassNodeId === ac.nodeId && !ph.isSleeve);
      const pmForAC = pmCommitments.filter((c) => c.assetClassNodeId === ac.nodeId);

      if (acProducts.length > 0 || pmForAC.length > 0) {
        // Has children → parent node
        points.push({ id: acId, parent: "portfolio", name: ac.nodeName, color: shades[i % shades.length] ?? FALLBACK_COLOR });

        for (const ph of acProducts) {
          points.push({
            id: `tm-p-${ph.productId}`,
            parent: acId,
            name: ph.productName,
            value: ph.marketValue,
            color: shades[i % shades.length] ?? FALLBACK_COLOR,
            custom: { pctOfTotal: total > 0 ? ph.marketValue / total : 0 },
          });
        }

        for (const pm of pmForAC) {
          if (pm.funded > 0) {
            points.push({
              id: `tm-pmf-${pm.fundName}`,
              parent: acId,
              name: `${pm.fundName} (Funded)`,
              value: pm.funded,
              color: PM_FUNDED_COLOR,
              custom: { pctOfTotal: total > 0 ? pm.funded / total : 0, isFunded: true },
            });
          }
          if (pm.unfunded > 0) {
            points.push({
              id: `tm-pmu-${pm.fundName}`,
              parent: acId,
              name: `${pm.fundName} (Unfunded)`,
              value: pm.unfunded,
              color: PM_UNFUNDED_COLOR,
              custom: { pctOfTotal: total > 0 ? pm.unfunded / total : 0, isUnfunded: true },
            });
          }
        }
      } else {
        // Leaf node
        points.push({
          id: acId,
          parent: "portfolio",
          name: ac.nodeName,
          value: ac.totalValue,
          color: shades[i % shades.length] ?? FALLBACK_COLOR,
          custom: { pctOfTotal: ac.pctOfTotal },
        });
      }
    }
  }

  // Unmapped
  if (allocation.unmapped.length > 0) {
    const val = allocation.unmapped.reduce((s, u) => s + u.marketValue, 0);
    points.push({
      id: "tm-unmapped",
      parent: "portfolio",
      name: "Unmapped",
      value: val,
      color: "#f59e0b",
      custom: { pctOfTotal: total > 0 ? val / total : 0 },
    });
  }

  return points;
}
