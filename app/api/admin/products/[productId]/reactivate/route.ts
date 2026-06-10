import { NextResponse } from "next/server";
import { requireAuth, requestFingerprint } from "@/lib/auth/session";
import { assertCanManageBranchScopedRecord } from "@/lib/admin/management";
import { errorResponse, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { adminStateChangeSchema } from "@/lib/validation/common";

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
    const input = await parseJson(request, adminStateChangeSchema);
    const before = await prisma.productCatalog.findFirst({
      where: { id: params.productId, legalEntityId: auth.legalEntityId },
      include: { taxRate: true },
    });
    assertCanManageBranchScopedRecord(auth, before, "Product");
    const fingerprint = await requestFingerprint();
    const product = await prisma.productCatalog.update({
      where: { id: before.id },
      data: { isActive: true },
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
        action: "ADMIN_PRODUCT_REACTIVATED",
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
