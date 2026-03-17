import { redirect } from "next/navigation";

/** Legacy route — redirect to adviser-scoped client detail */
export default async function LegacyClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/adviser/clients/${id}`);
}
