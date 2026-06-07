import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { errorResponse, parseJson } from "@/lib/http";
import {
  requireManagerOverride,
  requirePermission,
} from "@/lib/permissions/policy";
import { assertLegalEntityScope } from "@/lib/permissions/tenant";
import { prisma } from "@/lib/prisma";
import { requireActiveOperatorShift } from "@/lib/shifts/active-shift";
import { stockAdjustmentSchema } from "@/lib/validation/common";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    requirePermission(auth.role, "stock:adjust");
    requireManagerOverride(auth.role, "STOCK_ADJUSTMENT");
    const input = await parseJson(request, stockAdjustmentSchema);

    const activeShift = await requireActiveOperatorShift({
      auth,
      branchId: input.branchId,
    });
    const product = await prisma.productCatalog.findFirst({
      where: {
        id: input.productCatalogId,
        legalEntityId: auth.legalEntityId,
        branchId: input.branchId,
      },
    });
    assertLegalEntityScope(auth.legalEntityId, product);

    const result = await prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.productCatalog.update({
        where: { id: product.id },
        data: { stockQuantity: { increment: input.quantityDelta } },
      });
      const movement = await tx.stockMovement.create({
        data: {
          legalEntityId: auth.legalEntityId,
          branchId: input.branchId,
          operatorShiftId: activeShift.id,
          productCatalogId: product.id,
          movementType: "ADJUSTMENT",
          quantityDelta: input.quantityDelta,
          reason: input.reason,
        },
      });
      await tx.auditLog.create({
        data: {
          legalEntityId: auth.legalEntityId,
          branchId: input.branchId,
          operatorShiftId: activeShift.id,
          actorUserId: auth.userId,
          action: "STOCK_ADJUSTMENT",
          targetType: "stock_movement",
          targetId: movement.id,
          beforeJson: { stockQuantity: product.stockQuantity },
          afterJson: { stockQuantity: updatedProduct.stockQuantity },
          reason: input.reason,
        },
      });
      return { product: updatedProduct, movement };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
