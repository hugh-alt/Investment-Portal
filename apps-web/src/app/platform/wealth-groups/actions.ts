"use server";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createWealthGroupAction(_prev: unknown, formData: FormData) {
  await requireSuperAdmin();
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Name is required" };

  await prisma.wealthGroup.create({ data: { name } });
  revalidatePath("/platform/wealth-groups");
  return { success: true };
}

export async function assignUserWealthGroupAction(_prev: unknown, formData: FormData) {
  await requireSuperAdmin();
  const userId = formData.get("userId") as string;
  const wealthGroupId = (formData.get("wealthGroupId") as string) || null;
  const role = formData.get("role") as string;

  if (!userId) return { error: "User is required" };

  // Update user
  await prisma.user.update({
    where: { id: userId },
    data: {
      wealthGroupId,
      ...(role ? { role: role as "ADMIN" | "ADVISER" | "SUPER_ADMIN" } : {}),
    },
  });

  // Also update adviser record if exists
  const adviser = await prisma.adviser.findUnique({ where: { userId } });
  if (adviser) {
    await prisma.adviser.update({
      where: { id: adviser.id },
      data: { wealthGroupId },
    });

    // Update all clients of this adviser
    if (wealthGroupId) {
      await prisma.client.updateMany({
        where: { adviserId: adviser.id },
        data: { wealthGroupId },
      });
    }
  }

  revalidatePath("/platform/wealth-groups");
  return { success: true };
}
