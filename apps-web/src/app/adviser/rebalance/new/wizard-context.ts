"use client";

import { createContext, useContext } from "react";
import type { RebalanceWizardData } from "./wizard-config";

export interface RebalanceWizardContextValue {
  data: RebalanceWizardData;
  update: (partial: Partial<RebalanceWizardData>) => void;
}

export const RebalanceWizardContext = createContext<RebalanceWizardContextValue | null>(null);

export function useRebalanceWizard(): RebalanceWizardContextValue {
  const ctx = useContext(RebalanceWizardContext);
  if (!ctx) throw new Error("useRebalanceWizard must be used within RebalanceWizardContext.Provider");
  return ctx;
}
