import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { requireAuth, requestFingerprint } from "@/lib/auth/session";
import { assertCanManageUser, safeUserSnapshot } from "@/lib/admin/management";
import { errorResponse, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { adminPasswordResetSchema } from "@/lib/validation/common";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    const params = await context.params;
    const input = await parseJson(request, adminPasswordResetSchema);

    const target = await prisma.user.findFirst({
      where: { id: params.userId, legalEntityId: auth.legalEntityId },
      select: {
        id: true,
        legalEntityId: true,
        branchId: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    assertCanManageUser(auth, target);

    const passwordHash = await hashPassword(input.temporaryPassword);
    const fingerprint = await requestFingerprint();
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: { passwordHash },
      });
      await tx.session.updateMany({
        where: {
          legalEntityId: auth.legalEntityId,
          userId: target.id,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          legalEntityId: auth.legalEntityId,
          branchId: target.branchId,
          actorUserId: auth.userId,
          action: "ADMIN_USER_PASSWORD_RESET",
          targetType: "user",
          targetId: target.id,
          beforeJson: JSON.parse(JSON.stringify(safeUserSnapshot(target))),
          afterJson: { passwordReset: true, sessionsRevoked: true },
          reason: input.reason,
          ipAddress: fingerprint.ipAddress,
          userAgent: fingerprint.userAgent,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
