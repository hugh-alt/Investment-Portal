import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./prisma";
import type { User } from "../generated/prisma/client";
import type { Role } from "../generated/prisma/enums";

const COOKIE_NAME = "session";
const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "dev-secret-change-in-production",
);

export async function createSession(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function getSessionUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub) return null;
    return await prisma.user.findUnique({ where: { id: payload.sub } });
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// ── Role helpers (pure, testable) ───────────────────────

/** Check if a user has one of the given roles. SUPER_ADMIN always passes. */
export function hasRole(user: { role: string }, ...roles: Role[]): boolean {
  if (user.role === "SUPER_ADMIN") return true;
  return roles.includes(user.role as Role);
}

/** True if user is ADMIN or SUPER_ADMIN. */
export function isAdmin(user: { role: string }): boolean {
  return user.role === "ADMIN" || user.role === "SUPER_ADMIN";
}

/** True if user is SUPER_ADMIN. */
export function isSuperAdmin(user: { role: string }): boolean {
  return user.role === "SUPER_ADMIN";
}

/** Require the user has one of the given roles, or redirect to dashboard. */
export async function requireRole(...roles: Role[]): Promise<User> {
  const user = await requireUser();
  if (!hasRole(user, ...roles)) {
    redirect("/dashboard");
  }
  return user;
}

/** Require the user is SUPER_ADMIN (for future platform pages). */
export async function requireSuperAdmin(): Promise<User> {
  const user = await requireUser();
  if (!isSuperAdmin(user)) {
    redirect("/dashboard");
  }
  return user;
}
