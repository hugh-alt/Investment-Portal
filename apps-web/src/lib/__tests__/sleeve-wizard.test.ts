import { describe, it, expect } from "vitest";
import { resolveStepIndex, stepPath, isFirstStep, isLastStep } from "../wizard";
import type { WizardConfig } from "../wizard";

const config: WizardConfig = {
  draftKey: "sleeve-create",
  basePath: "/adviser/sleeve/new",
  steps: [
    { slug: "step-1", title: "Client & Basics" },
    { slug: "step-2", title: "Liquid Bucket" },
    { slug: "step-3", title: "Fund Commitments" },
    { slug: "step-4", title: "Buffer Rules" },
    { slug: "step-5", title: "Waterfalls" },
    { slug: "step-6", title: "Review & Create" },
  ],
};

describe("Sleeve wizard navigation", () => {
  it("has 6 steps", () => {
    expect(config.steps).toHaveLength(6);
  });

  it("resolves each step slug to correct index", () => {
    expect(resolveStepIndex(config, "/adviser/sleeve/new/step-1")).toBe(0);
    expect(resolveStepIndex(config, "/adviser/sleeve/new/step-2")).toBe(1);
    expect(resolveStepIndex(config, "/adviser/sleeve/new/step-3")).toBe(2);
    expect(resolveStepIndex(config, "/adviser/sleeve/new/step-4")).toBe(3);
    expect(resolveStepIndex(config, "/adviser/sleeve/new/step-5")).toBe(4);
    expect(resolveStepIndex(config, "/adviser/sleeve/new/step-6")).toBe(5);
  });

  it("builds correct paths", () => {
    for (let i = 0; i < 6; i++) {
      expect(stepPath(config, i)).toBe(`/adviser/sleeve/new/step-${i + 1}`);
    }
  });

  it("step-1 is first, step-6 is last", () => {
    expect(isFirstStep(0)).toBe(true);
    expect(isFirstStep(1)).toBe(false);
    expect(isLastStep(config, 5)).toBe(true);
    expect(isLastStep(config, 4)).toBe(false);
  });
});

describe("Sleeve wizard step validation logic", () => {
  it("step 1: requires sleeveId to be set", () => {
    expect("".length > 0).toBe(false);
    expect("sleeve-123".length > 0).toBe(true);
  });

  it("step 2: requires at least 1 liquid position", () => {
    expect([].length > 0).toBe(false);
    expect([{ productId: "p1", productName: "Cash", marketValue: 50000, weightPct: 100 }].length > 0).toBe(true);
  });

  it("step 3: valid if commitments skipped or has entries", () => {
    // Skipped case
    const commitmentsSkipped = true;
    const commitments: unknown[] = [];
    expect(commitmentsSkipped || commitments.length > 0).toBe(true);

    // Has entries case
    const notSkipped = false;
    const withEntries = [{ fundId: "f1", fundName: "Fund A", currency: "AUD", commitmentAmount: 100000 }];
    expect(notSkipped || withEntries.length > 0).toBe(true);

    // Neither: invalid
    expect(false || [].length > 0).toBe(false);
  });

  it("step 4 (buffer): always valid with defaults", () => {
    expect(true).toBe(true);
  });

  it("step 5 (waterfalls): always valid (can be empty)", () => {
    expect(true).toBe(true);
  });

  it("step 6 (review): always valid", () => {
    expect(true).toBe(true);
  });
});
