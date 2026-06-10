import { NextResponse } from "next/server";
import { requireAuth, requestFingerprint } from "@/lib/auth/session";
import { assertCanManageBranch } from "@/lib/admin/management";
import { AppError, errorResponse, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { adminStateChangeSchema } from "@/lib/validation/common";

type RouteContext = {
  params: Promise<{ branchId: string }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    const params = await context.params;
    const input = await parseJson(request, adminStateChangeSchema);

    const before = await prisma.branch.findFirst({
      where: { id: params.branchId, legalEntityId: auth.legalEntityId },
      select: {
        id: true,
        legalEntityId: true,
        name: true,
        code: true,
        address: true,
        stateCode: true,
        timezone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    assertCanManageBranch(auth, before);

    const [activeShifts, openTabs] = await Promise.all([
      prisma.operatorShift.count({
        where: {
          legalEntityId: auth.legalEntityId,
          branchId: before.id,
          status: { in: ["OPEN", "REOPENED"] },
        },
      }),
      prisma.tab.count({
        where: {
          legalEntityId: auth.legalEntityId,
          branchId: before.id,
          status: { in: ["OPEN", "REOPENED"] },
        },
      }),
    ]);

    if (activeShifts > 0 || openTabs > 0) {
      throw new AppError(
        409,
        "BRANCH_HAS_ACTIVITY",
        "Close active shifts and open bills before deactivating this branch.",
      );
    }

    const fingerprint = await requestFingerprint();
    const branch = await prisma.branch.update({
      where: { id: before.id },
      data: { isActive: false },
      select: {
        id: true,
        legalEntityId: true,
        name: true,
        code: true,
        address: true,
        stateCode: true,
        timezone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        resources: {
          where: { isActive: true },
          select: { id: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        legalEntityId: auth.legalEntityId,
        branchId: branch.id,
        actorUserId: auth.userId,
        action: "ADMIN_BRANCH_DEACTIVATED",
        targetType: "branch",
        targetId: branch.id,
        beforeJson: JSON.parse(JSON.stringify(before)),
        afterJson: JSON.parse(JSON.stringify(branch)),
        reason: input.reason,
        ipAddress: fingerprint.ipAddress,
        userAgent: fingerprint.userAgent,
      },
    });

    const { resources, ...branchPayload } = branch;
    return NextResponse.json({
      branch: { ...branchPayload, activeResourceCount: resources.length },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
