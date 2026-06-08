import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { requirePermission } from "@/lib/permissions/policy";
import { prisma } from "@/lib/prisma";

export async function GET(): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    requirePermission(auth.role, "catalog:write");

    const [branches, services, products, taxRates, resources, discountRules] =
      await Promise.all([
        prisma.branch.findMany({
          where: { legalEntityId: auth.legalEntityId },
          orderBy: { name: "asc" },
        }),
        prisma.serviceCatalog.findMany({
          where: { legalEntityId: auth.legalEntityId },
          include: { pricingRule: true, taxRate: true },
          orderBy: { name: "asc" },
        }),
        prisma.productCatalog.findMany({
          where: { legalEntityId: auth.legalEntityId },
          include: { taxRate: true },
          orderBy: { name: "asc" },
        }),
        prisma.taxRate.findMany({
          where: { legalEntityId: auth.legalEntityId },
          orderBy: [{ code: "asc" }, { effectiveFrom: "desc" }],
        }),
        prisma.resource.findMany({
          where: { legalEntityId: auth.legalEntityId },
          orderBy: [{ branchId: "asc" }, { name: "asc" }],
        }),
        prisma.discountRule.findMany({
          where: { legalEntityId: auth.legalEntityId },
          include: { branch: { select: { name: true, code: true } } },
          orderBy: [{ isActive: "desc" }, { name: "asc" }],
        }),
      ]);

    return NextResponse.json({
      branches,
      services,
      products,
      taxRates,
      resources,
      discountRules,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
