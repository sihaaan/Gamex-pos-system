import { NextResponse } from "next/server";
import { requireAuth, requestFingerprint } from "@/lib/auth/session";
import {
  assertCanAssignCatalogBranch,
  branchOptionalCatalogWhereForActor,
} from "@/lib/admin/management";
import { created, errorResponse, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { adminServiceCreateSchema } from "@/lib/validation/common";

export async function GET(): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    const services = await prisma.serviceCatalog.findMany({
      where: branchOptionalCatalogWhereForActor(auth),
      include: {
        branch: { select: { id: true, name: true, code: true } },
        pricingRule: true,
        taxRate: true,
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    return NextResponse.json({ services });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    const input = await parseJson(request, adminServiceCreateSchema);
    const [branch, taxRate] = await Promise.all([
      input.branchId
        ? prisma.branch.findFirst({
            where: { id: input.branchId, legalEntityId: auth.legalEntityId },
            select: { id: true, legalEntityId: true, isActive: true },
          })
        : Promise.resolve(null),
      prisma.taxRate.findFirst({
        where: { id: input.taxRateId, legalEntityId: auth.legalEntityId },
        select: { id: true },
      }),
    ]);
    const branchId = assertCanAssignCatalogBranch(
      auth,
      branch,
      input.branchId ?? null,
      { allowGlobalForOwner: true },
    );
    if (!taxRate) {
      return NextResponse.json(
        { error: { code: "TAX_RATE_NOT_FOUND", message: "GST rate was not found." } },
        { status: 404 },
      );
    }

    const fingerprint = await requestFingerprint();
    const result = await prisma.$transaction(async (tx) => {
      const pricingRule = await tx.pricingRule.create({
        data: {
          legalEntityId: auth.legalEntityId,
          name: uniquePricingRuleName(input.name),
          ratePerMinute: input.ratePerMinute,
          minimumBillableMinutes: input.minimumBillableMinutes,
          roundUpToMinutes: input.roundUpToMinutes,
          managerDiscountLimitPercent: input.managerDiscountLimitPercent,
        },
      });
      const service = await tx.serviceCatalog.create({
        data: {
          legalEntityId: auth.legalEntityId,
          branchId,
          taxRateId: taxRate.id,
          pricingRuleId: pricingRule.id,
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
          branchId: service.branchId,
          actorUserId: auth.userId,
          action: "ADMIN_SERVICE_CREATED",
          targetType: "service",
          targetId: service.id,
          afterJson: JSON.parse(JSON.stringify(service)),
          ipAddress: fingerprint.ipAddress,
          userAgent: fingerprint.userAgent,
        },
      });
      return service;
    });

    return created({ service: result });
  } catch (error) {
    return errorResponse(error);
  }
}

function uniquePricingRuleName(serviceName: string): string {
  return `${serviceName.trim()} pricing ${Date.now()}`;
}
