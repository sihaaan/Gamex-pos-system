import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { buildHsnSacSummary } from "@/lib/reports/aggregations";
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
    const [branches, invoices] = await Promise.all([
      loadReportBranches(auth),
      prisma.gstInvoice.findMany({
        where: {
          legalEntityId: auth.legalEntityId,
          status: "POSTED",
          postedAt: dateRangeWhere(filters),
          ...branchScopedWhere(filters),
        },
        include: {
          branch: { select: { name: true, code: true } },
          creditNotes: { where: { status: "POSTED" } },
          lines: { orderBy: { createdAt: "asc" } },
          tab: { select: { customerLabel: true } },
        },
        orderBy: { postedAt: "asc" },
        take: 500,
      }),
    ]);
    const invoiceRows = invoices.map((invoice) => {
      const creditNoteAdjustment = invoice.creditNotes.reduce(
        (total, creditNote) => total + creditNote.totalAmount,
        0,
      );
      return {
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.postedAt.toISOString(),
        branchName: invoice.branch.name,
        branchCode: invoice.branch.code,
        customerName:
          invoice.customerName || invoice.tab.customerLabel || "Walk-in customer",
        customerGstin: invoice.customerGstin,
        taxableValue: invoice.taxableValue,
        cgstAmount: invoice.cgstAmount,
        sgstAmount: invoice.sgstAmount,
        igstAmount: invoice.igstAmount,
        totalGst: invoice.cgstAmount + invoice.sgstAmount + invoice.igstAmount,
        invoiceTotal: invoice.totalAmount,
        creditNoteAdjustment,
      };
    });
    const hsnSacSummary = buildHsnSacSummary(
      invoices.flatMap((invoice) =>
        invoice.lines.map((line) => ({
          hsnSac: line.hsnSac,
          description: line.description,
          taxableValue: line.taxableValue,
          cgstAmount: line.cgstAmount,
          sgstAmount: line.sgstAmount,
          igstAmount: line.igstAmount,
          totalAmount: line.totalAmount,
          quantity: line.quantity,
          billableMinutes: line.billableMinutes,
        })),
      ),
    );

    if (filters.format === "csv") {
      if (filters.section === "hsn-sac") {
        return csvResponse(
          "gst-hsn-sac-summary.csv",
          buildCsv(
            [
              "HSN/SAC",
              "Description/Category",
              "Quantity or Minutes",
              "Taxable Value",
              "CGST",
              "SGST",
              "IGST",
              "Total GST",
              "Total Value",
            ],
            hsnSacSummary.map((row) => [
              row.hsnSac,
              row.description,
              row.quantityOrMinutes,
              formatCsvAmount(row.taxableValue),
              formatCsvAmount(row.cgstAmount),
              formatCsvAmount(row.sgstAmount),
              formatCsvAmount(row.igstAmount),
              formatCsvAmount(row.totalGst),
              formatCsvAmount(row.totalAmount),
            ]),
          ),
        );
      }

      return csvResponse(
        "gst-invoice-rows.csv",
        buildCsv(
          [
            "Invoice Number",
            "Invoice Date",
            "Branch",
            "Customer/Bill",
            "Customer GSTIN",
            "Taxable Value",
            "CGST",
            "SGST",
            "IGST",
            "Total GST",
            "Invoice Total",
            "Credit Note Adjustment",
          ],
          invoiceRows.map((row) => [
            row.invoiceNumber,
            row.invoiceDate,
            `${row.branchName} (${row.branchCode})`,
            row.customerName,
            row.customerGstin,
            formatCsvAmount(row.taxableValue),
            formatCsvAmount(row.cgstAmount),
            formatCsvAmount(row.sgstAmount),
            formatCsvAmount(row.igstAmount),
            formatCsvAmount(row.totalGst),
            formatCsvAmount(row.invoiceTotal),
            formatCsvAmount(row.creditNoteAdjustment),
          ]),
        ),
      );
    }

    return NextResponse.json({
      ...reportMeta({ auth, filters, branches }),
      note: "CA export / GST summary. This is not an official GST return filing.",
      invoiceRows,
      hsnSacSummary,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
