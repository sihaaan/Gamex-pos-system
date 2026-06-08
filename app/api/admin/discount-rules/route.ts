import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { errorResponse, parseJson } from "@/lib/http";
import {
  requireManagerOverride,
  requirePermission,
} from "@/lib/permissions/policy";
import { assertLegalEntityScope } from "@/lib/permissions/tenant";
import { prisma } from "@/lib/prisma";
import { discountRuleSchema } from "@/lib/validation/common";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    requirePermission(auth.role, "catalog:write");
    requireManagerOverride(auth.role, "CHANGE_TAX_PRICING_CONFIG");
    const input = await parseJson(request, discountRuleSchema);

    if (input.branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: input.branchId, legalEntityId: auth.legalEntityId },
      });
      assertLegalEntityScope(auth.legalEntityId, branch);
    }

    const before = input.id
      ? await prisma.discountRule.findFirst({
          where: { id: input.id, legalEntityId: auth.legalEntityId },
        })
      : null;

    if (input.id) {
      assertLegalEntityScope(auth.legalEntityId, before);
    }

    const discountRule = input.id
      ? await prisma.discountRule.update({
          where: { id: input.id },
          data: {
            branchId: input.branchId ?? null,
            name: input.name,
            discountPercent: input.discountPercent,
            minimumBillableMinutes: input.minimumBillableMinutes,
            daysOfWeek: input.daysOfWeek,
            startMinuteOfDay: input.startMinuteOfDay,
            endMinuteOfDay: input.endMinuteOfDay,
            isActive: input.isActive,
          },
        })
      : await prisma.discountRule.create({
          data: {
            legalEntityId: auth.legalEntityId,
            branchId: input.branchId ?? null,
            name: input.name,
            discountPercent: input.discountPercent,
            minimumBillableMinutes: input.minimumBillableMinutes,
            daysOfWeek: input.daysOfWeek,
            startMinuteOfDay: input.startMinuteOfDay,
            endMinuteOfDay: input.endMinuteOfDay,
            isActive: input.isActive,
          },
        });

    await prisma.auditLog.create({
      data: {
        legalEntityId: auth.legalEntityId,
        branchId: input.branchId ?? undefined,
        actorUserId: auth.userId,
        action: "CHANGE_TAX_PRICING_CONFIG",
        targetType: "discount_rule",
        targetId: discountRule.id,
        beforeJson: before ?? undefined,
        afterJson: discountRule,
        reason: input.reason,
      },
    });

    return NextResponse.json({ discountRule }, { status: input.id ? 200 : 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
