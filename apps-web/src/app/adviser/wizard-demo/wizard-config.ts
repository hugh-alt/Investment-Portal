import type { WizardConfig } from "@/lib/wizard";

export const DEMO_WIZARD_CONFIG: WizardConfig = {
  draftKey: "wizard-demo",
  basePath: "/adviser/wizard-demo",
  steps: [
    {
      slug: "step-1",
      title: "Basic Info",
      description: "Enter the name and description for your item.",
    },
    {
      slug: "step-2",
      title: "Configuration",
      description: "Configure the key settings.",
    },
    {
      slug: "step-3",
      title: "Review & Confirm",
      description: "Review your selections before confirming.",
    },
  ],
};

export interface DemoFormData {
  name: string;
  description: string;
  category: string;
  priority: string;
}

export const DEMO_DEFAULTS: DemoFormData = {
  name: "",
  description: "",
  category: "",
  priority: "medium",
};
