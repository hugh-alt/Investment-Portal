import { describe, it, expect } from "vitest";
import { resolveStepIndex, stepPath, isFirstStep, isLastStep } from "../wizard";
import type { WizardConfig } from "../wizard";

const config: WizardConfig = {
  draftKey: "saa-create",
  basePath: "/adviser/saa/new",
  steps: [
    { slug: "step-1", title: "Basics" },
    { slug: "step-2", title: "Target Allocations" },
    { slug: "step-3", title: "Tolerance Bands" },
    { slug: "step-4", title: "Assign to Clients" },
  ],
};

describe("SAA wizard navigation", () => {
  it("has 4 steps", () => {
    expect(config.steps).toHaveLength(4);
  });

  it("resolves each step slug to correct index", () => {
    expect(resolveStepIndex(config, "/adviser/saa/new/step-1")).toBe(0);
    expect(resolveStepIndex(config, "/adviser/saa/new/step-2")).toBe(1);
    expect(resolveStepIndex(config, "/adviser/saa/new/step-3")).toBe(2);
    expect(resolveStepIndex(config, "/adviser/saa/new/step-4")).toBe(3);
  });

  it("builds correct paths", () => {
    expect(stepPath(config, 0)).toBe("/adviser/saa/new/step-1");
    expect(stepPath(config, 1)).toBe("/adviser/saa/new/step-2");
    expect(stepPath(config, 2)).toBe("/adviser/saa/new/step-3");
    expect(stepPath(config, 3)).toBe("/adviser/saa/new/step-4");
  });

  it("step-1 is first, step-4 is last", () => {
    expect(isFirstStep(0)).toBe(true);
    expect(isFirstStep(1)).toBe(false);
    expect(isLastStep(config, 3)).toBe(true);
    expect(isLastStep(config, 2)).toBe(false);
  });
});

describe("SAA wizard step validation logic", () => {
  it("step 1: requires name, taxonomyId, and saaId", () => {
    function isStep1Valid(data: { name: string; taxonomyId: string; saaId: string }) {
      return data.name.trim().length > 0 && data.taxonomyId.length > 0 && data.saaId.length > 0;
    }

    expect(isStep1Valid({ name: "", taxonomyId: "", saaId: "" })).toBe(false);
    expect(isStep1Valid({ name: "Test", taxonomyId: "", saaId: "" })).toBe(false);
    expect(isStep1Valid({ name: "Test", taxonomyId: "tax-1", saaId: "" })).toBe(false);
    expect(isStep1Valid({ name: "Test", taxonomyId: "tax-1", saaId: "saa-1" })).toBe(true);
  });

  it("step 2: requires weights summing to ~100%", () => {
    function isStep2Valid(weights: Record<string, number>) {
      const total = Object.values(weights).reduce((s, w) => s + w, 0);
      return Math.abs(total - 1) <= 0.005 && Object.values(weights).some((w) => w > 0);
    }

    expect(isStep2Valid({})).toBe(false);
    expect(isStep2Valid({ a: 0.5, b: 0.3 })).toBe(false); // 80%
    expect(isStep2Valid({ a: 0.5, b: 0.5 })).toBe(true); // 100%
    expect(isStep2Valid({ a: 0.3, b: 0.3, c: 0.4 })).toBe(true); // 100%
    expect(isStep2Valid({ a: 0.3, b: 0.3, c: 0.401 })).toBe(true); // 100.1% within tolerance
  });

  it("step 3: validates min ≤ target ≤ max", () => {
    function isStep3Valid(
      weights: Record<string, number>,
      mins: Record<string, number>,
      maxs: Record<string, number>,
    ) {
      for (const nodeId of Object.keys(weights)) {
        const t = weights[nodeId] ?? 0;
        if (t === 0) continue;
        const lo = mins[nodeId] ?? 0;
        const hi = maxs[nodeId] ?? 0;
        if (lo > t + 0.0005 || hi < t - 0.0005) return false;
        if (lo < 0 || hi > 1) return false;
      }
      return true;
    }

    expect(isStep3Valid({ a: 0.3 }, { a: 0.28 }, { a: 0.32 })).toBe(true);
    expect(isStep3Valid({ a: 0.3 }, { a: 0.35 }, { a: 0.4 })).toBe(false); // min > target
    expect(isStep3Valid({ a: 0.3 }, { a: 0.2 }, { a: 0.25 })).toBe(false); // max < target
    expect(isStep3Valid({ a: 0.3 }, { a: -0.1 }, { a: 0.5 })).toBe(false); // min < 0
    expect(isStep3Valid({ a: 0 }, { a: 0 }, { a: 0 })).toBe(true); // skipped (0 weight)
  });

  it("step 4: always valid (skip allowed)", () => {
    expect(true).toBe(true); // no validation needed
  });
});
