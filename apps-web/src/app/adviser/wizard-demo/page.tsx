import { redirect } from "next/navigation";

/** /adviser/wizard-demo → redirect to step-1 */
export default function WizardDemoIndex() {
  redirect("/adviser/wizard-demo/step-1");
}
