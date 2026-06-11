import { z } from "zod";
import type { AuthContext } from "@/lib/auth/session";
import { AppError } from "@/lib/http";
import { requirePermission } from "@/lib/permissions/policy";

export const reportPresetSchema = z.enum([
  "today",
  "yesterday",
  "last7",
  "thisMonth",
  "custom",
]);

export type ReportPreset = z.infer<typeof reportPresetSchema>;

export type ReportFilters = {
  preset: ReportPreset;
  from: Date;
  to: Date;
  branchId: string | null;
  staffUserId: string | null;
  format: "json" | "csv";
  section: string | null;
};

const reportQuerySchema = z.object({
  preset: reportPresetSchema.default("today"),
  from: z.string().optional(),
  to: z.string().optional(),
  branchId: z.string().optional(),
  staffUserId: z.string().optional(),
  format: z.enum(["json", "csv"]).default("json"),
  section: z.string().optional(),
});

export function parseReportFilters(
  request: Request,
  auth: AuthContext,
  now = new Date(),
): ReportFilters {
  requirePermission(auth.role, "reports:read");

  const url = new URL(request.url);
  const parsed = reportQuerySchema.parse({
    preset: url.searchParams.get("preset") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    branchId: url.searchParams.get("branchId") ?? undefined,
    staffUserId: url.searchParams.get("staffUserId") ?? undefined,
    format: url.searchParams.get("format") ?? undefined,
    section: url.searchParams.get("section") ?? undefined,
  });
  const range = resolveReportDateRange(
    {
      preset: parsed.preset,
      from: parsed.from,
      to: parsed.to,
    },
    now,
  );

  const requestedBranchId =
    parsed.branchId && parsed.branchId !== "ALL" ? parsed.branchId : null;
  if (auth.role === "MANAGER") {
    if (!auth.branchId) {
      throw new AppError(
        403,
        "BRANCH_SCOPE_REQUIRED",
        "Managers need an assigned branch.",
      );
    }
    if (requestedBranchId && requestedBranchId !== auth.branchId) {
      throw new AppError(
        403,
        "BRANCH_SCOPE_DENIED",
        "Managers can view reports for their assigned branch only.",
      );
    }
  }

  return {
    preset: parsed.preset,
    from: range.from,
    to: range.to,
    branchId: auth.role === "OWNER" ? requestedBranchId : auth.branchId,
    staffUserId: parsed.staffUserId ?? null,
    format: parsed.format,
    section: parsed.section ?? null,
  };
}

export function resolveReportDateRange(
  input: {
    preset: ReportPreset;
    from?: string;
    to?: string;
  },
  now = new Date(),
): { from: Date; to: Date } {
  if (input.preset === "custom") {
    return {
      from: parseReportDate(input.from, "from"),
      to: addDays(parseReportDate(input.to, "to"), 1),
    };
  }

  const today = startOfDay(now);
  if (input.preset === "yesterday") {
    const from = addDays(today, -1);
    return { from, to: today };
  }
  if (input.preset === "last7") {
    return { from: addDays(today, -6), to: addDays(today, 1) };
  }
  if (input.preset === "thisMonth") {
    return {
      from: new Date(today.getFullYear(), today.getMonth(), 1),
      to: addDays(today, 1),
    };
  }
  return { from: today, to: addDays(today, 1) };
}

export function branchScopedWhere(filters: ReportFilters): {
  branchId?: string;
} {
  return filters.branchId ? { branchId: filters.branchId } : {};
}

export function dateRangeWhere(filters: ReportFilters): {
  gte: Date;
  lt: Date;
} {
  return { gte: filters.from, lt: filters.to };
}

export function formatReportDateInput(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseReportDate(value: string | undefined, fieldName: string): Date {
  if (!value) {
    throw new AppError(
      400,
      "REPORT_DATE_REQUIRED",
      `Custom reports require a ${fieldName} date.`,
    );
  }
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(
      400,
      "REPORT_DATE_INVALID",
      `${fieldName} date is invalid.`,
    );
  }
  return parsed;
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}
