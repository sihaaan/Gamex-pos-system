import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { requirePermission } from "@/lib/permissions/policy";
import { prisma } from "@/lib/prisma";

export async function GET(): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    requirePermission(auth.role, "catalog:write");

    const [services, products, taxRates, resources] = await Promise.all([
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
    ]);

    return NextResponse.json({ services, products, taxRates, resources });
  } catch (error) {
    return errorResponse(error);
  }
}
