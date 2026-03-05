"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createTaxonomyWithDefaults,
  addNode,
  renameNode,
  deleteNode,
  swapSortOrder,
} from "@/lib/taxonomy";
import { TaxonomyNodeType } from "@/generated/prisma/enums";

// ── Create Taxonomy ──────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
});

export type CreateState = { error?: string };

export async function createTaxonomyAction(
  _prev: CreateState,
  formData: FormData,
): Promise<CreateState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Not authorised" };

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const taxonomy = await createTaxonomyWithDefaults(
    parsed.data.name,
    user.id,
    parsed.data.description,
  );
  redirect(`/admin/taxonomy/${taxonomy.id}`);
}

// ── Delete Taxonomy ──────────────────────────────────────

export async function deleteTaxonomyAction(taxonomyId: string) {
  const user = await requireUser();
  if (user.role !== "ADMIN") return;
  await prisma.taxonomy.delete({ where: { id: taxonomyId } });
  revalidatePath("/admin/taxonomy");
  redirect("/admin/taxonomy");
}

// ── Add Node ─────────────────────────────────────────────

const addNodeSchema = z.object({
  taxonomyId: z.string().min(1),
  parentId: z.string().nullable(),
  name: z.string().min(1, "Name is required").max(100),
  nodeType: z.nativeEnum(TaxonomyNodeType),
});

export type NodeActionState = { error?: string };

export async function addNodeAction(
  _prev: NodeActionState,
  formData: FormData,
): Promise<NodeActionState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Not authorised" };

  const parsed = addNodeSchema.safeParse({
    taxonomyId: formData.get("taxonomyId"),
    parentId: formData.get("parentId") || null,
    name: formData.get("name"),
    nodeType: formData.get("nodeType"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await addNode(
    parsed.data.taxonomyId,
    parsed.data.parentId,
    parsed.data.name,
    parsed.data.nodeType,
  );
  revalidatePath(`/admin/taxonomy/${parsed.data.taxonomyId}`);
  return {};
}

// ── Rename Node ──────────────────────────────────────────

const renameSchema = z.object({
  nodeId: z.string().min(1),
  name: z.string().min(1, "Name is required").max(100),
  taxonomyId: z.string().min(1),
});

export async function renameNodeAction(
  _prev: NodeActionState,
  formData: FormData,
): Promise<NodeActionState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Not authorised" };

  const parsed = renameSchema.safeParse({
    nodeId: formData.get("nodeId"),
    name: formData.get("name"),
    taxonomyId: formData.get("taxonomyId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await renameNode(parsed.data.nodeId, parsed.data.name);
  revalidatePath(`/admin/taxonomy/${parsed.data.taxonomyId}`);
  return {};
}

// ── Delete Node ──────────────────────────────────────────

export async function deleteNodeAction(
  taxonomyId: string,
  nodeId: string,
) {
  const user = await requireUser();
  if (user.role !== "ADMIN") return;
  await deleteNode(nodeId);
  revalidatePath(`/admin/taxonomy/${taxonomyId}`);
}

// ── Reorder Node ─────────────────────────────────────────

export async function reorderNodeAction(
  taxonomyId: string,
  nodeIdA: string,
  nodeIdB: string,
) {
  const user = await requireUser();
  if (user.role !== "ADMIN") return;
  await swapSortOrder(nodeIdA, nodeIdB);
  revalidatePath(`/admin/taxonomy/${taxonomyId}`);
}
