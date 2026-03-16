import { redirect } from "next/navigation";

/** /adviser/sleeve → redirect to the sleeve wizard */
export default function SleeveIndexPage() {
  redirect("/adviser/sleeve/new");
}
