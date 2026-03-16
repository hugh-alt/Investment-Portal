import { describe, it, expect } from "vitest";
import {
  resolveStepIndex,
  stepPath,
  isFirstStep,
  isLastStep,
  type WizardConfig,
} from "../wizard";

const config: WizardConfig = {
  draftKey: "test-wizard",
  basePath: "/adviser/wizard-demo",
  steps: [
    { slug: "step-1", title: "Basic Info" },
    { slug: "step-2", title: "Configuration" },
    { slug: "step-3", title: "Review" },
  ],
};

describe("wizard utilities", () => {
  describe("resolveStepIndex", () => {
    it("resolves step-1 to index 0", () => {
      expect(resolveStepIndex(config, "/adviser/wizard-demo/step-1")).toBe(0);
    });

    it("resolves step-2 to index 1", () => {
      expect(resolveStepIndex(config, "/adviser/wizard-demo/step-2")).toBe(1);
    });

    it("resolves step-3 to index 2", () => {
      expect(resolveStepIndex(config, "/adviser/wizard-demo/step-3")).toBe(2);
    });

    it("falls back to 0 for unknown slug", () => {
      expect(resolveStepIndex(config, "/adviser/wizard-demo/step-99")).toBe(0);
    });

    it("falls back to 0 for base path with no slug", () => {
      expect(resolveStepIndex(config, "/adviser/wizard-demo")).toBe(0);
    });
  });

  describe("stepPath", () => {
    it("builds correct path for each step", () => {
      expect(stepPath(config, 0)).toBe("/adviser/wizard-demo/step-1");
      expect(stepPath(config, 1)).toBe("/adviser/wizard-demo/step-2");
      expect(stepPath(config, 2)).toBe("/adviser/wizard-demo/step-3");
    });

    it("returns basePath for out-of-bounds index", () => {
      expect(stepPath(config, 5)).toBe("/adviser/wizard-demo");
      expect(stepPath(config, -1)).toBe("/adviser/wizard-demo");
    });
  });

  describe("isFirstStep / isLastStep", () => {
    it("identifies first step", () => {
      expect(isFirstStep(0)).toBe(true);
      expect(isFirstStep(1)).toBe(false);
    });

    it("identifies last step", () => {
      expect(isLastStep(config, 2)).toBe(true);
      expect(isLastStep(config, 1)).toBe(false);
      expect(isLastStep(config, 0)).toBe(false);
    });
  });

  describe("step ordering", () => {
    it("maintains correct order from index 0 to N-1", () => {
      const slugs = config.steps.map((s) => s.slug);
      expect(slugs).toEqual(["step-1", "step-2", "step-3"]);
    });

    it("next step index is current + 1", () => {
      for (let i = 0; i < config.steps.length - 1; i++) {
        const nextPath = stepPath(config, i + 1);
        expect(nextPath).toBe(`/adviser/wizard-demo/${config.steps[i + 1].slug}`);
      }
    });

    it("back step index is current - 1", () => {
      for (let i = 1; i < config.steps.length; i++) {
        const prevPath = stepPath(config, i - 1);
        expect(prevPath).toBe(`/adviser/wizard-demo/${config.steps[i - 1].slug}`);
      }
    });
  });
});
