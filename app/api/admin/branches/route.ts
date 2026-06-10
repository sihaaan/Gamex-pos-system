import { NextResponse } from "next/server";
import { requireAuth, requestFingerprint } from "@/lib/auth/session";
import {
  assertCanCreateBranch,
  branchWhereForActor,
} from "@/lib/admin/management";
import { created, errorResponse, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { adminBranchCreateSchema } from "@/lib/validation/common";

export async function GET(): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    const branches = await prisma.branch.findMany({
      where: branchWhereForActor(auth),
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
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
    });

    return NextResponse.json({
      branches: branches.map(({ resources, ...branch }) => ({
        ...branch,
        activeResourceCount: resources.length,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    assertCanCreateBranch(auth);
    const input = await parseJson(request, adminBranchCreateSchema);
    const fingerprint = await requestFingerprint();

    const branch = await prisma.branch.create({
      data: {
        legalEntityId: auth.legalEntityId,
        name: input.name,
        code: input.code,
        address: input.address,
        stateCode: input.stateCode,
        timezone: input.timezone,
        isActive: input.isActive,
      },
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

    await prisma.auditLog.create({
      data: {
        legalEntityId: auth.legalEntityId,
        branchId: branch.id,
        actorUserId: auth.userId,
        action: "ADMIN_BRANCH_CREATED",
        targetType: "branch",
        targetId: branch.id,
        afterJson: JSON.parse(JSON.stringify(branch)),
        ipAddress: fingerprint.ipAddress,
        userAgent: fingerprint.userAgent,
      },
    });

    return created({ branch: { ...branch, activeResourceCount: 0 } });
  } catch (error) {
    return errorResponse(error);
  }
}
