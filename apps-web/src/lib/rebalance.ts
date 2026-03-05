/**
 * Pure rebalance trade generation: given current holdings, taxonomy mappings,
 * SAA targets with tolerances, generate product-level trades to bring portfolio
 * within tolerance bands.
 * Client-safe (no DB imports).
 */

export type TradeSide = "BUY" | "SELL";

export type RebalanceHolding = {
  productId: string;
  productName: string;
  marketValue: number;
  nodeId: string;      // taxonomy node this product maps to
  nodeName: string;
};

export type RebalanceTarget = {
  nodeId: string;
  nodeName: string;
  targetWeight: number; // 0–1
  minWeight: number;    // 0–1
  maxWeight: number;    // 0–1
};

export type RebalanceTrade = {
  productId: string;
  productName: string;
  nodeId: string;
  nodeName: string;
  side: TradeSide;
  amount: number;       // absolute dollar amount
  reason: string;
};

export type RebalanceResult = {
  trades: RebalanceTrade[];
  beforeDrift: NodeDrift[];
  afterDrift: NodeDrift[];
  totalPortfolioValue: number;
  breachesBefore: number;
  breachesAfter: number;
};

export type NodeDrift = {
  nodeId: string;
  nodeName: string;
  currentWeight: number;
  targetWeight: number;
  minWeight: number;
  maxWeight: number;
  drift: number;
  status: "within" | "below_min" | "above_max";
};

function computeNodeDrift(
  nodeValues: Map<string, number>,
  totalValue: number,
  targets: RebalanceTarget[],
): NodeDrift[] {
  return targets.map((t) => {
    const value = nodeValues.get(t.nodeId) ?? 0;
    const currentWeight = totalValue > 0 ? value / totalValue : 0;
    const drift = currentWeight - t.targetWeight;
    let status: NodeDrift["status"] = "within";
    if (currentWeight < t.minWeight - 0.0005) status = "below_min";
    else if (currentWeight > t.maxWeight + 0.0005) status = "above_max";
    return {
      nodeId: t.nodeId,
      nodeName: t.nodeName,
      currentWeight,
      targetWeight: t.targetWeight,
      minWeight: t.minWeight,
      maxWeight: t.maxWeight,
      drift,
      status,
    };
  });
}

/**
 * Generate rebalance trades to bring all nodes within tolerance bands.
 *
 * Algorithm:
 * 1. Compute current weight per node, identify overweight/underweight nodes
 * 2. For overweight nodes: sell from largest positions first, targeting midpoint
 *    between target and max weight
 * 3. For underweight nodes: buy into existing positions (proportional to current),
 *    targeting midpoint between target and min weight
 * 4. Respect minTradeAmount: skip trades below threshold
 * 5. Respect doNotTrade: exclude listed products
 * 6. Iterate until all within tolerance or no feasible trades remain
 */
