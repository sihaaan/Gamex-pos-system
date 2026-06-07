import { createHash, randomBytes } from "crypto";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/http";
import type { UserRole } from "@/lib/generated/prisma/enums";

export const SESSION_COOKIE_NAME = "gamex_session";

const IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000;
const ABSOLUTE_TIMEOUT_MS = 14 * 24 * 60 * 60 * 1000;

export type AuthContext = {
  sessionId: string;
  userId: string;
  legalEntityId: string;
  branchId: string | null;
  role: UserRole;
  name: string;
  email: string;
};

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiryDates(now = new Date()): {
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
} {
  return {
    idleExpiresAt: new Date(now.getTime() + IDLE_TIMEOUT_MS),
    absoluteExpiresAt: new Date(now.getTime() + ABSOLUTE_TIMEOUT_MS),
  };
}

export async function createSession(params: {
  userId: string;
  legalEntityId: string;
  userAgent?: string;
  ipAddress?: string;
}): Promise<{ token: string; absoluteExpiresAt: Date }> {
  const token = createSessionToken();
  const { idleExpiresAt, absoluteExpiresAt } = sessionExpiryDates();

  await prisma.session.create({
    data: {
      userId: params.userId,
      legalEntityId: params.legalEntityId,
      tokenHash: hashSessionToken(token),
      userAgent: params.userAgent,
      ipAddress: params.ipAddress,
      idleExpiresAt,
      absoluteExpiresAt,
    },
  });

  return { token, absoluteExpiresAt };
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  expires: Date,
): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const now = new Date();
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (
    !session ||
    session.revokedAt ||
    session.idleExpiresAt <= now ||
    session.absoluteExpiresAt <= now ||
    !session.user.isActive
  ) {
    return null;
  }

  await prisma.session.update({
    where: { id: session.id },
    data: {
      idleExpiresAt: new Date(now.getTime() + IDLE_TIMEOUT_MS),
    },
  });

  return {
    sessionId: session.id,
    userId: session.userId,
    legalEntityId: session.legalEntityId,
    branchId: session.user.branchId,
    role: session.user.role,
    name: session.user.name,
    email: session.user.email,
  };
}

export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuthContext();
  if (!auth) {
    throw new AppError(401, "UNAUTHENTICATED", "Please sign in again.");
  }
  return auth;
}

export async function revokeCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return;
  }

  await prisma.session.updateMany({
    where: { tokenHash: hashSessionToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function requestFingerprint(): Promise<{
  userAgent?: string;
  ipAddress?: string;
}> {
  const headerStore = await headers();
  return {
    userAgent: headerStore.get("user-agent") ?? undefined,
    ipAddress:
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headerStore.get("x-real-ip") ??
      undefined,
  };
}
