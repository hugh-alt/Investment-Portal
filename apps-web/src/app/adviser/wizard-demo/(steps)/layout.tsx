"use client";

import { WizardShell } from "@/components/wizard-shell";
import { useWizardDraft } from "@/hooks/use-wizard-draft";
import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";
import { DEMO_WIZARD_CONFIG, DEMO_DEFAULTS, type DemoFormData } from "../wizard-config";
import { DemoWizardContext } from "../wizard-context";

export default function WizardStepsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data, update, clear, lastSaved } = useWizardDraft<DemoFormData>(
    DEMO_WIZARD_CONFIG.draftKey,
    DEMO_DEFAULTS,
  );

  const isStepValid = useCallback(
    (stepIndex: number): boolean => {
      switch (stepIndex) {
        case 0:
          return data.name.trim().length > 0;
        case 1:
          return data.category.trim().length > 0;
        case 2:
          return true;
        default:
          return false;
      }
    },
    [data.name, data.category],
  );

  const handleComplete = useCallback(() => {
    clear();
    router.push("/adviser/wizard-demo/done");
  }, [clear, router]);

  return (
    <DemoWizardContext.Provider value={{ data, update }}>
      <WizardShell
        config={DEMO_WIZARD_CONFIG}
        isStepValid={isStepValid}
        highestVisited={DEMO_WIZARD_CONFIG.steps.length - 1}
        lastSaved={lastSaved}
        onSaveDraft={() => {/* auto-saved via hook */}}
        onComplete={handleComplete}
      >
        {children}
      </WizardShell>
    </DemoWizardContext.Provider>
  );
}
