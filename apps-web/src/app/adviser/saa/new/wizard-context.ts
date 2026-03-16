"use client";

import { createContext, useContext } from "react";
import type { SAAWizardData } from "./wizard-config";

export interface SAAWizardContextValue {
  data: SAAWizardData;
  update: (partial: Partial<SAAWizardData>) => void;
}

export const SAAWizardContext = createContext<SAAWizardContextValue | null>(null);

export function useSAAWizard(): SAAWizardContextValue {
  const ctx = useContext(SAAWizardContext);
  if (!ctx) throw new Error("useSAAWizard must be used within SAAWizardContext.Provider");
  return ctx;
}
