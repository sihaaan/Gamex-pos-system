import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import { canIssueSessionForUser } from "@/lib/auth/login-policy";
import {
  createSession,
  requestFingerprint,
  setSessionCookie,
} from "@/lib/auth/session";
import { errorResponse, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation/common";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// A real argon2id hash (same cost parameters as production hashes) for a
// throwaway password. Verifying against it when the user is not found keeps
// unknown-email and wrong-password responses on the same timing profile.
const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$tCodO8bKeFCMoiujUhAD0Q$iOBnbEVh1OMvLUd1nrVGVgFyNqCB1NfUU+QS+uO0i+k";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const input = await parseJson(request, loginSchema);
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      select: {
        id: true,
        legalEntityId: true,
        branchId: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
        isActive: true,
        failedLoginAttempts: true,
        lockedUntil: true,
      },
    });

    const now = new Date();
    if (user?.lockedUntil && user.lockedUntil > now) {
      return lockedLogin();
    }

    // Always run one password verification so that unknown emails and
    // inactive accounts take the same time as a real password check.
    const validPassword = await verifyPassword(
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
      input.password,
    );

    if (!canIssueSessionForUser(user)) {
      return invalidLogin();
    }

    if (!validPassword) {
      const failedLoginAttempts = user.failedLoginAttempts + 1;
      const lock = failedLoginAttempts >= MAX_FAILED_ATTEMPTS;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts,
          lockedUntil: lock
            ? new Date(now.getTime() + LOCKOUT_MINUTES * 60_000)
            : null,
        },
      });
      return lock ? lockedLogin() : invalidLogin();
    }

    const fingerprint = await requestFingerprint();
    const session = await createSession({
      userId: user.id,
      legalEntityId: user.legalEntityId,
      ...fingerprint,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: now,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        legalEntityId: user.legalEntityId,
        branchId: user.branchId,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
    setSessionCookie(response, session.token, session.absoluteExpiresAt);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

function invalidLogin(): NextResponse {
  return NextResponse.json(
    { error: { code: "INVALID_LOGIN", message: "Invalid email or password." } },
    { status: 401 },
  );
}

function lockedLogin(): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "ACCOUNT_LOCKED",
        message: "Too many failed attempts. Try again in a few minutes.",
      },
    },
    { status: 429 },
  );
}
