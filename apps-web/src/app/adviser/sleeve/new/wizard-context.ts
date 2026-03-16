"use client";

import { createContext, useContext } from "react";
import type { SleeveWizardData } from "./wizard-config";

export interface SleeveWizardContextValue {
  data: SleeveWizardData;
  update: (partial: Partial<SleeveWizardData>) => void;
}

export const SleeveWizardContext = createContext<SleeveWizardContextValue | null>(null);

export function useSleeveWizard(): SleeveWizardContextValue {
  const ctx = useContext(SleeveWizardContext);
  if (!ctx) throw new Error("useSleeveWizard must be used within SleeveWizardContext.Provider");
  return ctx;
}
