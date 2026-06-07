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
    requireManagerOverride(auth.role, "VOID_TAB");
    const params = await context.params;
    const input = await parseJson(request, managerReasonSchema);

    const tab = await prisma.tab.findFirst({
      where: { id: params.tabId, legalEntityId: auth.legalEntityId },
      include: { timedLines: true, gstInvoice: true },
    });
    assertLegalEntityScope(auth.legalEntityId, tab);

    if (tab.gstInvoice) {
      return NextResponse.json(
        {
          error: {
            code: "POSTED_INVOICE_REQUIRES_CREDIT_NOTE",
            message: "Posted invoices cannot be voided. Create a credit note/refund.",
          },
        },
        { status: 409 },
      );
    }

    const activeShift = await requireActiveOperatorShift({
      auth,
      branchId: tab.branchId,
    });

    const result = await prisma.$transaction(async (tx) => {
      for (const line of tab.timedLines) {
        if (line.resourceId) {
          await tx.resource.update({
            where: { id: line.resourceId },
            data: { status: "AVAILABLE" },
          });
        }
      }

      await tx.tabTimedLine.updateMany({
        where: { tabId: tab.id },
        data: { status: "VOIDED" },
      });
      await tx.tabRetailLine.updateMany({
        where: { tabId: tab.id },
        data: { voidedAt: new Date() },
      });
      const voidedTab = await tx.tab.update({
        where: { id: tab.id },
        data: { status: "VOIDED", voidedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          legalEntityId: auth.legalEntityId,
          branchId: tab.branchId,
          operatorShiftId: activeShift.id,
          actorUserId: auth.userId,
          action: "VOID_TAB",
          targetType: "tab",
          targetId: tab.id,
          beforeJson: { status: tab.status },
          afterJson: { status: "VOIDED" },
          reason: input.reason,
        },
      });
      return voidedTab;
    });

    return NextResponse.json({ tab: result });
  } catch (error) {
    return errorResponse(error);
  }
}
