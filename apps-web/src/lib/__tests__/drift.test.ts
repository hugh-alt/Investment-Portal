import { describe, it, expect } from "vitest";
import { computeDrift, type CurrentWeightInput, type TargetInput } from "../drift";

describe("computeDrift", () => {
  const current: CurrentWeightInput[] = [
    { nodeId: "n1", nodeName: "Aus Eq", nodeType: "ASSET_CLASS", riskBucketId: "rb1", riskBucketName: "Growth", weight: 0.40 },
    { nodeId: "n2", nodeName: "Intl Eq", nodeType: "ASSET_CLASS", riskBucketId: "rb1", riskBucketName: "Growth", weight: 0.25 },
    { nodeId: "n3", nodeName: "Fixed Inc", nodeType: "ASSET_CLASS", riskBucketId: "rb2", riskBucketName: "Defensive", weight: 0.20 },
  ];

  const targets: TargetInput[] = [
    { nodeId: "n1", targetWeight: 0.35, minWeight: 0.33, maxWeight: 0.37 },
    { nodeId: "n2", targetWeight: 0.30, minWeight: 0.28, maxWeight: 0.32 },
    { nodeId: "n3", targetWeight: 0.25, minWeight: 0.23, maxWeight: 0.27 },
  ];

  it("calculates drift as current - target", () => {
    const result = computeDrift(current, targets);
    const n1 = result.rows.find((r) => r.nodeId === "n1")!;
    expect(n1.drift).toBeCloseTo(0.05);
    const n2 = result.rows.find((r) => r.nodeId === "n2")!;
    expect(n2.drift).toBeCloseTo(-0.05);
  });

  it("reports max absolute drift", () => {
    const result = computeDrift(current, targets);
    expect(result.maxAbsDrift).toBeCloseTo(0.05);
  });

  it("includes nodes present only in targets", () => {
    const extra: TargetInput[] = [...targets, { nodeId: "n4", targetWeight: 0.10, minWeight: 0.08, maxWeight: 0.12 }];
    const result = computeDrift(current, extra);
    const n4 = result.rows.find((r) => r.nodeId === "n4")!;
    expect(n4.currentWeight).toBe(0);
    expect(n4.targetWeight).toBe(0.10);
    expect(n4.drift).toBeCloseTo(-0.10);
  });

  it("handles empty targets (all drift equals current weight)", () => {
    const result = computeDrift(current, []);
    expect(result.totalTargetWeight).toBe(0);
    for (const r of result.rows) {
      expect(r.drift).toBe(r.currentWeight);
    }
  });

  it("handles perfect alignment (zero drift)", () => {
    const aligned: TargetInput[] = current.map((c) => ({
      nodeId: c.nodeId,
      targetWeight: c.weight,
      minWeight: c.weight - 0.02,
      maxWeight: c.weight + 0.02,
    }));
    const result = computeDrift(current, aligned);
    expect(result.maxAbsDrift).toBeCloseTo(0);
  });

  it("marks within-tolerance when current is between min and max", () => {
    const withinTargets: TargetInput[] = [
      { nodeId: "n1", targetWeight: 0.35, minWeight: 0.30, maxWeight: 0.45 },
      { nodeId: "n2", targetWeight: 0.30, minWeight: 0.20, maxWeight: 0.30 },
      { nodeId: "n3", targetWeight: 0.25, minWeight: 0.15, maxWeight: 0.25 },
    ];
    const result = computeDrift(current, withinTargets);
    for (const r of result.rows) {
      expect(r.toleranceStatus).toBe("within");
    }
    expect(result.breachCount).toBe(0);
  });

  it("marks below_min when current is below minWeight", () => {
    const tightTargets: TargetInput[] = [
      { nodeId: "n1", targetWeight: 0.50, minWeight: 0.48, maxWeight: 0.52 },
      { nodeId: "n2", targetWeight: 0.30, minWeight: 0.28, maxWeight: 0.32 },
      { nodeId: "n3", targetWeight: 0.20, minWeight: 0.20, maxWeight: 0.22 },
    ];
    const result = computeDrift(current, tightTargets);
    const n1 = result.rows.find((r) => r.nodeId === "n1")!;
    expect(n1.toleranceStatus).toBe("below_min");
  });

  it("marks above_max when current exceeds maxWeight", () => {
    const lowTargets: TargetInput[] = [
      { nodeId: "n1", targetWeight: 0.30, minWeight: 0.28, maxWeight: 0.35 },
      { nodeId: "n2", targetWeight: 0.20, minWeight: 0.18, maxWeight: 0.22 },
      { nodeId: "n3", targetWeight: 0.25, minWeight: 0.23, maxWeight: 0.27 },
    ];
    const result = computeDrift(current, lowTargets);
    const n1 = result.rows.find((r) => r.nodeId === "n1")!;
    expect(n1.toleranceStatus).toBe("above_max");
    const n2 = result.rows.find((r) => r.nodeId === "n2")!;
    expect(n2.toleranceStatus).toBe("above_max");
  });

  it("counts breaches correctly", () => {
    const mixedTargets: TargetInput[] = [
      { nodeId: "n1", targetWeight: 0.50, minWeight: 0.48, maxWeight: 0.52 }, // below_min (0.40 < 0.48)
      { nodeId: "n2", targetWeight: 0.25, minWeight: 0.24, maxWeight: 0.26 }, // within (0.25)
      { nodeId: "n3", targetWeight: 0.10, minWeight: 0.08, maxWeight: 0.15 }, // above_max (0.20 > 0.15)
    ];
    const result = computeDrift(current, mixedTargets);
    expect(result.breachCount).toBe(2);
  });
});
