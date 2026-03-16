import { redirect } from "next/navigation";

/**
 * /adviser/clients/[id] — Proxies to the existing /clients/[id] detail page.
 * The full client overview will be built in Phase 3 under this route.
 * For now, redirect to the existing route to keep things working.
 */
export default async function AdviserClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/clients/${id}`);
}
