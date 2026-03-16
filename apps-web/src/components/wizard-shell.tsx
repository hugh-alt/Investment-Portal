"use client";

import { usePathname, useRouter } from "next/navigation";
import { Check } from "lucide-react";
import type { WizardConfig } from "@/lib/wizard";
import { resolveStepIndex, stepPath, isFirstStep, isLastStep } from "@/lib/wizard";

interface WizardShellProps {
  config: WizardConfig;
  /** Called when "Save Draft" is clicked */
  onSaveDraft?: () => void;
  /** Called when the final step "Confirm" is clicked */
  onComplete?: () => void;
  /** Per-step validation: return true if the current step is valid and Next is allowed */
  isStepValid?: (stepIndex: number) => boolean;
  /** Highest step index the user has reached (for stepper click gating) */
  highestVisited?: number;
  /** Timestamp string for the last draft save */
  lastSaved?: Date | null;
  children: React.ReactNode;
}

export function WizardShell({
  config,
  onSaveDraft,
  onComplete,
  isStepValid,
  highestVisited = 0,
  lastSaved,
  children,
}: WizardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const currentIndex = resolveStepIndex(config, pathname);
  const stepCount = config.steps.length;
  const currentStep = config.steps[currentIndex];

  const canGoNext =
    !isLastStep(config, currentIndex) &&
    (isStepValid ? isStepValid(currentIndex) : true);

  const canGoBack = !isFirstStep(currentIndex);

  function goNext() {
    if (canGoNext) {
      router.push(stepPath(config, currentIndex + 1));
    }
  }

  function goBack() {
    if (canGoBack) {
      router.push(stepPath(config, currentIndex - 1));
    }
  }

  function goToStep(index: number) {
    if (index <= Math.max(highestVisited, currentIndex)) {
      router.push(stepPath(config, index));
    }
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      {/* ── Stepper ── */}
      <div className="border-b border-zinc-200 bg-white px-6 py-4">
        <nav aria-label="Wizard progress" className="flex items-center gap-2">
          {config.steps.map((step, i) => {
            const isCompleted = i < currentIndex;
            const isCurrent = i === currentIndex;
            const isClickable = i <= Math.max(highestVisited, currentIndex);

            return (
              <div key={step.slug} className="flex items-center gap-2">
                {i > 0 && (
                  <div
                    className={`h-px w-8 sm:w-12 ${
                      isCompleted ? "bg-amber-500" : "bg-zinc-200"
                    }`}
                  />
                )}
                <button
                  onClick={() => goToStep(i)}
                  disabled={!isClickable}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors cursor-pointer
                    ${
                      isCurrent
                        ? "bg-amber-50 text-amber-700 font-medium ring-1 ring-amber-200"
                        : isCompleted
                          ? "text-amber-600 hover:bg-amber-50"
                          : isClickable
                            ? "text-zinc-500 hover:bg-zinc-50"
                            : "text-zinc-300 cursor-not-allowed"
                    }
                  `}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium
                      ${
                        isCompleted
                          ? "bg-amber-500 text-white"
                          : isCurrent
                            ? "bg-amber-100 text-amber-700 ring-1 ring-amber-300"
                            : "bg-zinc-100 text-zinc-400"
                      }
                    `}
                  >
                    {isCompleted ? <Check size={14} /> : i + 1}
                  </span>
                  <span className="hidden sm:inline">{step.title}</span>
                </button>
              </div>
            );
          })}
        </nav>
      </div>

      {/* ── Step content ── */}
      <div className="flex-1 px-6 py-6">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-zinc-900">
              {currentStep?.title}
            </h2>
            {currentStep?.description && (
              <p className="mt-1 text-sm text-zinc-500">
                {currentStep.description}
              </p>
            )}
            <p className="mt-1 text-xs text-zinc-400">
              Step {currentIndex + 1} of {stepCount}
            </p>
          </div>

          {children}
        </div>
      </div>

      {/* ── Sticky footer ── */}
      <div className="sticky bottom-0 border-t border-zinc-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              disabled={!canGoBack}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors cursor-pointer
                ${
                  canGoBack
                    ? "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                    : "border-zinc-100 text-zinc-300 cursor-not-allowed"
                }
              `}
            >
              Back
            </button>

            {lastSaved && (
              <span className="text-xs text-zinc-400">
                Draft saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {onSaveDraft && (
              <button
                onClick={onSaveDraft}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                Save Draft
              </button>
            )}

            {isLastStep(config, currentIndex) ? (
              <button
                onClick={onComplete}
                disabled={isStepValid ? !isStepValid(currentIndex) : false}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer
                  ${
                    isStepValid && !isStepValid(currentIndex)
                      ? "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                      : "bg-amber-500 text-white hover:bg-amber-600"
                  }
                `}
              >
                Confirm
              </button>
            ) : (
              <button
                onClick={goNext}
                disabled={!canGoNext}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer
                  ${
                    canGoNext
                      ? "bg-zinc-900 text-white hover:bg-zinc-800"
                      : "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                  }
                `}
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
