import { NextResponse } from "next/server";
import { requireAuth, requestFingerprint } from "@/lib/auth/session";
import {
  assertCanAssignCatalogBranch,
  assertCanManageBranchScopedRecord,
} from "@/lib/admin/management";
import { errorResponse, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { adminServiceUpdateSchema } from "@/lib/validation/common";

type RouteContext = {
  params: Promise<{ serviceId: string }>;
};

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    const params = await context.params;
    const input = await parseJson(request, adminServiceUpdateSchema);
    const before = await prisma.serviceCatalog.findFirst({
      where: { id: params.serviceId, legalEntityId: auth.legalEntityId },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        pricingRule: true,
        taxRate: true,
      },
    });
    assertCanManageBranchScopedRecord(auth, before, "Timed service");

    const requestedBranchId =
      Object.prototype.hasOwnProperty.call(input, "branchId")
        ? (input.branchId ?? null)
        : before.branchId;
    const [branch, taxRate] = await Promise.all([
      requestedBranchId
        ? prisma.branch.findFirst({
            where: { id: requestedBranchId, legalEntityId: auth.legalEntityId },
            select: { id: true, legalEntityId: true, isActive: true },
          })
        : Promise.resolve(null),
      input.taxRateId
        ? prisma.taxRate.findFirst({
            where: { id: input.taxRateId, legalEntityId: auth.legalEntityId },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    const branchId = assertCanAssignCatalogBranch(
      auth,
      branch,
      requestedBranchId,
      { allowGlobalForOwner: true },
    );
    if (input.taxRateId && !taxRate) {
      return NextResponse.json(
        { error: { code: "TAX_RATE_NOT_FOUND", message: "GST rate was not found." } },
        { status: 404 },
      );
    }

    const pricingChanged =
      input.ratePerMinute !== undefined ||
      input.minimumBillableMinutes !== undefined ||
      input.roundUpToMinutes !== undefined ||
      input.managerDiscountLimitPercent !== undefined;
    const fingerprint = await requestFingerprint();

    const service = await prisma.$transaction(async (tx) => {
      const pricingRuleId = pricingChanged
        ? (
            await tx.pricingRule.create({
              data: {
                legalEntityId: auth.legalEntityId,
                name: `${input.name ?? before.name} pricing ${Date.now()}`,
                ratePerMinute:
                  input.ratePerMinute ?? before.pricingRule.ratePerMinute,
                minimumBillableMinutes:
                  input.minimumBillableMinutes ??
                  before.pricingRule.minimumBillableMinutes,
                roundUpToMinutes:
                  input.roundUpToMinutes ?? before.pricingRule.roundUpToMinutes,
                managerDiscountLimitPercent:
                  input.managerDiscountLimitPercent ??
                  before.pricingRule.managerDiscountLimitPercent,
              },
            })
          ).id
        : before.pricingRuleId;

      const updated = await tx.serviceCatalog.update({
        where: { id: before.id },
        data: {
          branchId,
          taxRateId: input.taxRateId,
          pricingRuleId,
          name: input.name,
          sacCode: input.sacCode,
          description: input.description,
          isActive: input.isActive,
        },
        include: {
          branch: { select: { id: true, name: true, code: true } },
          pricingRule: true,
          taxRate: true,
        },
      });
      await tx.auditLog.create({
        data: {
          legalEntityId: auth.legalEntityId,
          branchId: updated.branchId,
          actorUserId: auth.userId,
          action: "ADMIN_SERVICE_EDITED",
          targetType: "service",
          targetId: updated.id,
          beforeJson: JSON.parse(JSON.stringify(before)),
          afterJson: JSON.parse(JSON.stringify(updated)),
          reason: input.reason,
          ipAddress: fingerprint.ipAddress,
          userAgent: fingerprint.userAgent,
        },
      });
      return updated;
    });

    return NextResponse.json({ service });
  } catch (error) {
    return errorResponse(error);
  }
}
