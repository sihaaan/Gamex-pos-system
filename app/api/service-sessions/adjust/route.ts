import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/log";
import { errorResponse, parseJson } from "@/lib/http";
import {
  requireManagerOverride,
  requirePermission,
} from "@/lib/permissions/policy";
import { assertLegalEntityScope } from "@/lib/permissions/tenant";
import { prisma } from "@/lib/prisma";
import { requireActiveOperatorShift } from "@/lib/shifts/active-shift";
import { serviceManualAdjustSchema } from "@/lib/validation/common";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    requirePermission(auth.role, "tab:write");
    requireManagerOverride(auth.role, "RETROACTIVE_SESSION_EDIT");
    const input = await parseJson(request, serviceManualAdjustSchema);

    const line = await prisma.tabTimedLine.findFirst({
      where: { id: input.tabTimedLineId, legalEntityId: auth.legalEntityId },
      select: {
        id: true,
        legalEntityId: true,
        branchId: true,
        tabId: true,
        operatorShiftId: true,
        resourceId: true,
      },
    });
    assertLegalEntityScope(auth.legalEntityId, line);

    const activeShift = await requireActiveOperatorShift({
      auth,
      branchId: line.branchId,
    });

    const event = await prisma.serviceSessionEvent.create({
      data: {
        legalEntityId: auth.legalEntityId,
        branchId: line.branchId,
        tabId: line.tabId,
        tabTimedLineId: line.id,
        resourceId: line.resourceId,
        actorUserId: auth.userId,
        operatorShiftId: activeShift.id,
        eventType: "MANUAL_ADJUSTED",
        metadata: { billableMinutesDelta: input.billableMinutesDelta },
        reason: input.reason,
      },
    });

    await writeAuditLog({
      legalEntityId: auth.legalEntityId,
      branchId: line.branchId,
      operatorShiftId: activeShift.id,
      actorUserId: auth.userId,
      action: "RETROACTIVE_SESSION_EDIT",
      targetType: "tab_timed_line",
      targetId: line.id,
      afterJson: event,
      reason: input.reason,
    });

    return NextResponse.json({ event });
  } catch (error) {
    return errorResponse(error);
  }
}
