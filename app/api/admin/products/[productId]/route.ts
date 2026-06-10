import { NextResponse } from "next/server";
import { requireAuth, requestFingerprint } from "@/lib/auth/session";
import {
  assertCanAssignCatalogBranch,
  assertCanManageBranchScopedRecord,
} from "@/lib/admin/management";
import { errorResponse, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { adminProductUpdateSchema } from "@/lib/validation/common";

type RouteContext = {
  params: Promise<{ productId: string }>;
};

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    const params = await context.params;
    const input = await parseJson(request, adminProductUpdateSchema);
    const before = await prisma.productCatalog.findFirst({
      where: { id: params.productId, legalEntityId: auth.legalEntityId },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        taxRate: true,
      },
    });
    assertCanManageBranchScopedRecord(auth, before, "Product");

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
    const fingerprint = await requestFingerprint();

    const product = await prisma.productCatalog.update({
      where: { id: before.id },
      data: {
        branchId,
        taxRateId: input.taxRateId,
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
        action: "ADMIN_PRODUCT_EDITED",
        targetType: "product",
        targetId: product.id,
        beforeJson: JSON.parse(JSON.stringify(before)),
        afterJson: JSON.parse(JSON.stringify(product)),
        reason: input.reason,
        ipAddress: fingerprint.ipAddress,
        userAgent: fingerprint.userAgent,
      },
    });

    return NextResponse.json({ product });
  } catch (error) {
    return errorResponse(error);
  }
}
