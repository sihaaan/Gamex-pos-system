import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { requirePermission } from "@/lib/permissions/policy";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    if (auth.role !== "STAFF") {
      requirePermission(auth.role, "reports:read");
    }

    const url = new URL(request.url);
    const branchId = url.searchParams.get("branchId") ?? undefined;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const generatedAt = {
      gte: from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      lte: to ? new Date(to) : undefined,
    };

    const summaries = await prisma.shiftCloseSummary.findMany({
      where: {
        legalEntityId: auth.legalEntityId,
        branchId:
          auth.role === "OWNER"
            ? branchId
            : auth.branchId
              ? auth.branchId
              : branchId,
        operatorShift:
          auth.role === "STAFF" ? { staffUserId: auth.userId } : undefined,
        generatedAt,
      },
      include: {
        branch: { select: { name: true, code: true } },
        operatorShift: {
          select: {
            openedAt: true,
            closedAt: true,
            staffUser: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { generatedAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ summaries });
  } catch (error) {
    return errorResponse(error);
  }
}
