import { NextResponse } from "next/server";
import { requireAuth, requestFingerprint } from "@/lib/auth/session";
import {
  assertCanAssignCatalogBranch,
  branchOptionalCatalogWhereForActor,
} from "@/lib/admin/management";
import { created, errorResponse, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { adminProductCreateSchema } from "@/lib/validation/common";

export async function GET(): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    const products = await prisma.productCatalog.findMany({
      where: branchOptionalCatalogWhereForActor(auth),
      include: {
        branch: { select: { id: true, name: true, code: true } },
        taxRate: true,
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    return NextResponse.json({ products });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    const input = await parseJson(request, adminProductCreateSchema);
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
    const product = await prisma.productCatalog.create({
      data: {
        legalEntityId: auth.legalEntityId,
        branchId,
        taxRateId: taxRate.id,
        sku: input.sku,
        name: input.name,
        hsnCode: input.hsnCode,
        unitPrice: input.unitPrice,
        trackStock: input.trackStock,
        stockQuantity: input.stockQuantity,
        lowStockThreshold: input.lowStockThreshold,
        isActive: input.isActive,
      },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        taxRate: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        legalEntityId: auth.legalEntityId,
        branchId: product.branchId,
        actorUserId: auth.userId,
        action: "ADMIN_PRODUCT_CREATED",
        targetType: "product",
        targetId: product.id,
        afterJson: JSON.parse(JSON.stringify(product)),
        ipAddress: fingerprint.ipAddress,
        userAgent: fingerprint.userAgent,
      },
    });

    return created({ product });
  } catch (error) {
    return errorResponse(error);
  }
}
