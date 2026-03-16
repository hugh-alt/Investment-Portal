import { AppShell } from "@/components/app-shell";

export default async function AdviserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
