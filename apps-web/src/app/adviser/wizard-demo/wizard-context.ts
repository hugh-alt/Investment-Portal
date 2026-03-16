"use client";

import { createContext, useContext } from "react";
import type { DemoFormData } from "./wizard-config";

interface DemoWizardContextValue {
  data: DemoFormData;
  update: (partial: Partial<DemoFormData>) => void;
}

export const DemoWizardContext = createContext<DemoWizardContextValue | null>(null);

export function useDemoWizard(): DemoWizardContextValue {
  const ctx = useContext(DemoWizardContext);
  if (!ctx) throw new Error("useDemoWizard must be used within DemoWizardContext.Provider");
  return ctx;
}
