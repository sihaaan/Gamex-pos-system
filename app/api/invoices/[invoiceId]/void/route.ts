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
  params: Promise<{ invoiceId: string }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    requirePermission(auth.role, "refund:create");
    requireManagerOverride(auth.role, "VOID_INVOICE");
    const params = await context.params;
    const input = await parseJson(request, managerReasonSchema);

    const invoice = await prisma.gstInvoice.findFirst({
      where: { id: params.invoiceId, legalEntityId: auth.legalEntityId },
      select: {
        id: true,
        legalEntityId: true,
        branchId: true,
        invoiceNumber: true,
      },
    });
    assertLegalEntityScope(auth.legalEntityId, invoice);

    const activeShift = await requireActiveOperatorShift({
      auth,
      branchId: invoice.branchId,
    });

    await prisma.auditLog.create({
      data: {
        legalEntityId: auth.legalEntityId,
        branchId: invoice.branchId,
        operatorShiftId: activeShift.id,
        actorUserId: auth.userId,
        action: "VOID_INVOICE",
        targetType: "gst_invoice",
        targetId: invoice.id,
        afterJson: { invoiceNumber: invoice.invoiceNumber },
        reason: input.reason,
      },
    });

    return NextResponse.json(
      {
        error: {
          code: "USE_CREDIT_NOTE",
          message:
            "Posted GST invoices are immutable. Use the refund route to create a credit note.",
        },
      },
      { status: 409 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
