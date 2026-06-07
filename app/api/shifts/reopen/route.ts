import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { errorResponse, parseJson } from "@/lib/http";
import {
  requireManagerOverride,
  requirePermission,
} from "@/lib/permissions/policy";
import { assertLegalEntityScope } from "@/lib/permissions/tenant";
import { prisma } from "@/lib/prisma";
import { reopenShiftSchema } from "@/lib/validation/common";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    requirePermission(auth.role, "shift:reopen");
    requireManagerOverride(auth.role, "REOPEN_OR_ADJUST_SHIFT");
    const input = await parseJson(request, reopenShiftSchema);

    const shift = await prisma.operatorShift.findFirst({
      where: {
        id: input.operatorShiftId,
        legalEntityId: auth.legalEntityId,
      },
    });
    assertLegalEntityScope(auth.legalEntityId, shift);

    if (shift.status !== "CLOSED") {
      return NextResponse.json(
        {
          error: {
            code: "SHIFT_NOT_CLOSED",
            message: "Only closed shifts can be reopened.",
          },
        },
        { status: 409 },
      );
    }

    const reopened = await prisma.$transaction(async (tx) => {
      const reopenedShift = await tx.operatorShift.update({
        where: { id: shift.id },
        data: { status: "REOPENED", closedAt: null },
      });
      await tx.auditLog.create({
        data: {
          legalEntityId: auth.legalEntityId,
          branchId: shift.branchId,
          operatorShiftId: shift.id,
          actorUserId: auth.userId,
          action: "REOPEN_OR_ADJUST_SHIFT",
          targetType: "operator_shift",
          targetId: shift.id,
          beforeJson: { status: "CLOSED", closedAt: shift.closedAt },
          afterJson: { status: "REOPENED" },
          reason: input.reason,
        },
      });
      return reopenedShift;
    });

    return NextResponse.json({ shift: reopened });
  } catch (error) {
    return errorResponse(error);
  }
}
