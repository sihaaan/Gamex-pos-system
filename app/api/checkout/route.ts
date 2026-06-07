import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { buildInvoiceDraft } from "@/lib/billing/checkout";
import { checkoutJournalLines } from "@/lib/journal/entries";
import { compactFinancialYear, formatInvoiceNumber } from "@/lib/gst/invoice-number";
import { AppError, errorResponse, parseJson } from "@/lib/http";
import {
  requireManagerOverride,
  requirePermission,
} from "@/lib/permissions/policy";
import { assertLegalEntityScope } from "@/lib/permissions/tenant";
import { prisma } from "@/lib/prisma";
import { requireActiveOperatorShift } from "@/lib/shifts/active-shift";
import { checkoutSchema } from "@/lib/validation/common";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    requirePermission(auth.role, "tab:checkout");
    const input = await parseJson(request, checkoutSchema);

    const tab = await prisma.tab.findFirst({
      where: { id: input.tabId, legalEntityId: auth.legalEntityId },
      include: {
        branch: true,
        legalEntity: true,
        timedLines: { include: { sessionEvents: true } },
        retailLines: { include: { productCatalog: true } },
      },
    });
    assertLegalEntityScope(auth.legalEntityId, tab);

    if (tab.status !== "OPEN" && tab.status !== "REOPENED") {
      throw new AppError(409, "TAB_NOT_OPEN", "Only open tabs can be checked out.");
    }

    const activeShift = await requireActiveOperatorShift({
      auth,
      branchId: tab.branchId,
    });
    if (activeShift.id !== tab.operatorShiftId) {
      throw new AppError(
        409,
        "TAB_SHIFT_CLOSED",
        "This tab belongs to a different or closed operator shift.",
      );
    }

    const activeTimedLines = tab.timedLines.filter(
      (line) => line.status === "RUNNING" || line.status === "PAUSED",
    );
    if (activeTimedLines.length > 0) {
      throw new AppError(
        409,
        "TIMED_LINES_STILL_ACTIVE",
        "Stop all timed sessions before checkout.",
      );
    }

    const billableTimedLines = tab.timedLines.filter(
      (line) => line.status !== "VOIDED",
    );
    const billableRetailLines = tab.retailLines.filter((line) => !line.voidedAt);

    if (billableTimedLines.length === 0 && billableRetailLines.length === 0) {
      throw new AppError(409, "EMPTY_TAB", "Cannot checkout an empty tab.");
    }

    const now = new Date();
    const invoiceSeries = await prisma.invoiceSeries.findFirst({
      where: {
        legalEntityId: auth.legalEntityId,
        branchId: tab.branchId,
        financialYear: compactFinancialYear(now),
        isActive: true,
      },
      orderBy: { createdAt: "asc" },
    });

    if (!invoiceSeries) {
      throw new AppError(
        409,
        "INVOICE_SERIES_MISSING",
        "No active invoice series is configured for this branch and financial year.",
      );
    }

    const draft = buildInvoiceDraft({
      timedLines: billableTimedLines.map((line) => ({
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
      retailLines: billableRetailLines.map((line) => ({
        id: line.id,
        description: line.descriptionSnapshot,
        hsnSac: line.hsnCodeSnapshot,
        gstRatePercent: Number(line.gstRateSnapshot),
        unitPrice: line.unitPriceSnapshot,
        quantity: line.quantity,
        discountAmount: line.discountAmount,
      })),
      discountAmount: input.discountAmount,
      invoiceSeriesSnapshot: invoiceSeries.prefix,
      intraState: tab.branch.stateCode === tab.legalEntity.stateCode,
      now,
    });

    const paymentTotal = input.payments.reduce(
      (total, payment) => total + payment.amount,
      0,
    );
    if (paymentTotal !== draft.totalAmount) {
      throw new AppError(
        400,
        "PAYMENT_TOTAL_MISMATCH",
        "Payment total must exactly match the checkout total.",
      );
    }

    const discountLimitPercent = Number(
      process.env.MANAGER_DISCOUNT_LIMIT_PERCENT ?? "10",
    );
    const grossBeforeDiscount = draft.totalAmount + draft.discountAmount;
    if (
      draft.discountAmount > 0 &&
      grossBeforeDiscount > 0 &&
      (draft.discountAmount / grossBeforeDiscount) * 100 > discountLimitPercent
    ) {
      requireManagerOverride(auth.role, "HIGH_DISCOUNT");
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${invoiceSeries.id}))`;
      const lockedSeries = await tx.invoiceSeries.findUniqueOrThrow({
        where: { id: invoiceSeries.id },
      });
      const invoiceNumber = formatInvoiceNumber({
        prefix: lockedSeries.prefix,
        nextNumber: lockedSeries.nextNumber,
      });

      const invoice = await tx.gstInvoice.create({
        data: {
          legalEntityId: auth.legalEntityId,
          branchId: tab.branchId,
          operatorShiftId: activeShift.id,
          tabId: tab.id,
          invoiceSeriesId: lockedSeries.id,
          invoiceNumber,
          financialYear: lockedSeries.financialYear,
          legalEntityName: tab.legalEntity.name,
          legalEntityGstin: tab.legalEntity.gstin,
          legalEntityAddress: tab.legalEntity.address,
          branchName: tab.branch.name,
          branchAddress: tab.branch.address,
          customerName: tab.customerName,
          customerPhone: tab.customerPhone,
          customerGstin: tab.customerGstin,
          taxableValue: draft.taxableValue,
          cgstAmount: draft.cgstAmount,
          sgstAmount: draft.sgstAmount,
          igstAmount: draft.igstAmount,
          discountAmount: draft.discountAmount,
          totalAmount: draft.totalAmount,
          lines: {
            create: draft.lines.map((line) => ({
              legalEntityId: auth.legalEntityId,
              branchId: tab.branchId,
              lineKind: line.lineKind,
              sourceLineId: line.sourceLineId,
              description: line.description,
              hsnSac: line.hsnSac,
              gstRate: line.gstRatePercent,
              taxableValue: line.taxableValue,
              cgstAmount: line.cgstAmount,
              sgstAmount: line.sgstAmount,
              igstAmount: line.igstAmount,
              totalAmount: line.totalAmount,
              unitPrice: line.unitPrice,
              quantity: line.quantity,
              billableMinutes: line.billableMinutes,
              pricingRuleUsed: line.pricingRuleUsed,
              invoiceSeriesSnapshot: line.invoiceSeriesSnapshot,
            })),
          },
        },
        include: { lines: true },
      });

      await tx.invoiceSeries.update({
        where: { id: lockedSeries.id },
        data: { nextNumber: { increment: 1 } },
      });

      await tx.payment.createMany({
        data: input.payments.map((payment) => ({
          legalEntityId: auth.legalEntityId,
          branchId: tab.branchId,
          operatorShiftId: activeShift.id,
          tabId: tab.id,
          gstInvoiceId: invoice.id,
          tenderType: payment.tenderType,
          amount: payment.amount,
          reference: payment.reference,
        })),
      });

      for (const retailLine of billableRetailLines) {
        if (!retailLine.productCatalog.trackStock) {
          continue;
        }
        await tx.productCatalog.update({
          where: { id: retailLine.productCatalogId },
          data: { stockQuantity: { decrement: retailLine.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            legalEntityId: auth.legalEntityId,
            branchId: tab.branchId,
            operatorShiftId: activeShift.id,
            productCatalogId: retailLine.productCatalogId,
            movementType: "SALE",
            quantityDelta: -retailLine.quantity,
            reason: `Invoice ${invoiceNumber}`,
          },
        });
      }

      for (const timedLine of billableTimedLines) {
        await tx.serviceSessionEvent.create({
          data: {
            legalEntityId: auth.legalEntityId,
            branchId: tab.branchId,
            tabId: tab.id,
            tabTimedLineId: timedLine.id,
            resourceId: timedLine.resourceId,
            actorUserId: auth.userId,
            operatorShiftId: activeShift.id,
            eventType: "CLOSED",
            metadata: { invoiceId: invoice.id },
          },
        });
        await tx.tabTimedLine.update({
          where: { id: timedLine.id },
          data: { status: "CLOSED" },
        });
      }

      const journalDraft = checkoutJournalLines({
        totalAmount: draft.totalAmount,
        taxableValue: draft.taxableValue,
        cgstAmount: draft.cgstAmount,
        sgstAmount: draft.sgstAmount,
        igstAmount: draft.igstAmount,
      });
      const accounts = await tx.journalAccount.findMany({
        where: {
          legalEntityId: auth.legalEntityId,
          code: { in: journalDraft.map((line) => line.accountCode) },
        },
      });
      const accountIdByCode = new Map(
        accounts.map((account) => [account.code, account.id]),
      );

      await tx.journalEntry.create({
        data: {
          legalEntityId: auth.legalEntityId,
          branchId: tab.branchId,
          source: "CHECKOUT",
          sourceId: invoice.id,
          memo: `Checkout ${invoiceNumber}`,
          lines: {
            create: journalDraft.map((line) => {
              const accountId = accountIdByCode.get(line.accountCode);
              if (!accountId) {
                throw new AppError(
                  409,
                  "JOURNAL_ACCOUNT_MISSING",
                  `Journal account ${line.accountCode} is not configured.`,
                );
              }

              return {
                legalEntityId: auth.legalEntityId,
                accountId,
                side: line.side,
                amount: line.amount,
                memo: line.memo,
              };
            }),
          },
        },
      });

      await tx.tab.update({
        where: { id: tab.id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          discountAmount: draft.discountAmount,
          discountReason: input.discountReason,
        },
      });

      await tx.auditLog.create({
        data: {
          legalEntityId: auth.legalEntityId,
          branchId: tab.branchId,
          operatorShiftId: activeShift.id,
          actorUserId: auth.userId,
          action: "CHECKOUT_POSTED",
          targetType: "gst_invoice",
          targetId: invoice.id,
          afterJson: {
            invoiceNumber,
            totalAmount: invoice.totalAmount,
            paymentCount: input.payments.length,
          },
        },
      });

      return { invoice };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

function readNumber(record: object, key: string): number | undefined {
  if (!Object.prototype.hasOwnProperty.call(record, key)) {
    return undefined;
  }
  const value = (record as Record<string, unknown>)[key];
  return typeof value === "number" ? value : undefined;
}
