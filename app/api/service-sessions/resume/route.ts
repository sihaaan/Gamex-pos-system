import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { errorResponse, parseJson } from "@/lib/http";
import { requirePermission } from "@/lib/permissions/policy";
import { assertLegalEntityScope } from "@/lib/permissions/tenant";
import { prisma } from "@/lib/prisma";
import { requireActiveOperatorShift } from "@/lib/shifts/active-shift";
import { serviceLineActionSchema } from "@/lib/validation/common";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    requirePermission(auth.role, "tab:write");
    const input = await parseJson(request, serviceLineActionSchema);

    const line = await prisma.tabTimedLine.findFirst({
      where: { id: input.tabTimedLineId, legalEntityId: auth.legalEntityId },
      select: {
        id: true,
        legalEntityId: true,
        branchId: true,
        tabId: true,
        operatorShiftId: true,
        resourceId: true,
        status: true,
      },
    });
    assertLegalEntityScope(auth.legalEntityId, line);

    if (line.status !== "PAUSED") {
      return NextResponse.json(
        {
          error: {
            code: "SESSION_NOT_PAUSED",
            message: "Only a paused timed session can be resumed.",
          },
        },
        { status: 409 },
      );
    }

    const activeShift = await requireActiveOperatorShift({
      auth,
      branchId: line.branchId,
    });
    if (activeShift.id !== line.operatorShiftId) {
      return NextResponse.json(
        {
          error: {
            code: "SESSION_SHIFT_CLOSED",
            message: "This timed session belongs to a different or closed shift.",
          },
        },
        { status: 409 },
      );
    }

    const event = await prisma.$transaction(async (tx) => {
      const createdEvent = await tx.serviceSessionEvent.create({
        data: {
          legalEntityId: auth.legalEntityId,
          branchId: line.branchId,
          tabId: line.tabId,
          tabTimedLineId: line.id,
          resourceId: line.resourceId,
          actorUserId: auth.userId,
          operatorShiftId: activeShift.id,
          eventType: "RESUMED",
          metadata: {},
        },
      });
      await tx.tabTimedLine.update({
        where: { id: line.id },
        data: { status: "RUNNING" },
      });
      if (line.resourceId) {
        await tx.resource.update({
          where: { id: line.resourceId },
          data: { status: "OCCUPIED" },
        });
      }
      return createdEvent;
    });

    return NextResponse.json({ event });
  } catch (error) {
    return errorResponse(error);
  }
}
