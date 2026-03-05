"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, setSessionCookie } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
  } catch {
    return { error: "Unable to reach the database. Please try again." };
  }

  if (!user) {
    return { error: "No account found with that email." };
  }

  const token = await createSession(user.id);
  await setSessionCookie(token);
  redirect("/dashboard");
}
