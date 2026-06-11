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

const reportAuditActions = [
  "REFUND",
  "VOID_TAB",
  "VOID_INVOICE",
  "ADMIN_STOCK_ADJUSTED",
  "ADMIN_SERVICE_EDITED",
  "ADMIN_GST_RATE_EDITED",
  "ADMIN_PRODUCT_EDITED",
  "ADMIN_PRODUCT_CREATED",
  "ADMIN_RESOURCE_EDITED",
  "ADMIN_RESOURCE_CREATED",
  "TAB_REOPENED",
  "SHIFT_REOPENED",
  "SERVICE_SESSION_ADJUSTED",
] as const;

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    const filters = parseReportFilters(request, auth);
    const [branches, auditLogs, managerOverrides] = await Promise.all([
      loadReportBranches(auth),
      prisma.auditLog.findMany({
        where: {
          legalEntityId: auth.legalEntityId,
          createdAt: dateRangeWhere(filters),
          action: { in: [...reportAuditActions] },
          ...branchScopedWhere(filters),
        },
        include: {
          actor: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 300,
      }),
      prisma.managerOverride.findMany({
        where: {
          legalEntityId: auth.legalEntityId,
          createdAt: dateRangeWhere(filters),
          ...branchScopedWhere(filters),
        },
        include: {
          branch: { select: { name: true, code: true } },
          manager: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 300,
      }),
    ]);
    const branchById = new Map(branches.map((branch) => [branch.id, branch]));
    const auditRows = auditLogs.map((log) => {
      const branch = log.branchId ? branchById.get(log.branchId) : null;
      return {
        occurredAt: log.createdAt.toISOString(),
        action: log.action,
        actorName: log.actor?.name ?? "System",
        managerApprover: null as string | null,
        branchName: branch ? `${branch.name} (${branch.code})` : "Legal entity",
        target: `${log.targetType} ${log.targetId}`,
        amount: amountFromJson(log.afterJson),
        reason: log.reason,
        metadataSummary: metadataSummary(log.afterJson),
      };
    });
    const overrideRows = managerOverrides.map((override) => ({
      occurredAt: override.createdAt.toISOString(),
      action: `MANAGER_OVERRIDE_${override.action}`,
      actorName: "Staff request",
      managerApprover: override.manager.name,
      branchName: `${override.branch.name} (${override.branch.code})`,
      target: `${override.targetType} ${override.targetId}`,
      amount: amountFromJson(override.metadata),
      reason: override.reason,
      metadataSummary: metadataSummary(override.metadata),
    }));
    const rows = [...auditRows, ...overrideRows].sort((left, right) =>
      right.occurredAt.localeCompare(left.occurredAt),
    );

    if (filters.format === "csv") {
      return csvResponse(
        "exceptions-report.csv",
        buildCsv(
          [
            "Date/Time",
            "Action",
            "Staff/Actor",
            "Manager Approver",
            "Branch",
            "Target",
            "Amount",
            "Reason",
            "Metadata Summary",
          ],
          rows.map((row) => [
            row.occurredAt,
            row.action,
            row.actorName,
            row.managerApprover,
            row.branchName,
            row.target,
            row.amount == null ? "" : formatCsvAmount(row.amount),
            row.reason,
            row.metadataSummary,
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

function amountFromJson(value: unknown): number | null {
  const record = jsonRecord(value);
  if (!record) {
    return null;
  }
  const amount = record.amount ?? record.totalAmount;
  return typeof amount === "number" ? amount : null;
}

function metadataSummary(value: unknown): string {
  const record = jsonRecord(value);
  if (!record) {
    return "";
  }
  const summaryKeys = ["invoiceNumber", "creditNoteNumber", "amount", "totalAmount"];
  return summaryKeys
    .filter((key) => record[key] != null)
    .map((key) => `${key}: ${String(record[key])}`)
    .join(", ");
}

function jsonRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}
