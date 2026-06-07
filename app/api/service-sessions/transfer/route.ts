import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { errorResponse, parseJson } from "@/lib/http";
import { requirePermission } from "@/lib/permissions/policy";
import { assertLegalEntityScope } from "@/lib/permissions/tenant";
import { prisma } from "@/lib/prisma";
import { requireActiveOperatorShift } from "@/lib/shifts/active-shift";
import { serviceTransferSchema } from "@/lib/validation/common";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    requirePermission(auth.role, "tab:write");
    const input = await parseJson(request, serviceTransferSchema);

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

    if (line.status !== "RUNNING") {
      return NextResponse.json(
        {
          error: {
            code: "SESSION_NOT_RUNNING",
            message: "Only a running session can be transferred.",
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

    const toResource = await prisma.resource.findFirst({
      where: {
        id: input.toResourceId,
        legalEntityId: auth.legalEntityId,
        branchId: line.branchId,
        status: "AVAILABLE",
      },
    });
    assertLegalEntityScope(auth.legalEntityId, toResource);

    const result = await prisma.$transaction(async (tx) => {
      const event = await tx.serviceSessionEvent.create({
        data: {
          legalEntityId: auth.legalEntityId,
          branchId: line.branchId,
          tabId: line.tabId,
          tabTimedLineId: line.id,
          resourceId: toResource.id,
          actorUserId: auth.userId,
          operatorShiftId: activeShift.id,
          eventType: "TRANSFERRED",
          metadata: {
            fromResourceId: line.resourceId,
            toResourceId: toResource.id,
          },
          reason: input.reason,
        },
      });

      if (line.resourceId) {
        await tx.resource.update({
          where: { id: line.resourceId },
          data: { status: "AVAILABLE" },
        });
      }

      await tx.resource.update({
        where: { id: toResource.id },
        data: { status: "OCCUPIED" },
      });

      const timedLine = await tx.tabTimedLine.update({
        where: { id: line.id },
        data: { resourceId: toResource.id },
      });

      return { event, timedLine };
    });

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
