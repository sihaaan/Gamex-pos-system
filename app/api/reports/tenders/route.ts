import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { tenderLabel } from "@/lib/invoices/display";
import { buildTenderSummary } from "@/lib/reports/aggregations";
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
    const [branches, payments] = await Promise.all([
      loadReportBranches(auth),
      prisma.payment.findMany({
        where: {
          legalEntityId: auth.legalEntityId,
          gstInvoiceId: { not: null },
          receivedAt: dateRangeWhere(filters),
          operatorShift: filters.staffUserId
            ? { staffUserId: filters.staffUserId }
            : undefined,
          ...branchScopedWhere(filters),
        },
        include: {
          branch: { select: { name: true, code: true } },
          gstInvoice: { select: { invoiceNumber: true, postedAt: true } },
          operatorShift: {
            select: { staffUser: { select: { name: true, email: true } } },
          },
        },
        orderBy: { receivedAt: "desc" },
        take: 500,
      }),
    ]);
    const summary = buildTenderSummary(payments);
    const rows = payments.map((payment) => ({
      invoiceNumber: payment.gstInvoice?.invoiceNumber ?? "",
      receivedAt: payment.receivedAt.toISOString(),
      branchName: payment.branch.name,
      branchCode: payment.branch.code,
      operatorName: payment.operatorShift.staffUser.name,
      operatorEmail: payment.operatorShift.staffUser.email,
      tenderType: payment.tenderType,
      tenderLabel: tenderLabel(payment.tenderType),
      amount: payment.amount,
      reference: payment.reference,
    }));

    if (filters.format === "csv") {
      return csvResponse(
        "tender-report.csv",
        buildCsv(
          [
            "Invoice Number",
            "Date/Time",
            "Branch",
            "Operator",
            "Tender",
            "Amount",
            "Reference",
          ],
          rows.map((row) => [
            row.invoiceNumber,
            row.receivedAt,
            `${row.branchName} (${row.branchCode})`,
            row.operatorName,
            row.tenderLabel,
            formatCsvAmount(row.amount),
            row.reference,
          ]),
        ),
      );
    }

    return NextResponse.json({
      ...reportMeta({ auth, filters, branches }),
      totalsByTender: summary.totalsByTender,
      mixedTenderInvoiceCount: summary.mixedTenderInvoiceCount,
      rows,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
