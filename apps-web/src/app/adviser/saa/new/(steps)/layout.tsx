"use client";

import { WizardShell } from "@/components/wizard-shell";
import { useWizardDraft } from "@/hooks/use-wizard-draft";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { SAA_WIZARD_CONFIG, SAA_WIZARD_DEFAULTS, type SAAWizardData } from "../wizard-config";
import { SAAWizardContext } from "../wizard-context";

export default function SAAWizardStepsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data, update, clear, lastSaved } = useWizardDraft<SAAWizardData>(
    SAA_WIZARD_CONFIG.draftKey,
    SAA_WIZARD_DEFAULTS,
  );

  const isStepValid = useCallback(
    (stepIndex: number): boolean => {
      switch (stepIndex) {
        case 0: // Basics
          return data.name.trim().length > 0 && data.taxonomyId.length > 0 && data.saaId.length > 0;
        case 1: { // Targets
          const total = Object.values(data.weights).reduce((s, w) => s + w, 0);
          return Math.abs(total - 1) <= 0.005 && Object.values(data.weights).some((w) => w > 0);
        }
        case 2: { // Tolerances
          for (const nodeId of Object.keys(data.weights)) {
            const t = data.weights[nodeId] ?? 0;
            if (t === 0) continue;
            const lo = data.mins[nodeId] ?? 0;
            const hi = data.maxs[nodeId] ?? 0;
            if (lo > t + 0.0005 || hi < t - 0.0005) return false;
            if (lo < 0 || hi > 1) return false;
          }
          return true;
        }
        case 3: // Assign — always valid (skip is allowed)
          return true;
        default:
          return false;
      }
    },
    [data.name, data.taxonomyId, data.saaId, data.weights, data.mins, data.maxs],
  );

  const handleComplete = useCallback(() => {
    const saaId = data.saaId;
    clear();
    router.push(`/adviser/saa/new/done?saaId=${saaId}`);
  }, [clear, router, data.saaId]);

  return (
    <SAAWizardContext.Provider value={{ data, update }}>
      <WizardShell
        config={SAA_WIZARD_CONFIG}
        isStepValid={isStepValid}
        highestVisited={SAA_WIZARD_CONFIG.steps.length - 1}
        lastSaved={lastSaved}
        onSaveDraft={() => {/* auto-saved */}}
        onComplete={handleComplete}
      >
        {children}
      </WizardShell>
    </SAAWizardContext.Provider>
  );
}
