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
      },
    });

    if (!canIssueSessionForUser(user)) {
      return invalidLogin();
    }

    const validPassword = await verifyPassword(
      user.passwordHash,
      input.password,
    );

    if (!validPassword) {
      return invalidLogin();
    }

    const fingerprint = await requestFingerprint();
    const session = await createSession({
      userId: user.id,
      legalEntityId: user.legalEntityId,
      ...fingerprint,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
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