export function generateRebalanceTrades(
  holdings: RebalanceHolding[],
  targets: RebalanceTarget[],
  options: {
    minTradeAmount?: number;
    doNotTradeProductIds?: string[];
  } = {},
): RebalanceResult {
  const minTrade = options.minTradeAmount ?? 0;
  const doNotTrade = new Set(options.doNotTradeProductIds ?? []);

  // Compute total portfolio value
  const totalValue = holdings.reduce((s, h) => s + h.marketValue, 0);
  if (totalValue <= 0) {
    return {
      trades: [],
      beforeDrift: computeNodeDrift(new Map(), 0, targets),
      afterDrift: computeNodeDrift(new Map(), 0, targets),
      totalPortfolioValue: 0,
      breachesBefore: 0,
      breachesAfter: 0,
    };
  }

  // Compute node values from holdings
  const nodeValues = new Map<string, number>();
  for (const h of holdings) {
    nodeValues.set(h.nodeId, (nodeValues.get(h.nodeId) ?? 0) + h.marketValue);
  }

  const beforeDrift = computeNodeDrift(nodeValues, totalValue, targets);
  const breachesBefore = beforeDrift.filter((d) => d.status !== "within").length;

  // Working copy of holdings (mutable)
  const workingHoldings = holdings.map((h) => ({ ...h }));

  // Working copy of node values (mutable)
  const workingNodeValues = new Map(nodeValues);

  const trades: RebalanceTrade[] = [];

  // Identify nodes that need rebalancing
  // Overweight: sell to bring toward target (aim for midpoint between target and max)
  // Underweight: buy to bring toward target (aim for midpoint between target and min)

  const overweightNodes = beforeDrift
    .filter((d) => d.status === "above_max")
    .sort((a, b) => b.drift - a.drift); // most overweight first

  const underweightNodes = beforeDrift
    .filter((d) => d.status === "below_min")
    .sort((a, b) => a.drift - b.drift); // most underweight first

  // Phase 1: Compute sells from overweight nodes
  let totalSellAmount = 0;
  for (const node of overweightNodes) {
    const currentValue = workingNodeValues.get(node.nodeId) ?? 0;
    // Target the midpoint between target and max to avoid oscillation
    const aimWeight = (node.targetWeight + node.maxWeight) / 2;
    const aimValue = aimWeight * totalValue;
    const excessValue = currentValue - aimValue;
    if (excessValue < minTrade) continue;

    // Get tradeable holdings in this node, sorted by largest first
    const nodeHoldings = workingHoldings
      .filter((h) => h.nodeId === node.nodeId && !doNotTrade.has(h.productId))
      .sort((a, b) => b.marketValue - a.marketValue);

    let remaining = excessValue;
    for (const h of nodeHoldings) {
      if (remaining < minTrade) break;
      const sellAmount = Math.min(remaining, h.marketValue);
      if (sellAmount < minTrade) continue;

      const roundedAmount = Math.round(sellAmount * 100) / 100;
      trades.push({
        productId: h.productId,
        productName: h.productName,
        nodeId: node.nodeId,
        nodeName: node.nodeName,
        side: "SELL",
        amount: roundedAmount,
        reason: `Overweight ${node.nodeName}: ${(node.currentWeight * 100).toFixed(1)}% vs target ${(node.targetWeight * 100).toFixed(1)}%`,
      });

      h.marketValue -= roundedAmount;
      remaining -= roundedAmount;
      totalSellAmount += roundedAmount;
    }

    // Update working node value
    const newNodeValue = nodeHoldings.reduce(
      (s, h) => s + h.marketValue,
      workingHoldings.filter((h) => h.nodeId === node.nodeId && doNotTrade.has(h.productId)).reduce((s, h) => s + h.marketValue, 0),
    );
    workingNodeValues.set(node.nodeId, newNodeValue);
  }

  // Phase 2: Buy into underweight nodes using proceeds from sells
  let remainingBuyBudget = totalSellAmount;
  for (const node of underweightNodes) {
    if (remainingBuyBudget < minTrade) break;

    const currentValue = workingNodeValues.get(node.nodeId) ?? 0;
    // Target midpoint between min and target
    const aimWeight = (node.targetWeight + node.minWeight) / 2;
    const aimValue = aimWeight * totalValue;
    const deficitValue = aimValue - currentValue;
    if (deficitValue < minTrade) continue;

    const buyAmount = Math.min(deficitValue, remainingBuyBudget);
    if (buyAmount < minTrade) continue;

    // Buy into existing holdings in this node, proportional to current size
    // If no existing holdings, buy into a single new position
    const nodeHoldings = workingHoldings
      .filter((h) => h.nodeId === node.nodeId && !doNotTrade.has(h.productId) && h.marketValue > 0);

    if (nodeHoldings.length === 0) {
      // No existing holdings to buy into — find any holding in this node
      const anyHolding = workingHoldings.find(
        (h) => h.nodeId === node.nodeId && !doNotTrade.has(h.productId),
      );
      if (!anyHolding) continue; // skip if no tradeable product in this node

      const roundedAmount = Math.round(buyAmount * 100) / 100;
      trades.push({
        productId: anyHolding.productId,
        productName: anyHolding.productName,
        nodeId: node.nodeId,
        nodeName: node.nodeName,
        side: "BUY",
        amount: roundedAmount,
        reason: `Underweight ${node.nodeName}: ${(node.currentWeight * 100).toFixed(1)}% vs target ${(node.targetWeight * 100).toFixed(1)}%`,
      });

      anyHolding.marketValue += roundedAmount;
      remainingBuyBudget -= roundedAmount;
    } else {
      // Distribute buy proportionally across existing holdings
      const totalNodeValue = nodeHoldings.reduce((s, h) => s + h.marketValue, 0);
      let allocated = 0;
      for (let i = 0; i < nodeHoldings.length; i++) {
        const h = nodeHoldings[i];
        const proportion = totalNodeValue > 0 ? h.marketValue / totalNodeValue : 1 / nodeHoldings.length;
        const isLast = i === nodeHoldings.length - 1;
        const legAmount = isLast
          ? buyAmount - allocated  // last leg gets remainder to avoid rounding errors
          : Math.round(buyAmount * proportion * 100) / 100;

        if (legAmount < minTrade) continue;

        const roundedAmount = Math.round(legAmount * 100) / 100;
        trades.push({
          productId: h.productId,
          productName: h.productName,
          nodeId: node.nodeId,
          nodeName: node.nodeName,
          side: "BUY",
          amount: roundedAmount,
          reason: `Underweight ${node.nodeName}: ${(node.currentWeight * 100).toFixed(1)}% vs target ${(node.targetWeight * 100).toFixed(1)}%`,
        });

        h.marketValue += roundedAmount;
        allocated += roundedAmount;
      }
      remainingBuyBudget -= allocated;
    }

    // Update working node value
    workingNodeValues.set(
      node.nodeId,
      workingHoldings.filter((h) => h.nodeId === node.nodeId).reduce((s, h) => s + h.marketValue, 0),
    );
  }

  // Compute after-drift
  const afterDrift = computeNodeDrift(workingNodeValues, totalValue, targets);
  const breachesAfter = afterDrift.filter((d) => d.status !== "within").length;

  return {
    trades,
    beforeDrift,
    afterDrift,
    totalPortfolioValue: totalValue,
    breachesBefore,
    breachesAfter,
  };
}
