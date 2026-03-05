/**
 * Pure stress-test impact calculation.
 * Client-safe (no DB imports).
 *
 * For each client:
 *   impact = sum( weight(node) * shockPct(node) )
 *
 * Override logic: if a shock exists at SUB_ASSET level AND at its parent
 * ASSET_CLASS level, the SUB_ASSET shock takes precedence for that node.
 * The parent ASSET_CLASS shock still applies to sibling nodes without
 * their own shock.
 */

export type ShockInput = {
  nodeId: string;
  shockPct: number; // e.g. -0.30
};

export type NodeWeight = {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  parentId: string | null;
  weight: number; // 0–1 (pctOfTotal from allocation)
};

export type StressDetailRow = {
  nodeId: string;
  nodeName: string;
  weight: number;
  shockPct: number;
  contribution: number; // weight * shockPct
  source: "direct" | "parent" | "none";
};

export type StressImpactResult = {
  estimatedImpactPct: number;
  details: StressDetailRow[];
  unmappedPct: number; // portion of portfolio not mapped to any taxonomy node
};

/**
 * Compute stress impact for a single client portfolio.
 *
 * @param nodeWeights - allocation weights per taxonomy node (from computeAllocation)
 * @param shocks - scenario shocks keyed by node ID
 * @param nodeParents - map of nodeId → parentId for override resolution
 */
export function computeStressImpact(
  nodeWeights: NodeWeight[],
  shocks: ShockInput[],
  nodeParents: Map<string, string | null>,
): StressImpactResult {
  const shockMap = new Map<string, number>();
  for (const s of shocks) {
    shockMap.set(s.nodeId, s.shockPct);
  }

  // Build set of nodes that have direct shocks, for override detection
  const directShockNodes = new Set(shockMap.keys());

  const details: StressDetailRow[] = [];
  let totalMappedWeight = 0;

  for (const nw of nodeWeights) {
    totalMappedWeight += nw.weight;

    // Check for direct shock on this node
    if (directShockNodes.has(nw.nodeId)) {
      const shock = shockMap.get(nw.nodeId)!;
      details.push({
        nodeId: nw.nodeId,
        nodeName: nw.nodeName,
        weight: nw.weight,
        shockPct: shock,
        contribution: nw.weight * shock,
        source: "direct",
      });
      continue;
    }

    // Check for parent shock (ASSET_CLASS shock applying to SUB_ASSET child)
    const parentId = nodeParents.get(nw.nodeId) ?? nw.parentId;
    if (parentId && shockMap.has(parentId)) {
      const shock = shockMap.get(parentId)!;
      details.push({
        nodeId: nw.nodeId,
        nodeName: nw.nodeName,
        weight: nw.weight,
        shockPct: shock,
        contribution: nw.weight * shock,
        source: "parent",
      });
      continue;
    }

    // No shock applies
    details.push({
      nodeId: nw.nodeId,
      nodeName: nw.nodeName,
      weight: nw.weight,
      shockPct: 0,
      contribution: 0,
      source: "none",
    });
  }

  const estimatedImpactPct = details.reduce((sum, d) => sum + d.contribution, 0);
  const unmappedPct = Math.max(0, 1 - totalMappedWeight);

  return { estimatedImpactPct, details, unmappedPct };
}

/**
 * Resolve effective shocks considering SUB_ASSET overrides ASSET_CLASS.
 *
 * Given shocks at both an ASSET_CLASS node and its SUB_ASSET child,
 * the SUB_ASSET shock takes precedence for that child. The parent
 * ASSET_CLASS shock is NOT removed — it still applies to sibling nodes
 * via the "parent" source fallback in computeStressImpact.
 *
 * This function is called implicitly inside computeStressImpact via
 * the direct-check-first logic.
 */
