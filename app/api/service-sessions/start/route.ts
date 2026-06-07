import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { errorResponse, parseJson } from "@/lib/http";
import { requirePermission } from "@/lib/permissions/policy";
import { assertLegalEntityScope } from "@/lib/permissions/tenant";
import { prisma } from "@/lib/prisma";
import { requireActiveOperatorShift } from "@/lib/shifts/active-shift";
import { serviceStartSchema } from "@/lib/validation/common";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    requirePermission(auth.role, "tab:write");
    const input = await parseJson(request, serviceStartSchema);

    const tab = await prisma.tab.findFirst({
      where: { id: input.tabId, legalEntityId: auth.legalEntityId },
      select: {
        id: true,
        legalEntityId: true,
        branchId: true,
        operatorShiftId: true,
        status: true,
      },
    });
    assertLegalEntityScope(auth.legalEntityId, tab);

    if (tab.status !== "OPEN" && tab.status !== "REOPENED") {
      return NextResponse.json(
        {
          error: {
            code: "TAB_NOT_OPEN",
            message: "Timed sessions can only be started on open tabs.",
          },
        },
        { status: 409 },
      );
    }

    const activeShift = await requireActiveOperatorShift({
      auth,
      branchId: tab.branchId,
    });
    if (activeShift.id !== tab.operatorShiftId) {
      return NextResponse.json(
        {
          error: {
            code: "TAB_SHIFT_CLOSED",
            message: "This tab belongs to a different or closed operator shift.",
          },
        },
        { status: 409 },
      );
    }

    const [service, resource] = await Promise.all([
      prisma.serviceCatalog.findFirst({
        where: {
          id: input.serviceCatalogId,
          legalEntityId: auth.legalEntityId,
          isActive: true,
        },
        include: { pricingRule: true, taxRate: true },
      }),
      prisma.resource.findFirst({
        where: {
          id: input.resourceId,
          legalEntityId: auth.legalEntityId,
          branchId: tab.branchId,
          isActive: true,
        },
      }),
    ]);
    assertLegalEntityScope(auth.legalEntityId, service);
    assertLegalEntityScope(auth.legalEntityId, resource);

    if (service.branchId && service.branchId !== tab.branchId) {
      return NextResponse.json(
        {
          error: {
            code: "SERVICE_BRANCH_MISMATCH",
            message: "This service is not configured for the tab branch.",
          },
        },
        { status: 400 },
      );
    }

    if (resource.status !== "AVAILABLE") {
      return NextResponse.json(
        {
          error: {
            code: "RESOURCE_NOT_AVAILABLE",
            message: "This resource is not available for a new session.",
          },
        },
        { status: 409 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const timedLine = await tx.tabTimedLine.create({
        data: {
          legalEntityId: auth.legalEntityId,
          branchId: tab.branchId,
          tabId: tab.id,
          operatorShiftId: activeShift.id,
          serviceCatalogId: service.id,
          resourceId: resource.id,
          descriptionSnapshot: service.description,
          sacCodeSnapshot: service.sacCode,
          gstRateSnapshot: service.taxRate.gstRate,
          ratePerMinuteSnapshot: service.pricingRule.ratePerMinute,
          minimumBillableMinutesSnapshot:
            service.pricingRule.minimumBillableMinutes,
          roundUpToMinutesSnapshot: service.pricingRule.roundUpToMinutes,
        },
      });

      const event = await tx.serviceSessionEvent.create({
        data: {
          legalEntityId: auth.legalEntityId,
          branchId: tab.branchId,
          tabId: tab.id,
          tabTimedLineId: timedLine.id,
          resourceId: resource.id,
          actorUserId: auth.userId,
          operatorShiftId: activeShift.id,
          eventType: "STARTED",
          metadata: {},
        },
      });

      await tx.resource.update({
        where: { id: resource.id },
        data: { status: "OCCUPIED" },
      });

      return { timedLine, event };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
