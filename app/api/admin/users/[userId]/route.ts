import { NextResponse } from "next/server";
import { requireAuth, requestFingerprint } from "@/lib/auth/session";
import {
  assertCanAssignUserBranch,
  assertCanManageUser,
  safeUserSnapshot,
} from "@/lib/admin/management";
import { AppError, errorResponse, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { adminUserUpdateSchema } from "@/lib/validation/common";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    const params = await context.params;
    const input = await parseJson(request, adminUserUpdateSchema);

    const before = await prisma.user.findFirst({
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
    assertCanManageUser(auth, before);

    if (before.id === auth.userId && input.isActive === false) {
      throw new AppError(
        409,
        "CANNOT_DEACTIVATE_SELF",
        "You cannot deactivate your own account.",
      );
    }

    const nextRole = input.role ?? before.role;
    const branchIdRequested = Object.prototype.hasOwnProperty.call(
      input,
      "branchId",
    );
    const requestedBranchId = branchIdRequested
      ? (input.branchId ?? null)
      : before.branchId;
    const branch = requestedBranchId
      ? await prisma.branch.findFirst({
          where: { id: requestedBranchId, legalEntityId: auth.legalEntityId },
          select: { id: true, legalEntityId: true, isActive: true },
        })
      : null;
    const branchId = assertCanAssignUserBranch(
      auth,
      nextRole,
      branch,
      requestedBranchId,
    );

    if (before.role === "OWNER" && input.isActive === false) {
      await assertAnotherActiveOwnerExists(before.id, auth.legalEntityId);
    }

    const fingerprint = await requestFingerprint();
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: before.id },
        data: {
          name: input.name,
          role: nextRole,
          branchId,
          isActive: input.isActive,
        },
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

      if (input.isActive === false) {
        await tx.session.updateMany({
          where: {
            legalEntityId: auth.legalEntityId,
            userId: before.id,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
      }

      return updated;
    });

    await prisma.auditLog.create({
      data: {
        legalEntityId: auth.legalEntityId,
        branchId: user.branchId,
        actorUserId: auth.userId,
        action: "ADMIN_USER_EDITED",
        targetType: "user",
        targetId: user.id,
        beforeJson: JSON.parse(JSON.stringify(safeUserSnapshot(before))),
        afterJson: JSON.parse(JSON.stringify(safeUserSnapshot(user))),
        reason: input.reason,
        ipAddress: fingerprint.ipAddress,
        userAgent: fingerprint.userAgent,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    return errorResponse(error);
  }
}

async function assertAnotherActiveOwnerExists(
  userId: string,
  legalEntityId: string,
): Promise<void> {
  const ownerCount = await prisma.user.count({
    where: {
      legalEntityId,
      role: "OWNER",
      isActive: true,
      id: { not: userId },
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
