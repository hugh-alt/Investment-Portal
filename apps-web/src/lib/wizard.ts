/**
 * Wizard framework types and utilities.
 * Used by WizardShell and individual wizard implementations.
 */

export interface WizardStep {
  /** URL-friendly slug, e.g. "step-1" */
  slug: string;
  /** Display title */
  title: string;
  /** Short description shown below the title */
  description?: string;
}

export interface WizardConfig {
  /** Unique key for draft persistence, e.g. "saa-create" */
  draftKey: string;
  /** Base path without trailing slash, e.g. "/adviser/saa/new" */
  basePath: string;
  /** Ordered step definitions */
  steps: WizardStep[];
}

/** Resolve the current step index from a pathname */
export function resolveStepIndex(config: WizardConfig, pathname: string): number {
  const slug = pathname.replace(config.basePath + "/", "").split("/")[0];
  const idx = config.steps.findIndex((s) => s.slug === slug);
  return idx >= 0 ? idx : 0;
}

/** Build the full path for a step by index */
export function stepPath(config: WizardConfig, stepIndex: number): string {
  const step = config.steps[stepIndex];
  if (!step) return config.basePath;
  return `${config.basePath}/${step.slug}`;
}

/** Check if a step index is the first step */
export function isFirstStep(index: number): boolean {
  return index === 0;
}

/** Check if a step index is the last step */
export function isLastStep(config: WizardConfig, index: number): boolean {
  return index === config.steps.length - 1;
}
