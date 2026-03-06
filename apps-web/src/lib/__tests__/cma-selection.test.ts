import { describe, it, expect } from "vitest";
import { computeExpectedOutcomes } from "../cma";
import type { CMAInput, WeightInput } from "../cma";

// Helpers to simulate CMA selection resolution logic

type CMASet = {
  id: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "RETIRED";
  isDefault: boolean;
  assumptions: CMAInput[];
};

type ClientCMASelection = {
  clientId: string;
  cmaSetId: string;
} | null;

/**
 * Resolve which CMA set to use for a client:
 * 1. Client selection (if ACTIVE and not RETIRED)
 * 2. Firm default (isDefault + ACTIVE)
 * 3. null
 */
function resolveClientCMA(
  activeSets: CMASet[],
  selection: ClientCMASelection,
): CMASet | null {
  const defaultSet = activeSets.find((s) => s.isDefault && s.status === "ACTIVE");
  if (!selection) return defaultSet ?? null;
  const selected = activeSets.find((s) => s.id === selection.cmaSetId && s.status === "ACTIVE");
  return selected ?? defaultSet ?? null;
}

describe("CMA selection resolution", () => {
  const baseAssumptions: CMAInput[] = [
    { nodeId: "eq", expReturnPct: 0.08, volPct: 0.16 },
  ];
  const bullAssumptions: CMAInput[] = [
    { nodeId: "eq", expReturnPct: 0.10, volPct: 0.17 },
  ];
  const retiredAssumptions: CMAInput[] = [
    { nodeId: "eq", expReturnPct: 0.06, volPct: 0.14 },
  ];

  const sets: CMASet[] = [
    { id: "base", name: "Base", status: "ACTIVE", isDefault: true, assumptions: baseAssumptions },
    { id: "bull", name: "Bull", status: "ACTIVE", isDefault: false, assumptions: bullAssumptions },
    { id: "retired", name: "Old", status: "RETIRED", isDefault: false, assumptions: retiredAssumptions },
    { id: "draft", name: "Draft", status: "DRAFT", isDefault: false, assumptions: baseAssumptions },
  ];

  it("returns firm default when no client selection", () => {
    const resolved = resolveClientCMA(sets, null);
    expect(resolved?.id).toBe("base");
    expect(resolved?.isDefault).toBe(true);
  });

  it("returns client selection when ACTIVE", () => {
    const resolved = resolveClientCMA(sets, { clientId: "c1", cmaSetId: "bull" });
    expect(resolved?.id).toBe("bull");
  });

  it("falls back to default when selected set is RETIRED", () => {
    const resolved = resolveClientCMA(sets, { clientId: "c1", cmaSetId: "retired" });
    expect(resolved?.id).toBe("base");
  });

  it("falls back to default when selected set is DRAFT", () => {
    const resolved = resolveClientCMA(sets, { clientId: "c1", cmaSetId: "draft" });
    expect(resolved?.id).toBe("base");
  });

  it("returns null when no ACTIVE sets exist", () => {
    const resolved = resolveClientCMA([], null);
    expect(resolved).toBeNull();
  });

  it("filters only ACTIVE sets for selection", () => {
    const activeSets = sets.filter((s) => s.status === "ACTIVE");
    expect(activeSets).toHaveLength(2);
    expect(activeSets.every((s) => s.status === "ACTIVE")).toBe(true);
  });

  it("computes different outcomes for different CMA cases", () => {
    const weights: WeightInput[] = [
      { nodeId: "eq", nodeName: "Equities", weight: 1.0 },
    ];

    const baseResult = computeExpectedOutcomes(weights, baseAssumptions);
    const bullResult = computeExpectedOutcomes(weights, bullAssumptions);

    expect(baseResult.expectedReturnPct).toBeCloseTo(0.08);
    expect(bullResult.expectedReturnPct).toBeCloseTo(0.10);
    expect(bullResult.expectedReturnPct).toBeGreaterThan(baseResult.expectedReturnPct);
  });
});
