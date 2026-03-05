import { describe, it, expect } from "vitest";
import { computeStressImpact } from "../stress";
import type { NodeWeight, ShockInput } from "../stress";

const makeWeight = (
  nodeId: string,
  nodeName: string,
  weight: number,
  parentId: string | null = null,
  nodeType = "ASSET_CLASS",
): NodeWeight => ({
  nodeId,
  nodeName,
  nodeType,
  parentId,
  weight,
});

describe("computeStressImpact", () => {
  it("computes basic impact from direct shocks", () => {
    const weights: NodeWeight[] = [
      makeWeight("aus-eq", "Australian Equities", 0.4),
      makeWeight("intl-eq", "International Equities", 0.3),
      makeWeight("fi", "Fixed Income", 0.3),
    ];
    const shocks: ShockInput[] = [
      { nodeId: "aus-eq", shockPct: -0.30 },
      { nodeId: "intl-eq", shockPct: -0.40 },
      { nodeId: "fi", shockPct: 0.05 },
    ];
    const parents = new Map<string, string | null>();

    const result = computeStressImpact(weights, shocks, parents);

    // -0.4*0.30 + -0.3*0.40 + 0.3*0.05 = -0.12 + -0.12 + 0.015 = -0.225
    expect(result.estimatedImpactPct).toBeCloseTo(-0.225, 6);
    expect(result.details).toHaveLength(3);
    expect(result.unmappedPct).toBeCloseTo(0, 6);
    expect(result.details.every((d) => d.source === "direct")).toBe(true);
  });

  it("handles partial shocks — unshocked nodes get 0 contribution", () => {
    const weights: NodeWeight[] = [
      makeWeight("aus-eq", "Australian Equities", 0.5),
      makeWeight("fi", "Fixed Income", 0.5),
    ];
    const shocks: ShockInput[] = [
      { nodeId: "aus-eq", shockPct: -0.30 },
      // fi has no shock
    ];
    const parents = new Map<string, string | null>();

    const result = computeStressImpact(weights, shocks, parents);

    expect(result.estimatedImpactPct).toBeCloseTo(-0.15, 6);
    expect(result.details[1].source).toBe("none");
    expect(result.details[1].contribution).toBe(0);
  });

  it("SUB_ASSET shock overrides parent ASSET_CLASS shock", () => {
    // Parent: "intl-eq" has a -40% shock
    // Child: "em-eq" (sub-asset of intl-eq) has a -60% shock
    // Sibling: "dm-eq" (sub-asset of intl-eq) has no own shock → inherits -40%
    const weights: NodeWeight[] = [
      makeWeight("em-eq", "EM Equities", 0.2, "intl-eq", "SUB_ASSET"),
      makeWeight("dm-eq", "DM Equities", 0.3, "intl-eq", "SUB_ASSET"),
    ];
    const shocks: ShockInput[] = [
      { nodeId: "intl-eq", shockPct: -0.40 },
      { nodeId: "em-eq", shockPct: -0.60 },
    ];
    const parents = new Map<string, string | null>([
      ["em-eq", "intl-eq"],
      ["dm-eq", "intl-eq"],
    ]);

    const result = computeStressImpact(weights, shocks, parents);

    // em-eq: 0.2 * -0.60 = -0.12 (direct)
    // dm-eq: 0.3 * -0.40 = -0.12 (parent)
    expect(result.estimatedImpactPct).toBeCloseTo(-0.24, 6);
    expect(result.details[0].source).toBe("direct");
    expect(result.details[0].shockPct).toBe(-0.60);
    expect(result.details[1].source).toBe("parent");
    expect(result.details[1].shockPct).toBe(-0.40);
  });

  it("reports unmapped portion when weights sum to less than 1", () => {
    const weights: NodeWeight[] = [
      makeWeight("aus-eq", "Australian Equities", 0.6),
    ];
    const shocks: ShockInput[] = [
      { nodeId: "aus-eq", shockPct: -0.30 },
    ];
    const parents = new Map<string, string | null>();

    const result = computeStressImpact(weights, shocks, parents);

    expect(result.estimatedImpactPct).toBeCloseTo(-0.18, 6);
    expect(result.unmappedPct).toBeCloseTo(0.4, 6);
  });

  it("handles empty shocks — all nodes get 0 contribution", () => {
    const weights: NodeWeight[] = [
      makeWeight("aus-eq", "Australian Equities", 0.5),
      makeWeight("fi", "Fixed Income", 0.5),
    ];
    const shocks: ShockInput[] = [];
    const parents = new Map<string, string | null>();

    const result = computeStressImpact(weights, shocks, parents);

    expect(result.estimatedImpactPct).toBe(0);
    expect(result.details.every((d) => d.source === "none")).toBe(true);
  });

  it("handles empty portfolio", () => {
    const result = computeStressImpact(
      [],
      [{ nodeId: "aus-eq", shockPct: -0.30 }],
      new Map(),
    );

    expect(result.estimatedImpactPct).toBe(0);
    expect(result.details).toHaveLength(0);
    expect(result.unmappedPct).toBe(1);
  });
});
