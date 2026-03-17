import { redirect } from "next/navigation";

/** Legacy route — redirect to adviser-scoped client list */
export default function LegacyClientsPage() {
  redirect("/adviser/clients");
}
