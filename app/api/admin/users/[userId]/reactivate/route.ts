import { NextResponse } from "next/server";
import { requireAuth, requestFingerprint } from "@/lib/auth/session";
import { assertCanManageUser, safeUserSnapshot } from "@/lib/admin/management";
import { errorResponse, parseJson } from "@/lib/http";
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

    if (target.branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: target.branchId, legalEntityId: auth.legalEntityId },
        select: { isActive: true },
      });
      if (!branch?.isActive) {
        return NextResponse.json(
          {
            error: {
              code: "BRANCH_INACTIVE",
              message: "Reactivate the branch before reactivating this user.",
            },
          },
          { status: 409 },
        );
      }
    }

    const fingerprint = await requestFingerprint();
    const user = await prisma.user.update({
      where: { id: target.id },
      data: { isActive: true },
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

    await prisma.auditLog.create({
      data: {
        legalEntityId: auth.legalEntityId,
        branchId: user.branchId,
        actorUserId: auth.userId,
        action: "ADMIN_USER_REACTIVATED",
        targetType: "user",
        targetId: user.id,
        beforeJson: JSON.parse(JSON.stringify(safeUserSnapshot(target))),
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
