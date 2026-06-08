import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { buildInvoiceDraft } from "@/lib/billing/checkout";
import { compactFinancialYear } from "@/lib/gst/invoice-number";
import { AppError, errorResponse } from "@/lib/http";
import { assertLegalEntityScope } from "@/lib/permissions/tenant";
import { prisma } from "@/lib/prisma";
import { cuidSchema, paiseSchema } from "@/lib/validation/common";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    const url = new URL(request.url);
    const tabId = cuidSchema.parse(url.searchParams.get("tabId"));
    const discountAmount = parseOptionalPaise(url.searchParams.get("discountAmount"));

    const tab = await prisma.tab.findFirst({
      where: { id: tabId, legalEntityId: auth.legalEntityId },
      include: {
        branch: true,
        legalEntity: true,
        timedLines: { include: { sessionEvents: true } },
        retailLines: true,
      },
    });
    assertLegalEntityScope(auth.legalEntityId, tab);

    if (tab.status !== "OPEN" && tab.status !== "REOPENED") {
      throw new AppError(409, "TAB_NOT_OPEN", "Only open tabs can be quoted.");
    }

    const now = new Date();
    const [invoiceSeries, automaticDiscountRules] = await Promise.all([
      prisma.invoiceSeries.findFirst({
        where: {
          legalEntityId: auth.legalEntityId,
          branchId: tab.branchId,
          financialYear: compactFinancialYear(now),
          isActive: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.discountRule.findMany({
        where: {
          legalEntityId: auth.legalEntityId,
          isActive: true,
          OR: [{ branchId: tab.branchId }, { branchId: null }],
          effectiveFrom: { lte: now },
          AND: [
            {
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
            },
          ],
        },
        orderBy: [{ discountPercent: "desc" }, { createdAt: "asc" }],
      }),
    ]);

    if (!invoiceSeries) {
      throw new AppError(
        409,
        "INVOICE_SERIES_MISSING",
        "No active invoice series is configured for this branch and financial year.",
      );
    }

    const draft = buildInvoiceDraft({
      timedLines: tab.timedLines
        .filter((line) => line.status !== "VOIDED")
        .map((line) => ({
          id: line.id,
          description: line.descriptionSnapshot,
          hsnSac: line.sacCodeSnapshot,
          gstRatePercent: Number(line.gstRateSnapshot),
          ratePerMinute: line.ratePerMinuteSnapshot,
          minimumBillableMinutes: line.minimumBillableMinutesSnapshot,
          roundUpToMinutes: line.roundUpToMinutesSnapshot,
          priceOverrideAmount: line.priceOverrideAmount,
          events: line.sessionEvents.map((event) => ({
            eventType: event.eventType,
            occurredAt: event.occurredAt,
            metadata:
              event.metadata &&
              typeof event.metadata === "object" &&
              !Array.isArray(event.metadata)
                ? {
                    billableSecondsDelta: readNumber(
                      event.metadata,
                      "billableSecondsDelta",
                    ),
                    billableMinutesDelta: readNumber(
                      event.metadata,
                      "billableMinutesDelta",
                    ),
                  }
                : undefined,
          })),
        })),
      retailLines: tab.retailLines
        .filter((line) => !line.voidedAt)
        .map((line) => ({
          id: line.id,
          description: line.descriptionSnapshot,
          hsnSac: line.hsnCodeSnapshot,
          gstRatePercent: Number(line.gstRateSnapshot),
          unitPrice: line.unitPriceSnapshot,
          quantity: line.quantity,
          discountAmount: line.discountAmount,
      })),
      automaticDiscountRules: automaticDiscountRules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        branchId: rule.branchId,
        discountPercent: rule.discountPercent,
        minimumBillableMinutes: rule.minimumBillableMinutes,
        daysOfWeek: rule.daysOfWeek,
        startMinuteOfDay: rule.startMinuteOfDay,
        endMinuteOfDay: rule.endMinuteOfDay,
        effectiveFrom: rule.effectiveFrom,
        effectiveTo: rule.effectiveTo,
      })),
      discountAmount,
      invoiceSeriesSnapshot: invoiceSeries.prefix,
      intraState: tab.branch.stateCode === tab.legalEntity.stateCode,
      now,
      branchTimeZone: tab.branch.timezone,
    });

    return NextResponse.json({
      quote: {
        ...draft,
        grossAmount: draft.grossAmount,
        managerDiscountLimitPercent: Number(
          process.env.MANAGER_DISCOUNT_LIMIT_PERCENT ?? "10",
        ),
        serverNow: now.toISOString(),
        hasActiveTimedLines: tab.timedLines.some(
          (line) => line.status === "RUNNING" || line.status === "PAUSED",
        ),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function parseOptionalPaise(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  return paiseSchema.parse(Number(value));
}

function readNumber(record: object, key: string): number | undefined {
  if (!Object.prototype.hasOwnProperty.call(record, key)) {
    return undefined;
  }
  const value = (record as Record<string, unknown>)[key];
  return typeof value === "number" ? value : undefined;
}
