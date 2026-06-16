import { NextResponse } from "next/server";
import { requireAuth, requestFingerprint } from "@/lib/auth/session";
import type { Prisma } from "@/lib/generated/prisma/client";
import { created, errorResponse } from "@/lib/http";
import { requirePermission } from "@/lib/permissions/policy";
import { prisma } from "@/lib/prisma";

const defaultRetailTax = {
  code: "RETAIL-DEFAULT",
  kind: "HSN" as const,
  description: "Default snacks/drinks GST",
  gstRate: 5,
};

const defaultTimedTax = {
  code: "TIMED-PLAY",
  kind: "SAC" as const,
  description: "Default Pool/PS5 timed play GST",
  gstRate: 18,
};

const defaultServices = [
  {
    name: "Pool play",
    description: "Pool timed play",
    sacCode: "9996",
    halfHourPrice: 8000,
    hourPrice: 14000,
    controllerPricingEnabled: false,
    multiplayerHalfHourPrice: null,
    multiplayerHourPrice: null,
  },
  {
    name: "PS5 play",
    description: "PS5 console timed play",
    sacCode: "9996",
    halfHourPrice: 8000,
    hourPrice: 14000,
    controllerPricingEnabled: true,
    multiplayerHalfHourPrice: 6000,
    multiplayerHourPrice: 11000,
  },
] as const;

type IdName = { id: string; name: string };
type IdOnly = { id: string };

export async function POST(): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    requirePermission(auth.role, "catalog:write");
    const fingerprint = await requestFingerprint();

    const result = await prisma.$transaction(async (tx) => {
      const retailTaxRate = await findOrCreateTaxRate(
        tx,
        auth.legalEntityId,
        defaultRetailTax,
      );
      const timedTaxRate = await findOrCreateTaxRate(
        tx,
        auth.legalEntityId,
        defaultTimedTax,
      );
      const serviceBranchId = auth.role === "OWNER" ? null : auth.branchId;

      const services: IdName[] = [];
      for (const serviceInput of defaultServices) {
        const existing = await tx.serviceCatalog.findFirst({
          where: {
            legalEntityId: auth.legalEntityId,
            branchId: serviceBranchId,
            name: serviceInput.name,
          },
          select: { id: true, name: true },
        });

        if (existing) {
          services.push(existing);
          continue;
        }

        const pricingRule: IdOnly = await tx.pricingRule.create({
          data: {
            legalEntityId: auth.legalEntityId,
            name: `${serviceInput.name} default ${Date.now()} ${services.length}`,
            pricingMode: "HALF_HOUR_BLOCKS",
            ratePerMinute: Math.round(serviceInput.hourPrice / 60),
            halfHourPrice: serviceInput.halfHourPrice,
            hourPrice: serviceInput.hourPrice,
            controllerPricingEnabled: serviceInput.controllerPricingEnabled,
            multiplayerHalfHourPrice: serviceInput.multiplayerHalfHourPrice,
            multiplayerHourPrice: serviceInput.multiplayerHourPrice,
            maxControllers: 4,
            minimumBillableMinutes: 30,
            roundUpToMinutes: 30,
            managerDiscountLimitPercent: 10,
          },
          select: { id: true },
        });

        const service: IdName = await tx.serviceCatalog.create({
          data: {
            legalEntityId: auth.legalEntityId,
            branchId: serviceBranchId,
            taxRateId: timedTaxRate.id,
            pricingRuleId: pricingRule.id,
            name: serviceInput.name,
            sacCode: serviceInput.sacCode,
            description: serviceInput.description,
            isActive: true,
          },
          select: { id: true, name: true },
        });
        services.push(service);
      }

      await tx.auditLog.create({
        data: {
          legalEntityId: auth.legalEntityId,
          branchId: serviceBranchId,
          actorUserId: auth.userId,
          action: "ADMIN_PILOT_DEFAULTS_CREATED",
          targetType: "pilot_defaults",
          targetId: auth.legalEntityId,
          afterJson: JSON.parse(
            JSON.stringify({
              retailTaxRateId: retailTaxRate.id,
              timedTaxRateId: timedTaxRate.id,
              services,
            }),
          ),
          reason: "Create simple pilot defaults",
          ipAddress: fingerprint.ipAddress,
          userAgent: fingerprint.userAgent,
        },
      });

      return {
        retailTaxRateId: retailTaxRate.id,
        timedTaxRateId: timedTaxRate.id,
        services,
      };
    });

    return created(result);
  } catch (error) {
    return errorResponse(error);
  }
}

async function findOrCreateTaxRate(
  tx: Prisma.TransactionClient,
  legalEntityId: string,
  input: typeof defaultRetailTax | typeof defaultTimedTax,
): Promise<IdOnly> {
  const existing = await tx.taxRate.findFirst({
    where: {
      legalEntityId,
      code: input.code,
      kind: input.kind,
      effectiveTo: null,
    },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  return tx.taxRate.create({
    data: {
      legalEntityId,
      code: input.code,
      kind: input.kind,
      description: input.description,
      gstRate: input.gstRate,
      effectiveFrom: new Date(),
    },
    select: { id: true },
  });
}
