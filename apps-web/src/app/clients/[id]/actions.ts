"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function setClientCMASelectionAction(clientId: string, cmaSetId: string | null) {
  const user = await requireUser();

  // Adviser can only change their own clients, admin can change all
  if (user.role === "ADVISER") {
    const adviser = await prisma.adviser.findUnique({ where: { userId: user.id } });
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!adviser || !client || client.adviserId !== adviser.id) {
      return;
    }
  }

  if (cmaSetId) {
    // Verify set exists and is not RETIRED
    const cmaSet = await prisma.cMASet.findUnique({ where: { id: cmaSetId } });
    if (!cmaSet || cmaSet.status === "RETIRED") return;

    await prisma.clientCMASelection.upsert({
      where: { clientId },
      update: { cmaSetId },
      create: { clientId, cmaSetId },
    });
  } else {
    // Remove selection (revert to firm default)
    await prisma.clientCMASelection.deleteMany({ where: { clientId } });
  }

  revalidatePath(`/clients/${clientId}`);
}
