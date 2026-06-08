import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    const branchFilter =
      auth.role === "OWNER" ? undefined : auth.branchId ?? undefined;

    const [branches, resources, services, products, activeShift] =
      await Promise.all([
        prisma.branch.findMany({
          where: { legalEntityId: auth.legalEntityId, id: branchFilter },
          orderBy: { name: "asc" },
        }),
        prisma.resource.findMany({
          where: {
            legalEntityId: auth.legalEntityId,
            branchId: branchFilter,
            isActive: true,
          },
          orderBy: [{ branchId: "asc" }, { name: "asc" }],
        }),
        prisma.serviceCatalog.findMany({
          where: {
            legalEntityId: auth.legalEntityId,
            isActive: true,
            OR: branchFilter
              ? [{ branchId: branchFilter }, { branchId: null }]
              : undefined,
          },
          include: { pricingRule: true, taxRate: true },
          orderBy: { name: "asc" },
        }),
        prisma.productCatalog.findMany({
          where: {
            legalEntityId: auth.legalEntityId,
            isActive: true,
            OR: branchFilter
              ? [{ branchId: branchFilter }, { branchId: null }]
              : undefined,
          },
          include: { taxRate: true },
          orderBy: { name: "asc" },
        }),
        prisma.operatorShift.findFirst({
          where: {
            legalEntityId: auth.legalEntityId,
            staffUserId: auth.userId,
            status: "OPEN",
          },
          orderBy: { openedAt: "desc" },
        }),
      ]);

    return NextResponse.json({
      user: auth,
      branches,
      resources,
      services,
      products,
      activeShift,
      managerDiscountLimitPercent: Number(
        process.env.MANAGER_DISCOUNT_LIMIT_PERCENT ?? "10",
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
