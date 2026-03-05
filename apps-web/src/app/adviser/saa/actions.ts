"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SAAScope } from "@/generated/prisma/enums";

// ── Create SAA ───────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  taxonomyId: z.string().min(1, "Select a taxonomy"),
});

export type CreateSAAState = { error?: string };

export async function createSAAAction(
  _prev: CreateSAAState,
  formData: FormData,
): Promise<CreateSAAState> {
  const user = await requireUser();

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    taxonomyId: formData.get("taxonomyId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let adviserId: string | undefined;
  let ownerScope: SAAScope = SAAScope.FIRM;
  if (user.role === "ADVISER") {
    const adviser = await prisma.adviser.findUnique({ where: { userId: user.id } });
    if (!adviser) return { error: "Adviser record not found" };
    adviserId = adviser.id;
    ownerScope = SAAScope.ADVISER;
  }

  const saa = await prisma.sAA.create({
    data: {
      name: parsed.data.name,
      taxonomyId: parsed.data.taxonomyId,
      ownerScope,
      adviserId,
    },
  });
  redirect(`/adviser/saa/${saa.id}`);
}

// ── Save allocations ─────────────────────────────────────

const allocSchema = z.object({
  saaId: z.string().min(1),
  allocations: z.string(), // JSON: {nodeId: string, targetWeight: number}[]
});

export type SaveAllocState = { error?: string; success?: boolean };

export async function saveAllocationsAction(
  _prev: SaveAllocState,
  formData: FormData,
): Promise<SaveAllocState> {
  await requireUser();

  const parsed = allocSchema.safeParse({
    saaId: formData.get("saaId"),
    allocations: formData.get("allocations"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let allocs: { nodeId: string; targetWeight: number; minWeight: number; maxWeight: number }[];
  try {
    allocs = JSON.parse(parsed.data.allocations);
  } catch {
    return { error: "Invalid allocation data" };
  }

  // Validate total is ~100%
  const total = allocs.reduce((s, a) => s + a.targetWeight, 0);
  if (Math.abs(total - 1) > 0.005) {
    return { error: `Weights must sum to 100% (currently ${(total * 100).toFixed(1)}%)` };
  }

  // Validate min ≤ target ≤ max and all within 0–1
  for (const a of allocs) {
    if (a.minWeight < 0 || a.maxWeight > 1) {
      return { error: "Weights must be between 0% and 100%" };
    }
    if (a.minWeight > a.targetWeight + 0.0005) {
      return { error: "Min weight cannot exceed target weight" };
    }
    if (a.maxWeight < a.targetWeight - 0.0005) {
      return { error: "Max weight cannot be less than target weight" };
    }
  }

  // Delete old, insert new
  await prisma.sAAAllocation.deleteMany({ where: { saaId: parsed.data.saaId } });
  for (const a of allocs) {
    if (a.targetWeight > 0) {
      await prisma.sAAAllocation.create({
        data: {
          saaId: parsed.data.saaId,
          nodeId: a.nodeId,
          targetWeight: a.targetWeight,
          minWeight: a.minWeight,
          maxWeight: a.maxWeight,
        },
      });
    }
  }

  revalidatePath(`/adviser/saa/${parsed.data.saaId}`);
  return { success: true };
}

// ── Assign SAA to client ─────────────────────────────────

const assignSchema = z.object({
  clientId: z.string().min(1),
  saaId: z.string().min(1),
});

export async function assignSAAAction(
  _prev: SaveAllocState,
  formData: FormData,
): Promise<SaveAllocState> {
  await requireUser();

  const parsed = assignSchema.safeParse({
    clientId: formData.get("clientId"),
    saaId: formData.get("saaId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const saaId = parsed.data.saaId === "__none__" ? null : parsed.data.saaId;

  if (saaId) {
    await prisma.clientSAA.upsert({
      where: { clientId: parsed.data.clientId },
      update: { saaId },
      create: { clientId: parsed.data.clientId, saaId },
    });
  } else {
    await prisma.clientSAA.deleteMany({ where: { clientId: parsed.data.clientId } });
  }

  revalidatePath(`/clients/${parsed.data.clientId}`);
  return { success: true };
}
