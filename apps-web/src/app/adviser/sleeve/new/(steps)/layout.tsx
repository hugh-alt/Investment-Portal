"use client";

import { WizardShell } from "@/components/wizard-shell";
import { useWizardDraft } from "@/hooks/use-wizard-draft";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { SLEEVE_WIZARD_CONFIG, SLEEVE_WIZARD_DEFAULTS, type SleeveWizardData } from "../wizard-config";
import { SleeveWizardContext } from "../wizard-context";

export default function SleeveWizardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data, update, clear, lastSaved } = useWizardDraft<SleeveWizardData>(
    SLEEVE_WIZARD_CONFIG.draftKey,
    SLEEVE_WIZARD_DEFAULTS,
  );

  const isStepValid = useCallback(
    (stepIndex: number): boolean => {
      switch (stepIndex) {
        case 0: // Client & basics
          return data.sleeveId.length > 0;
        case 1: // Liquid bucket
          return data.liquidPositions.length > 0;
        case 2: // Commitments — valid if skipped or has entries
          return data.commitmentsSkipped || data.commitments.length > 0;
        case 3: // Buffer rules — always valid with defaults
          return true;
        case 4: // Waterfalls — always valid (can be empty)
          return true;
        case 5: // Review — always valid
          return true;
        default:
          return false;
      }
    },
    [data.sleeveId, data.liquidPositions.length, data.commitments.length, data.commitmentsSkipped],
  );

  const handleComplete = useCallback(() => {
    const clientId = data.clientId;
    clear();
    router.push(`/adviser/sleeve/new/done?clientId=${clientId}`);
  }, [clear, router, data.clientId]);

  return (
    <SleeveWizardContext.Provider value={{ data, update }}>
      <WizardShell
        config={SLEEVE_WIZARD_CONFIG}
        isStepValid={isStepValid}
        highestVisited={SLEEVE_WIZARD_CONFIG.steps.length - 1}
        lastSaved={lastSaved}
        onSaveDraft={() => {}}
        onComplete={handleComplete}
      >
        {children}
      </WizardShell>
    </SleeveWizardContext.Provider>
  );
}
