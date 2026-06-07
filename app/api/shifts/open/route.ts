import { NextResponse } from "next/server";
import { requestFingerprint, requireAuth } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/log";
import { errorResponse, parseJson } from "@/lib/http";
import { requirePermission } from "@/lib/permissions/policy";
import { assertBranchScope, assertLegalEntityScope } from "@/lib/permissions/tenant";
import { prisma } from "@/lib/prisma";
import { openShiftSchema } from "@/lib/validation/common";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    requirePermission(auth.role, "shift:open");
    const input = await parseJson(request, openShiftSchema);

    const branch = await prisma.branch.findFirst({
      where: { id: input.branchId, legalEntityId: auth.legalEntityId },
      select: { id: true, legalEntityId: true, name: true },
    });
    assertLegalEntityScope(auth.legalEntityId, branch);
    assertBranchScope(auth, branch);

    const existingShift = await prisma.operatorShift.findFirst({
      where: {
        legalEntityId: auth.legalEntityId,
        staffUserId: auth.userId,
        status: "OPEN",
      },
      select: { id: true },
    });

    if (existingShift) {
      return NextResponse.json(
        {
          error: {
            code: "SHIFT_ALREADY_OPEN",
            message: "Close the current operator shift before opening another.",
          },
        },
        { status: 409 },
      );
    }

    const shift = await prisma.operatorShift.create({
      data: {
        legalEntityId: auth.legalEntityId,
        branchId: input.branchId,
        staffUserId: auth.userId,
        cashOpeningFloat: input.cashOpeningFloat,
        notes: input.notes,
      },
      select: {
        id: true,
        branchId: true,
        status: true,
        openedAt: true,
        cashOpeningFloat: true,
      },
    });

    const fingerprint = await requestFingerprint();
    await writeAuditLog({
      legalEntityId: auth.legalEntityId,
      branchId: input.branchId,
      operatorShiftId: shift.id,
      actorUserId: auth.userId,
      action: "SHIFT_OPENED",
      targetType: "operator_shift",
      targetId: shift.id,
      afterJson: shift,
      ...fingerprint,
    });

    return NextResponse.json({ shift }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
