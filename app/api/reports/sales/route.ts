import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import {
  buildSalesReport,
  type ReportCreditNoteInput,
  type ReportInvoiceInput,
} from "@/lib/reports/aggregations";
import { buildCsv, csvResponse, formatCsvAmount } from "@/lib/reports/csv";
import {
  branchScopedWhere,
  dateRangeWhere,
  parseReportFilters,
} from "@/lib/reports/filters";
import { loadReportBranches, reportMeta } from "@/lib/reports/metadata";
import { errorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    const filters = parseReportFilters(request, auth);
    const [branches, invoices, creditNotes] = await Promise.all([
      loadReportBranches(auth),
      prisma.gstInvoice.findMany({
        where: {
          legalEntityId: auth.legalEntityId,
          status: "POSTED",
          postedAt: dateRangeWhere(filters),
          ...branchScopedWhere(filters),
        },
        include: { branch: { select: { name: true, code: true } } },
        orderBy: { postedAt: "asc" },
      }),
      prisma.creditNote.findMany({
        where: {
          legalEntityId: auth.legalEntityId,
          status: "POSTED",
          postedAt: dateRangeWhere(filters),
          ...branchScopedWhere(filters),
        },
        include: { branch: { select: { name: true, code: true } } },
        orderBy: { postedAt: "asc" },
      }),
    ]);

    const report = buildSalesReport({
      invoices: invoices.map(toReportInvoice),
      creditNotes: creditNotes.map(toReportCreditNote),
    });

    if (filters.format === "csv") {
      return csvResponse(
        "sales-summary.csv",
        buildCsv(
          [
            "Date",
            "Gross Sales",
            "Discounts",
            "Refunds",
            "Net Sales",
            "GST Collected",
            "Invoice Count",
          ],
          report.byDay.map((row) => [
            row.date,
            formatCsvAmount(row.grossSales),
            formatCsvAmount(row.discounts),
            formatCsvAmount(row.refunds),
            formatCsvAmount(row.netSales),
            formatCsvAmount(row.gstCollected),
            row.invoiceCount,
          ]),
        ),
      );
    }

    return NextResponse.json({
      ...reportMeta({ auth, filters, branches }),
      summary: report.summary,
      byBranch: report.byBranch,
      byDay: report.byDay,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function toReportInvoice(
  invoice: Awaited<ReturnType<typeof prisma.gstInvoice.findMany>>[number] & {
    branch: { name: string; code: string };
  },
): ReportInvoiceInput {
  return {
    id: invoice.id,
    branchId: invoice.branchId,
    branchName: invoice.branch.name,
    branchCode: invoice.branch.code,
    invoiceNumber: invoice.invoiceNumber,
    postedAt: invoice.postedAt,
    taxableValue: invoice.taxableValue,
    cgstAmount: invoice.cgstAmount,
    sgstAmount: invoice.sgstAmount,
    igstAmount: invoice.igstAmount,
    discountAmount: invoice.discountAmount,
    totalAmount: invoice.totalAmount,
  };
}

function toReportCreditNote(
  creditNote: Awaited<ReturnType<typeof prisma.creditNote.findMany>>[number] & {
    branch: { name: string; code: string };
  },
): ReportCreditNoteInput {
  return {
    branchId: creditNote.branchId,
    branchName: creditNote.branch.name,
    branchCode: creditNote.branch.code,
    status: creditNote.status,
    postedAt: creditNote.postedAt,
    taxableValue: creditNote.taxableValue,
    cgstAmount: creditNote.cgstAmount,
    sgstAmount: creditNote.sgstAmount,
    igstAmount: creditNote.igstAmount,
    totalAmount: creditNote.totalAmount,
  };
}
