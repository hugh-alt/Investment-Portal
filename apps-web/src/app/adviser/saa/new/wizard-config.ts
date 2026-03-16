import type { WizardConfig } from "@/lib/wizard";

export const SAA_WIZARD_CONFIG: WizardConfig = {
  draftKey: "saa-create",
  basePath: "/adviser/saa/new",
  steps: [
    {
      slug: "step-1",
      title: "Basics",
      description: "Name your SAA and select a taxonomy.",
    },
    {
      slug: "step-2",
      title: "Target Allocations",
      description: "Set target weights for each asset class. Weights must sum to 100%.",
    },
    {
      slug: "step-3",
      title: "Tolerance Bands",
      description: "Set min/max bounds per asset class. Use the global band control for a quick start.",
    },
    {
      slug: "step-4",
      title: "Assign to Clients",
      description: "Optionally assign this SAA to one or more clients. You can skip this step.",
    },
  ],
};

export interface SAAWizardData {
  /** Set after step 1 creates the record */
  saaId: string;
  name: string;
  taxonomyId: string;
  /** Target weights keyed by nodeId (0-1 scale) */
  weights: Record<string, number>;
  /** Min weights keyed by nodeId (0-1 scale) */
  mins: Record<string, number>;
  /** Max weights keyed by nodeId (0-1 scale) */
  maxs: Record<string, number>;
  /** Client IDs selected for assignment */
  selectedClientIds: string[];
}

export const SAA_WIZARD_DEFAULTS: SAAWizardData = {
  saaId: "",
  name: "",
  taxonomyId: "",
  weights: {},
  mins: {},
  maxs: {},
  selectedClientIds: [],
};
