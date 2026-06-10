import { NextResponse } from "next/server";
import { requireAuth, requestFingerprint } from "@/lib/auth/session";
import {
  assertCanAssignCatalogBranch,
  assertCanManageBranchScopedRecord,
  assertResourceCanDeactivate,
} from "@/lib/admin/management";
import { AppError, errorResponse, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { adminResourceUpdateSchema } from "@/lib/validation/common";

type RouteContext = {
  params: Promise<{ resourceId: string }>;
};

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    const params = await context.params;
    const input = await parseJson(request, adminResourceUpdateSchema);
    const before = await prisma.resource.findFirst({
      where: { id: params.resourceId, legalEntityId: auth.legalEntityId },
      include: { branch: { select: { id: true, name: true, code: true } } },
    });
    assertCanManageBranchScopedRecord(auth, before, "Resource");

    if (input.isActive === false && before.isActive) {
      const activeTimedLineCount = await activeTimedLineCountForResource(before.id);
      assertResourceCanDeactivate({ resource: before, activeTimedLineCount });
    }

    const requestedBranchId = input.branchId ?? before.branchId;
    const branch = await prisma.branch.findFirst({
      where: { id: requestedBranchId, legalEntityId: auth.legalEntityId },
      select: { id: true, legalEntityId: true, isActive: true },
    });
    const branchId = assertCanAssignCatalogBranch(
      auth,
      branch,
      requestedBranchId,
    );
    if (!branchId) {
      throw new AppError(400, "BRANCH_REQUIRED", "Branch is required.");
    }
    const fingerprint = await requestFingerprint();

    const resource = await prisma.resource.update({
      where: { id: before.id },
      data: {
        branchId,
        name: input.name,
        kind: input.kind,
        isActive: input.isActive,
      },
      include: { branch: { select: { id: true, name: true, code: true } } },
    });

    await prisma.auditLog.create({
      data: {
        legalEntityId: auth.legalEntityId,
        branchId: resource.branchId,
        actorUserId: auth.userId,
        action: "ADMIN_RESOURCE_EDITED",
        targetType: "resource",
        targetId: resource.id,
        beforeJson: JSON.parse(JSON.stringify(before)),
        afterJson: JSON.parse(JSON.stringify(resource)),
        reason: input.reason,
        ipAddress: fingerprint.ipAddress,
        userAgent: fingerprint.userAgent,
      },
    });

    return NextResponse.json({ resource });
  } catch (error) {
    return errorResponse(error);
  }
}

async function activeTimedLineCountForResource(resourceId: string): Promise<number> {
  return prisma.tabTimedLine.count({
    where: {
      resourceId,
      status: { in: ["RUNNING", "PAUSED"] },
      tab: { status: { in: ["OPEN", "REOPENED"] } },
    },
  });
}
