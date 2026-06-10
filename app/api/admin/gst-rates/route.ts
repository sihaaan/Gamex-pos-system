import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/log";
import { created, errorResponse, parseJson } from "@/lib/http";
import {
  requireManagerOverride,
  requirePermission,
} from "@/lib/permissions/policy";
import { prisma } from "@/lib/prisma";
import { taxRateSchema } from "@/lib/validation/common";

export async function GET(): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    requirePermission(auth.role, "catalog:write");
    const taxRates = await prisma.taxRate.findMany({
      where: { legalEntityId: auth.legalEntityId },
      orderBy: [{ code: "asc" }, { effectiveFrom: "desc" }],
    });

    return NextResponse.json({ taxRates });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    requirePermission(auth.role, "catalog:write");
    requireManagerOverride(auth.role, "CHANGE_TAX_PRICING_CONFIG");
    const input = await parseJson(request, taxRateSchema);

    const taxRate = await prisma.taxRate.create({
      data: {
        legalEntityId: auth.legalEntityId,
        code: input.code,
        kind: input.kind,
        description: input.description,
        gstRate: input.gstRate,
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : undefined,
      },
    });

    await writeAuditLog({
      legalEntityId: auth.legalEntityId,
      actorUserId: auth.userId,
      action: "ADMIN_GST_RATE_CREATED",
      targetType: "tax_rate",
      targetId: taxRate.id,
      afterJson: taxRate,
      reason: input.reason,
    });

    return created({ taxRate });
  } catch (error) {
    return errorResponse(error);
  }
}
