import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { errorResponse, parseJson } from "@/lib/http";
import { requirePermission } from "@/lib/permissions/policy";
import { assertLegalEntityScope } from "@/lib/permissions/tenant";
import { prisma } from "@/lib/prisma";
import { requireActiveOperatorShift } from "@/lib/shifts/active-shift";
import { addRetailLineSchema } from "@/lib/validation/common";

type RouteContext = {
  params: Promise<{ tabId: string }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    requirePermission(auth.role, "tab:write");
    const params = await context.params;
    const input = await parseJson(request, addRetailLineSchema);

    if (input.tabId !== params.tabId) {
      return NextResponse.json(
        {
          error: {
            code: "TAB_ID_MISMATCH",
            message: "Route tab id and payload tab id must match.",
          },
        },
        { status: 400 },
      );
    }

    const tab = await prisma.tab.findFirst({
      where: { id: input.tabId, legalEntityId: auth.legalEntityId },
      select: {
        id: true,
        legalEntityId: true,
        branchId: true,
        operatorShiftId: true,
        status: true,
      },
    });
    assertLegalEntityScope(auth.legalEntityId, tab);

    if (tab.status !== "OPEN" && tab.status !== "REOPENED") {
      return NextResponse.json(
        {
          error: {
            code: "TAB_NOT_OPEN",
            message: "Retail lines can only be added to an open tab.",
          },
        },
        { status: 409 },
      );
    }

    const activeShift = await requireActiveOperatorShift({
      auth,
      branchId: tab.branchId,
    });

    if (activeShift.id !== tab.operatorShiftId) {
      return NextResponse.json(
        {
          error: {
            code: "TAB_SHIFT_CLOSED",
            message: "This tab belongs to a different or closed operator shift.",
          },
        },
        { status: 409 },
      );
    }

    const product = await prisma.productCatalog.findFirst({
      where: {
        id: input.productCatalogId,
        legalEntityId: auth.legalEntityId,
        isActive: true,
      },
      include: { taxRate: true },
    });
    assertLegalEntityScope(auth.legalEntityId, product);

    const line = await prisma.tabRetailLine.create({
      data: {
        legalEntityId: auth.legalEntityId,
        branchId: tab.branchId,
        tabId: tab.id,
        operatorShiftId: activeShift.id,
        productCatalogId: product.id,
        descriptionSnapshot: product.name,
        hsnCodeSnapshot: product.hsnCode,
        gstRateSnapshot: product.taxRate.gstRate,
        unitPriceSnapshot: product.unitPrice,
        quantity: input.quantity,
      },
    });

    return NextResponse.json({ line }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
