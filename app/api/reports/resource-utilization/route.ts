import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { actualElapsedMinutesFromEvents } from "@/lib/reports/aggregations";
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
          lineKind: "SERVICE",
          gstInvoice: {
            status: "POSTED",
            postedAt: dateRangeWhere(filters),
          },
          ...branchScopedWhere(filters),
        },
        include: {
          branch: { select: { name: true, code: true } },
          gstInvoice: { select: { invoiceNumber: true, postedAt: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 500,
      }),
    ]);
    const timedLineIds = lines
      .map((line) => line.sourceLineId)
      .filter((id): id is string => Boolean(id));
    const [timedLines, events] =
      timedLineIds.length > 0
        ? await Promise.all([
            prisma.tabTimedLine.findMany({
              where: { id: { in: timedLineIds }, legalEntityId: auth.legalEntityId },
              include: { resource: { select: { id: true, name: true, kind: true } } },
            }),
            prisma.serviceSessionEvent.findMany({
              where: {
                legalEntityId: auth.legalEntityId,
                tabTimedLineId: { in: timedLineIds },
              },
              select: {
                tabTimedLineId: true,
                eventType: true,
                occurredAt: true,
              },
              orderBy: { occurredAt: "asc" },
            }),
          ])
        : [[], []] as const;
    const timedLineById = new Map(timedLines.map((line) => [line.id, line]));
    const eventsByTimedLineId = new Map<
      string,
      Array<{ eventType: string; occurredAt: Date }>
    >();
    for (const event of events) {
      const list = eventsByTimedLineId.get(event.tabTimedLineId) ?? [];
      list.push({ eventType: event.eventType, occurredAt: event.occurredAt });
      eventsByTimedLineId.set(event.tabTimedLineId, list);
    }

    const rowsByKey = new Map<
      string,
      {
        branchName: string;
        branchCode: string;
        resourceName: string;
        resourceType: string;
        sessionCount: number;
        totalBillableMinutes: number;
        totalActualElapsedMinutes: number;
        revenue: number;
        averageSessionDuration: number;
      }
    >();
    for (const line of lines) {
      const timedLine = line.sourceLineId ? timedLineById.get(line.sourceLineId) : null;
      const key =
        timedLine?.resource?.id ??
        `${line.branchId}:${resourceKindFromDescription(line.description)}:${line.description}`;
      const row =
        rowsByKey.get(key) ??
        {
          branchName: line.branch.name,
          branchCode: line.branch.code,
          resourceName: timedLine?.resource?.name ?? line.description,
          resourceType:
            timedLine?.resource?.kind ?? resourceKindFromDescription(line.description),
          sessionCount: 0,
          totalBillableMinutes: 0,
          totalActualElapsedMinutes: 0,
          revenue: 0,
          averageSessionDuration: 0,
        };
      row.sessionCount += 1;
      row.totalBillableMinutes += line.billableMinutes ?? 0;
      row.totalActualElapsedMinutes += line.sourceLineId
        ? actualElapsedMinutesFromEvents(eventsByTimedLineId.get(line.sourceLineId) ?? [])
        : 0;
      row.revenue += line.totalAmount;
      row.averageSessionDuration =
        row.sessionCount > 0
          ? Math.round(row.totalBillableMinutes / row.sessionCount)
          : 0;
      rowsByKey.set(key, row);
    }
    const rows = Array.from(rowsByKey.values()).sort(
      (left, right) => right.revenue - left.revenue,
    );

    if (filters.format === "csv") {
      return csvResponse(
        "resource-utilization.csv",
        buildCsv(
          [
            "Resource",
            "Type",
            "Branch",
            "Sessions",
            "Billable Minutes",
            "Actual Elapsed Minutes",
            "Revenue",
            "Average Session Minutes",
          ],
          rows.map((row) => [
            row.resourceName,
            row.resourceType,
            `${row.branchName} (${row.branchCode})`,
            row.sessionCount,
            row.totalBillableMinutes,
            row.totalActualElapsedMinutes,
            formatCsvAmount(row.revenue),
            row.averageSessionDuration,
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

function resourceKindFromDescription(description: string): string {
  const normalized = description.toLowerCase();
  if (normalized.includes("pool")) {
    return "POOL_TABLE";
  }
  if (normalized.includes("ps5") || normalized.includes("console")) {
    return "CONSOLE";
  }
  return "SERVICE";
}
