"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SAAScope } from "@/generated/prisma/enums";
import { TaxonomyNodeType } from "@/generated/prisma/enums";

// ── Step 1: Create draft SAA ─────────────────────────────

const createDraftSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  taxonomyId: z.string().min(1, "Select a taxonomy"),
});

export type WizardActionResult = {
  error?: string;
  success?: boolean;
  saaId?: string;
};

export async function createDraftSAAAction(
  name: string,
  taxonomyId: string,
): Promise<WizardActionResult> {
  const user = await requireUser();

  const parsed = createDraftSchema.safeParse({ name, taxonomyId });
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

  return { success: true, saaId: saa.id };
}

// ── Step 2+3: Save allocations with tolerances ───────────

export async function saveWizardAllocationsAction(
  saaId: string,
  allocations: { nodeId: string; targetWeight: number; minWeight: number; maxWeight: number }[],
): Promise<WizardActionResult> {
  await requireUser();

  if (!saaId) return { error: "SAA ID is missing" };

  // Validate total is ~100%
  const total = allocations.reduce((s, a) => s + a.targetWeight, 0);
  if (Math.abs(total - 1) > 0.005) {
    return { error: `Weights must sum to 100% (currently ${(total * 100).toFixed(1)}%)` };
  }

  // Validate min ≤ target ≤ max and all within 0–1
  for (const a of allocations) {
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
  await prisma.sAAAllocation.deleteMany({ where: { saaId } });
  for (const a of allocations) {
    if (a.targetWeight > 0) {
      await prisma.sAAAllocation.create({
        data: {
          saaId,
          nodeId: a.nodeId,
          targetWeight: a.targetWeight,
          minWeight: a.minWeight,
          maxWeight: a.maxWeight,
        },
      });
    }
  }

  revalidatePath(`/adviser/saa/${saaId}`);
  return { success: true };
}

// ── Step 4: Assign to clients ────────────────────────────

export async function assignSAAToClientsAction(
  saaId: string,
  clientIds: string[],
): Promise<WizardActionResult> {
  await requireUser();

  if (!saaId) return { error: "SAA ID is missing" };

  for (const clientId of clientIds) {
    await prisma.clientSAA.upsert({
      where: { clientId },
      update: { saaId },
      create: { clientId, saaId },
    });
    revalidatePath(`/clients/${clientId}`);
  }

  revalidatePath(`/adviser/saa/${saaId}`);
  return { success: true };
}

// ── Taxonomy tree loader (for steps 2 & 3) ──────────────

export type TaxonomyTree = {
  id: string;
  name: string;
  children: { id: string; name: string }[];
}[];

export async function loadTaxonomyTree(taxonomyId: string): Promise<TaxonomyTree> {
  const taxonomy = await prisma.taxonomy.findUnique({
    where: { id: taxonomyId },
    include: { nodes: { orderBy: { sortOrder: "asc" } } },
  });

  if (!taxonomy) return [];

  const riskBuckets = taxonomy.nodes.filter(
    (n) => n.nodeType === TaxonomyNodeType.RISK,
  );
  const assetClasses = taxonomy.nodes.filter(
    (n) => n.nodeType === TaxonomyNodeType.ASSET_CLASS,
  );

  return riskBuckets.map((rb) => ({
    id: rb.id,
    name: rb.name,
    children: assetClasses
      .filter((ac) => ac.parentId === rb.id)
      .map((ac) => ({ id: ac.id, name: ac.name })),
  }));
}
