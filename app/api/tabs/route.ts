import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/log";
import { errorResponse, parseJson } from "@/lib/http";
import { requirePermission } from "@/lib/permissions/policy";
import { assertBranchScope, assertLegalEntityScope } from "@/lib/permissions/tenant";
import { prisma } from "@/lib/prisma";
import { requireActiveOperatorShift } from "@/lib/shifts/active-shift";
import { createTabSchema } from "@/lib/validation/common";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    const url = new URL(request.url);
    const branchId = url.searchParams.get("branchId") ?? undefined;

    if (branchId) {
      assertBranchScope(auth, { legalEntityId: auth.legalEntityId, branchId });
    }

    const tabs = await prisma.tab.findMany({
      where: {
        legalEntityId: auth.legalEntityId,
        branchId,
        status: { in: ["OPEN", "REOPENED"] },
      },
      include: {
        timedLines: { include: { sessionEvents: true, resource: true } },
        retailLines: true,
      },
      orderBy: { openedAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ tabs });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    requirePermission(auth.role, "tab:write");
    const input = await parseJson(request, createTabSchema);

    const branch = await prisma.branch.findFirst({
      where: { id: input.branchId, legalEntityId: auth.legalEntityId },
      select: { id: true, legalEntityId: true },
    });
    assertLegalEntityScope(auth.legalEntityId, branch);
    assertBranchScope(auth, branch);

    const activeShift = await requireActiveOperatorShift({
      auth,
      branchId: input.branchId,
    });

    const tab = await prisma.tab.create({
      data: {
        legalEntityId: auth.legalEntityId,
        branchId: input.branchId,
        operatorShiftId: activeShift.id,
        createdByUserId: auth.userId,
        customerLabel: input.customerLabel,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerGstin: input.customerGstin,
      },
    });

    await writeAuditLog({
      legalEntityId: auth.legalEntityId,
      branchId: input.branchId,
      operatorShiftId: activeShift.id,
      actorUserId: auth.userId,
      action: "TAB_CREATED",
      targetType: "tab",
      targetId: tab.id,
      afterJson: tab,
    });

    return NextResponse.json({ tab }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
