import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { buildCsv, csvResponse, formatCsvAmount } from "@/lib/reports/csv";
import {
  branchScopedWhere,
  dateRangeWhere,
  parseReportFilters,
} from "@/lib/reports/filters";
import { loadReportBranches, reportMeta } from "@/lib/reports/metadata";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    const filters = parseReportFilters(request, auth);
    const [branches, lines] = await Promise.all([
      loadReportBranches(auth),
      prisma.gstInvoiceLine.findMany({
        where: {
          legalEntityId: auth.legalEntityId,
          lineKind: "RETAIL",
          gstInvoice: {
            status: "POSTED",
            postedAt: dateRangeWhere(filters),
          },
          ...branchScopedWhere(filters),
        },
        include: {
          branch: { select: { name: true, code: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 500,
      }),
    ]);
    const retailLineIds = lines
      .map((line) => line.sourceLineId)
      .filter((id): id is string => Boolean(id));
    const retailLines =
      retailLineIds.length > 0
        ? await prisma.tabRetailLine.findMany({
            where: { id: { in: retailLineIds }, legalEntityId: auth.legalEntityId },
            include: {
              productCatalog: {
                select: {
                  id: true,
                  name: true,
                  stockQuantity: true,
                  lowStockThreshold: true,
                },
              },
            },
          })
        : [];
    const retailLineById = new Map(retailLines.map((line) => [line.id, line]));
    const rowsByKey = new Map<
      string,
      {
        productName: string;
        branchName: string;
        branchCode: string;
        quantitySold: number;
        grossSales: number;
        gstCollected: number;
        currentStock: number | null;
        lowStock: boolean;
      }
    >();
    for (const line of lines) {
      const retailLine = line.sourceLineId
        ? retailLineById.get(line.sourceLineId)
        : null;
      const key =
        retailLine?.productCatalog.id ??
        `${line.branchId}:${line.description}:${line.hsnSac}`;
      const row =
        rowsByKey.get(key) ??
        {
          productName: retailLine?.productCatalog.name ?? line.description,
          branchName: line.branch.name,
          branchCode: line.branch.code,
          quantitySold: 0,
          grossSales: 0,
          gstCollected: 0,
          currentStock: retailLine?.productCatalog.stockQuantity ?? null,
          lowStock: retailLine
            ? retailLine.productCatalog.stockQuantity <=
              retailLine.productCatalog.lowStockThreshold
            : false,
        };
      row.quantitySold += line.quantity ?? 1;
      row.grossSales += line.totalAmount;
      row.gstCollected += line.cgstAmount + line.sgstAmount + line.igstAmount;
      rowsByKey.set(key, row);
    }
    const rows = Array.from(rowsByKey.values()).sort(
      (left, right) => right.grossSales - left.grossSales,
    );

    if (filters.format === "csv") {
      return csvResponse(
        "product-sales.csv",
        buildCsv(
          [
            "Product",
            "Branch",
            "Quantity Sold",
            "Gross Sales",
            "GST Collected",
            "Current Stock",
            "Low Stock",
          ],
          rows.map((row) => [
            row.productName,
            `${row.branchName} (${row.branchCode})`,
            row.quantitySold,
            formatCsvAmount(row.grossSales),
            formatCsvAmount(row.gstCollected),
            row.currentStock,
            row.lowStock ? "Yes" : "No",
          ]),
        ),
      );
    }

    return NextResponse.json({
      ...reportMeta({ auth, filters, branches }),
      rows,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
