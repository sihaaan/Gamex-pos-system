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
    const [branches, summaries, openShifts] = await Promise.all([
      loadReportBranches(auth),
      prisma.shiftCloseSummary.findMany({
        where: {
          legalEntityId: auth.legalEntityId,
          generatedAt: dateRangeWhere(filters),
          operatorShift: filters.staffUserId
            ? { staffUserId: filters.staffUserId }
            : undefined,
          ...branchScopedWhere(filters),
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
      }),
      prisma.operatorShift.findMany({
        where: {
          legalEntityId: auth.legalEntityId,
          status: "OPEN",
          openedAt: { lt: filters.to },
          ...branchScopedWhere(filters),
        },
        include: {
          branch: { select: { name: true, code: true } },
          staffUser: { select: { name: true, email: true } },
        },
        orderBy: { openedAt: "desc" },
        take: 100,
      }),
    ]);

    const rows = summaries.map((summary) => ({
      id: summary.id,
      branchName: summary.branch.name,
      branchCode: summary.branch.code,
      operatorName: summary.operatorShift.staffUser.name,
      operatorEmail: summary.operatorShift.staffUser.email,
      openedAt: summary.operatorShift.openedAt.toISOString(),
      closedAt: summary.operatorShift.closedAt?.toISOString() ?? null,
      generatedAt: summary.generatedAt.toISOString(),
      grossSales: summary.grossSales,
      discounts: summary.discounts,
      refunds: summary.refunds,
      voidedAmount: summary.voidedAmount,
      netSales: summary.netSales,
      gstCollected: summary.gstCollected,
      cashTotal: summary.cashTotal,
      upiGooglePayTotal: summary.upiGooglePayTotal,
      upiPhonePeTotal: summary.upiPhonePeTotal,
      upiOtherTotal: summary.upiOtherTotal,
      cardRecordedTotal: summary.cardRecordedTotal,
      mixedTenderTotal: summary.mixedTenderTotal,
      activeTabCount: summary.activeTabCount,
      warnings: jsonArray(summary.warnings),
      unusualActionCount: countUnusualActions(summary.unusualActions),
    }));

    if (filters.format === "csv") {
      return csvResponse(
        "shift-summary.csv",
        buildCsv(
          [
            "Generated At",
            "Branch",
            "Operator",
            "Opened At",
            "Closed At",
            "Gross Sales",
            "Discounts",
            "Refunds",
            "Net Sales",
            "GST Collected",
            "Cash",
            "PhonePe",
            "Google Pay",
            "UPI Other",
            "Card",
            "Mixed Tender",
            "Active Tabs",
            "Unusual Actions",
            "Warnings",
          ],
          rows.map((row) => [
            row.generatedAt,
            `${row.branchName} (${row.branchCode})`,
            row.operatorName,
            row.openedAt,
            row.closedAt,
            formatCsvAmount(row.grossSales),
            formatCsvAmount(row.discounts),
            formatCsvAmount(row.refunds),
            formatCsvAmount(row.netSales),
            formatCsvAmount(row.gstCollected),
            formatCsvAmount(row.cashTotal),
            formatCsvAmount(row.upiPhonePeTotal),
            formatCsvAmount(row.upiGooglePayTotal),
            formatCsvAmount(row.upiOtherTotal),
            formatCsvAmount(row.cardRecordedTotal),
            formatCsvAmount(row.mixedTenderTotal),
            row.activeTabCount,
            row.unusualActionCount,
            row.warnings.join(" "),
          ]),
        ),
      );
    }

    return NextResponse.json({
      ...reportMeta({ auth, filters, branches }),
      summaries: rows,
      openShifts: openShifts.map((shift) => ({
        id: shift.id,
        branchName: shift.branch.name,
        branchCode: shift.branch.code,
        operatorName: shift.staffUser.name,
        operatorEmail: shift.staffUser.email,
        openedAt: shift.openedAt.toISOString(),
        warning: "Shift is still open. Final totals are unavailable until close.",
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function jsonArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function countUnusualActions(value: unknown): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return 0;
  }
  return Object.values(value).reduce((total, current) => {
    if (typeof current === "number") {
      return total + current;
    }
    if (Array.isArray(current)) {
      return total + current.length;
    }
    return total;
  }, 0);
}
