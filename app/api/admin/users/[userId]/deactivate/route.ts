import { NextResponse } from "next/server";
import { requireAuth, requestFingerprint } from "@/lib/auth/session";
import { assertCanManageUser, safeUserSnapshot } from "@/lib/admin/management";
import { AppError, errorResponse, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { adminStateChangeSchema } from "@/lib/validation/common";

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
    const input = await parseJson(request, adminStateChangeSchema);

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

    if (target.id === auth.userId) {
      throw new AppError(
        409,
        "CANNOT_DEACTIVATE_SELF",
        "You cannot deactivate your own account.",
      );
    }

    if (target.role === "OWNER") {
      const ownerCount = await prisma.user.count({
        where: {
          legalEntityId: auth.legalEntityId,
          role: "OWNER",
          isActive: true,
          id: { not: target.id },
        },
      });
      if (ownerCount === 0) {
        throw new AppError(
          409,
          "LAST_OWNER",
          "At least one active owner must remain.",
        );
      }
    }

    const fingerprint = await requestFingerprint();
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: target.id },
        data: { isActive: false },
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
          action: "ADMIN_USER_DEACTIVATED",
          targetType: "user",
          targetId: target.id,
          beforeJson: JSON.parse(JSON.stringify(safeUserSnapshot(target))),
          afterJson: JSON.parse(JSON.stringify(safeUserSnapshot(updated))),
          reason: input.reason,
          ipAddress: fingerprint.ipAddress,
          userAgent: fingerprint.userAgent,
        },
      });
      return updated;
    });

    return NextResponse.json({ user });
  } catch (error) {
    return errorResponse(error);
  }
}
