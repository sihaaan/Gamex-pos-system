import { NextResponse } from "next/server";
import { requireAuth, requestFingerprint } from "@/lib/auth/session";
import {
  assertCanManageBranchScopedRecord,
  assertResourceCanDeactivate,
} from "@/lib/admin/management";
import { errorResponse, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { adminStateChangeSchema } from "@/lib/validation/common";

type RouteContext = {
  params: Promise<{ resourceId: string }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    const params = await context.params;
    const input = await parseJson(request, adminStateChangeSchema);
    const before = await prisma.resource.findFirst({
      where: { id: params.resourceId, legalEntityId: auth.legalEntityId },
      include: { branch: { select: { id: true, name: true, code: true } } },
    });
    assertCanManageBranchScopedRecord(auth, before, "Resource");
    const activeTimedLineCount = await prisma.tabTimedLine.count({
      where: {
        resourceId: before.id,
        status: { in: ["RUNNING", "PAUSED"] },
        tab: { status: { in: ["OPEN", "REOPENED"] } },
      },
    });
    assertResourceCanDeactivate({ resource: before, activeTimedLineCount });
    const fingerprint = await requestFingerprint();

    const resource = await prisma.resource.update({
      where: { id: before.id },
      data: { isActive: false },
      include: { branch: { select: { id: true, name: true, code: true } } },
    });

    await prisma.auditLog.create({
      data: {
        legalEntityId: auth.legalEntityId,
        branchId: resource.branchId,
        actorUserId: auth.userId,
        action: "ADMIN_RESOURCE_DEACTIVATED",
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
