import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { errorResponse, parseJson } from "@/lib/http";
import {
  requireManagerOverride,
  requirePermission,
} from "@/lib/permissions/policy";
import { assertLegalEntityScope } from "@/lib/permissions/tenant";
import { prisma } from "@/lib/prisma";
import { requireActiveOperatorShift } from "@/lib/shifts/active-shift";
import { managerReasonSchema } from "@/lib/validation/common";

type RouteContext = {
  params: Promise<{ tabId: string }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    requirePermission(auth.role, "tab:void");
    requireManagerOverride(auth.role, "REOPEN_CLOSED_TAB");
    const params = await context.params;
    const input = await parseJson(request, managerReasonSchema);

    const tab = await prisma.tab.findFirst({
      where: { id: params.tabId, legalEntityId: auth.legalEntityId },
      include: { gstInvoice: true },
    });
    assertLegalEntityScope(auth.legalEntityId, tab);

    if (tab.gstInvoice) {
      return NextResponse.json(
        {
          error: {
            code: "POSTED_INVOICE_TAB_LOCKED",
            message: "Tabs with posted invoices cannot be reopened.",
          },
        },
        { status: 409 },
      );
    }

    const activeShift = await requireActiveOperatorShift({
      auth,
      branchId: tab.branchId,
    });

    const reopened = await prisma.$transaction(async (tx) => {
      const reopenedTab = await tx.tab.update({
        where: { id: tab.id },
        data: { status: "REOPENED", closedAt: null, voidedAt: null },
      });
      await tx.auditLog.create({
        data: {
          legalEntityId: auth.legalEntityId,
          branchId: tab.branchId,
          operatorShiftId: activeShift.id,
          actorUserId: auth.userId,
          action: "REOPEN_CLOSED_TAB",
          targetType: "tab",
          targetId: tab.id,
          beforeJson: { status: tab.status },
          afterJson: { status: "REOPENED" },
          reason: input.reason,
        },
      });
      return reopenedTab;
    });

    return NextResponse.json({ tab: reopened });
  } catch (error) {
    return errorResponse(error);
  }
}
