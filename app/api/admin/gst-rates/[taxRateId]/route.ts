import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/log";
import { AppError, errorResponse, parseJson } from "@/lib/http";
import {
  requireManagerOverride,
  requirePermission,
} from "@/lib/permissions/policy";
import { prisma } from "@/lib/prisma";
import { adminTaxRateUpdateSchema } from "@/lib/validation/common";

type RouteContext = {
  params: Promise<{ taxRateId: string }>;
};

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    requirePermission(auth.role, "catalog:write");
    requireManagerOverride(auth.role, "CHANGE_TAX_PRICING_CONFIG");
    const params = await context.params;
    const input = await parseJson(request, adminTaxRateUpdateSchema);
    const before = await prisma.taxRate.findFirst({
      where: { id: params.taxRateId, legalEntityId: auth.legalEntityId },
    });
    if (!before) {
      throw new AppError(404, "TAX_RATE_NOT_FOUND", "GST rate was not found.");
    }

    const taxRate = await prisma.taxRate.update({
      where: { id: before.id },
      data: {
        description: input.description,
        effectiveTo:
          input.effectiveTo === undefined
            ? undefined
            : input.effectiveTo
              ? new Date(input.effectiveTo)
              : null,
      },
    });

    await writeAuditLog({
      legalEntityId: auth.legalEntityId,
      actorUserId: auth.userId,
      action: "ADMIN_GST_RATE_EDITED",
      targetType: "tax_rate",
      targetId: taxRate.id,
      beforeJson: before,
      afterJson: taxRate,
      reason: input.reason,
    });

    return NextResponse.json({ taxRate });
  } catch (error) {
    return errorResponse(error);
  }
}
