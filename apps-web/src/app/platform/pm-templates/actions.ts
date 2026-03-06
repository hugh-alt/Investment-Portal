"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateMonotonicCumPct, type CurvePoint } from "@/lib/pm-curves";

// ── Create / Update Template ────────────────────────────

const templateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
  callCurvePctJson: z.string().min(2),
  distCurvePctJson: z.string().min(2),
});

export type TemplateFormState = { error?: string; success?: boolean };

export async function saveTemplateAction(
  _prev: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  await requireSuperAdmin();

  const parsed = templateSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    callCurvePctJson: formData.get("callCurvePctJson"),
    distCurvePctJson: formData.get("distCurvePctJson"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let callCurve: CurvePoint[];
  let distCurve: CurvePoint[];
  try {
    callCurve = JSON.parse(parsed.data.callCurvePctJson);
    distCurve = JSON.parse(parsed.data.distCurvePctJson);
  } catch {
    return { error: "Invalid JSON format" };
  }

  const callVal = validateMonotonicCumPct(callCurve);
  if (!callVal.valid) return { error: `Call curve: ${callVal.error}` };
  const distVal = validateMonotonicCumPct(distCurve);
  if (!distVal.valid) return { error: `Dist curve: ${distVal.error}` };

  if (parsed.data.id) {
    await prisma.pMProjectionTemplate.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description || null,
        callCurvePctJson: parsed.data.callCurvePctJson,
        distCurvePctJson: parsed.data.distCurvePctJson,
      },
    });
  } else {
    await prisma.pMProjectionTemplate.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description || null,
        callCurvePctJson: parsed.data.callCurvePctJson,
        distCurvePctJson: parsed.data.distCurvePctJson,
      },
    });
  }

  revalidatePath("/platform/pm-templates");
  return { success: true };
}

// ── Retire / Activate Template ──────────────────────────

export async function toggleTemplateStatusAction(
  _prev: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  await requireSuperAdmin();

  const id = formData.get("id") as string;
  const newStatus = formData.get("newStatus") as string;
  if (!id || !newStatus) return { error: "Missing fields" };

  await prisma.pMProjectionTemplate.update({
    where: { id },
    data: { status: newStatus as "ACTIVE" | "RETIRED" },
  });

  revalidatePath("/platform/pm-templates");
  return { success: true };
}

// ── Set Default Template for Fund Truth ─────────────────

const setFundDefaultSchema = z.object({
  fundId: z.string().min(1),
  templateId: z.string().min(1),
});

export async function setFundDefaultTemplateAction(
  _prev: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  await requireSuperAdmin();

  const parsed = setFundDefaultSchema.safeParse({
    fundId: formData.get("fundId"),
    templateId: formData.get("templateId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.pMFundTruth.upsert({
    where: { fundId: parsed.data.fundId },
    update: { defaultTemplateId: parsed.data.templateId },
    create: {
      fundId: parsed.data.fundId,
      defaultTemplateId: parsed.data.templateId,
    },
  });

  revalidatePath("/platform/pm-templates");
  revalidatePath("/admin/pm-funds");
  return { success: true };
}
