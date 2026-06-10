import { NextResponse } from "next/server";
import { requireAuth, requestFingerprint } from "@/lib/auth/session";
import {
  assertCanManageBranchScopedRecord,
  calculateStockAdjustmentDelta,
} from "@/lib/admin/management";
import { AppError, errorResponse, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { adminProductStockAdjustmentSchema } from "@/lib/validation/common";

type RouteContext = {
  params: Promise<{ productId: string }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    const params = await context.params;
    const input = await parseJson(request, adminProductStockAdjustmentSchema);
    const product = await prisma.productCatalog.findFirst({
      where: { id: params.productId, legalEntityId: auth.legalEntityId },
    });
    assertCanManageBranchScopedRecord(auth, product, "Product");

    if (!product.trackStock) {
      throw new AppError(
        409,
        "STOCK_NOT_TRACKED",
        "Stock adjustment is available only for stock-tracked products.",
      );
    }
    if (!product.branchId) {
      throw new AppError(
        409,
        "BRANCH_PRODUCT_REQUIRED",
        "Stock adjustment requires a branch-scoped product.",
      );
    }
    const branchId = product.branchId;

    const quantityDelta = calculateStockAdjustmentDelta({
      adjustmentType: input.adjustmentType,
      quantity: input.quantity,
      currentStock: product.stockQuantity,
    });

    const fingerprint = await requestFingerprint();
    const result = await prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.productCatalog.update({
        where: { id: product.id },
        data: { stockQuantity: { increment: quantityDelta } },
        include: {
          branch: { select: { id: true, name: true, code: true } },
          taxRate: true,
        },
      });
      const movement = await tx.stockMovement.create({
        data: {
          legalEntityId: auth.legalEntityId,
          branchId,
          productCatalogId: product.id,
          movementType: "ADJUSTMENT",
          quantityDelta,
          reason: input.reason,
        },
      });
      await tx.auditLog.create({
        data: {
          legalEntityId: auth.legalEntityId,
          branchId,
          actorUserId: auth.userId,
          action: "ADMIN_STOCK_ADJUSTED",
          targetType: "stock_movement",
          targetId: movement.id,
          beforeJson: { productId: product.id, stockQuantity: product.stockQuantity },
          afterJson: {
            productId: product.id,
            stockQuantity: updatedProduct.stockQuantity,
            quantityDelta,
          },
          reason: input.reason,
          ipAddress: fingerprint.ipAddress,
          userAgent: fingerprint.userAgent,
        },
      });
      return { product: updatedProduct, movement };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
