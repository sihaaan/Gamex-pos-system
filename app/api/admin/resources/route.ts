import { NextResponse } from "next/server";
import { requireAuth, requestFingerprint } from "@/lib/auth/session";
import {
  assertCanAssignCatalogBranch,
  branchScopedWhereForActor,
} from "@/lib/admin/management";
import { AppError, created, errorResponse, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { adminResourceCreateSchema } from "@/lib/validation/common";

export async function GET(): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    const resources = await prisma.resource.findMany({
      where: branchScopedWhereForActor(auth),
      include: { branch: { select: { id: true, name: true, code: true } } },
      orderBy: [{ branchId: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ resources });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    const input = await parseJson(request, adminResourceCreateSchema);
    const branch = await prisma.branch.findFirst({
      where: { id: input.branchId, legalEntityId: auth.legalEntityId },
      select: { id: true, legalEntityId: true, isActive: true },
    });
    const branchId = assertCanAssignCatalogBranch(auth, branch, input.branchId);
    if (!branchId) {
      throw new AppError(400, "BRANCH_REQUIRED", "Branch is required.");
    }
    const fingerprint = await requestFingerprint();

    const resource = await prisma.resource.create({
      data: {
        legalEntityId: auth.legalEntityId,
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
        action: "ADMIN_RESOURCE_CREATED",
        targetType: "resource",
        targetId: resource.id,
        afterJson: JSON.parse(JSON.stringify(resource)),
        ipAddress: fingerprint.ipAddress,
        userAgent: fingerprint.userAgent,
      },
    });

    return created({ resource });
  } catch (error) {
    return errorResponse(error);
  }
}
