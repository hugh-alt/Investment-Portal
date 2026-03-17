"use client";

import { WizardShell } from "@/components/wizard-shell";
import { useWizardDraft } from "@/hooks/use-wizard-draft";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { REBALANCE_WIZARD_CONFIG, REBALANCE_WIZARD_DEFAULTS, type RebalanceWizardData } from "../wizard-config";
import { RebalanceWizardContext } from "../wizard-context";

export default function RebalanceWizardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data, update, clear, lastSaved } = useWizardDraft<RebalanceWizardData>(
    REBALANCE_WIZARD_CONFIG.draftKey,
    REBALANCE_WIZARD_DEFAULTS,
  );

  const isStepValid = useCallback(
    (stepIndex: number): boolean => {
      switch (stepIndex) {
        case 0: // Client + SAA selected, plan generated
          return data.planId.length > 0;
        case 1: // Drift reviewed (just needs plan)
          return data.beforeDrift.length > 0;
        case 2: // Liquidity checked
          return data.liquidityChecked;
        case 3: // Trades exist (at least 1 valid trade)
          return data.trades.filter((t) => t.amount > 0).length > 0;
        case 4: // Approval — valid once plan reaches CLIENT_APPROVED
          return data.planStatus === "CLIENT_APPROVED";
        case 5: // Execute — always accessible after approval
          return true;
        default:
          return false;
      }
    },
    [data.planId, data.beforeDrift.length, data.liquidityChecked, data.trades, data.planStatus],
  );

  const handleComplete = useCallback(() => {
    const clientId = data.clientId;
    clear();
    router.push(`/adviser/rebalance/new/done?clientId=${clientId}`);
  }, [clear, router, data.clientId]);

  return (
    <RebalanceWizardContext.Provider value={{ data, update }}>
      <WizardShell
        config={REBALANCE_WIZARD_CONFIG}
        isStepValid={isStepValid}
        highestVisited={REBALANCE_WIZARD_CONFIG.steps.length - 1}
        lastSaved={lastSaved}
        onSaveDraft={() => {}}
        onComplete={handleComplete}
      >
        {children}
      </WizardShell>
    </RebalanceWizardContext.Provider>
  );
}
