import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { refundJournalLines } from "@/lib/journal/entries";
import { formatInvoiceNumber } from "@/lib/gst/invoice-number";
import { splitInclusiveGst, sumGstBreakups } from "@/lib/gst/tax";
import { AppError, errorResponse, parseJson } from "@/lib/http";
import {
  requireManagerOverride,
  requirePermission,
} from "@/lib/permissions/policy";
import { assertLegalEntityScope } from "@/lib/permissions/tenant";
import { prisma } from "@/lib/prisma";
import { requireActiveOperatorShift } from "@/lib/shifts/active-shift";
import { refundSchema } from "@/lib/validation/common";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    requirePermission(auth.role, "refund:create");
    requireManagerOverride(auth.role, "REFUND");
    const input = await parseJson(request, refundSchema);

    const invoice = await prisma.gstInvoice.findFirst({
      where: { id: input.gstInvoiceId, legalEntityId: auth.legalEntityId },
      include: {
        lines: true,
        creditNotes: true,
        invoiceSeries: true,
      },
    });
    assertLegalEntityScope(auth.legalEntityId, invoice);

    if (invoice.status !== "POSTED") {
      throw new AppError(
        409,
        "INVOICE_NOT_POSTED",
        "Only posted invoices can be refunded.",
      );
    }

    const alreadyRefunded = invoice.creditNotes.reduce(
      (total, creditNote) => total + creditNote.totalAmount,
      0,
    );
    if (input.amount <= 0 || input.amount > invoice.totalAmount - alreadyRefunded) {
      throw new AppError(
        400,
        "INVALID_REFUND_AMOUNT",
        "Refund amount exceeds the remaining refundable invoice balance.",
      );
    }

    const activeShift = await requireActiveOperatorShift({
      auth,
      branchId: invoice.branchId,
    });

    const allocations = allocateAmount(
      invoice.lines.map((line) => line.totalAmount),
      input.amount,
    );
    const creditNoteLines = invoice.lines
      .map((line, index) => {
        const totalAmount = allocations[index];
        if (totalAmount === 0) {
          return null;
        }
        const gst = splitInclusiveGst({
          grossAmount: totalAmount,
          gstRatePercent: Number(line.gstRate),
          intraState: invoice.igstAmount === 0,
        });
        return {
          originalLineId: line.id,
          description: line.description,
          hsnSac: line.hsnSac,
          gstRate: Number(line.gstRate),
          taxableValue: gst.taxableValue,
          cgstAmount: gst.cgstAmount,
          sgstAmount: gst.sgstAmount,
          igstAmount: gst.igstAmount,
          totalAmount: gst.totalAmount,
        };
      })
      .filter((line) => line !== null);

    const totals = sumGstBreakups(creditNoteLines);

    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${invoice.invoiceSeriesId}))`;
      const series = await tx.invoiceSeries.findUniqueOrThrow({
        where: { id: invoice.invoiceSeriesId },
      });
      const creditNoteNumber = formatInvoiceNumber({
        prefix: `CN${series.prefix}`.slice(0, 10),
        nextNumber: series.nextNumber,
      });

      const creditNote = await tx.creditNote.create({
        data: {
          legalEntityId: auth.legalEntityId,
          branchId: invoice.branchId,
          operatorShiftId: activeShift.id,
          tabId: invoice.tabId,
          gstInvoiceId: invoice.id,
          invoiceSeriesId: series.id,
          creditNoteNumber,
          reason: input.reason,
          taxableValue: totals.taxableValue,
          cgstAmount: totals.cgstAmount,
          sgstAmount: totals.sgstAmount,
          igstAmount: totals.igstAmount,
          totalAmount: totals.totalAmount,
          lines: {
            create: creditNoteLines.map((line) => ({
              legalEntityId: auth.legalEntityId,
              branchId: invoice.branchId,
              originalLineId: line.originalLineId,
              description: line.description,
              hsnSac: line.hsnSac,
              gstRate: line.gstRate,
              taxableValue: line.taxableValue,
              cgstAmount: line.cgstAmount,
              sgstAmount: line.sgstAmount,
              igstAmount: line.igstAmount,
              totalAmount: line.totalAmount,
            })),
          },
        },
        include: { lines: true },
      });

      await tx.invoiceSeries.update({
        where: { id: series.id },
        data: { nextNumber: { increment: 1 } },
      });

      await tx.refundPayment.create({
        data: {
          legalEntityId: auth.legalEntityId,
          branchId: invoice.branchId,
          operatorShiftId: activeShift.id,
          creditNoteId: creditNote.id,
          tenderType: input.tenderType,
          amount: input.amount,
          reference: input.reference,
        },
      });

      const journalDraft = refundJournalLines({
        totalAmount: totals.totalAmount,
        taxableValue: totals.taxableValue,
        cgstAmount: totals.cgstAmount,
        sgstAmount: totals.sgstAmount,
        igstAmount: totals.igstAmount,
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
          branchId: invoice.branchId,
          source: "REFUND",
          sourceId: creditNote.id,
          memo: `Refund ${creditNoteNumber}`,
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

      await tx.auditLog.create({
        data: {
          legalEntityId: auth.legalEntityId,
          branchId: invoice.branchId,
          operatorShiftId: activeShift.id,
          actorUserId: auth.userId,
          action: "REFUND",
          targetType: "credit_note",
          targetId: creditNote.id,
          afterJson: {
            creditNoteNumber,
            amount: input.amount,
            invoiceNumber: invoice.invoiceNumber,
          },
          reason: input.reason,
        },
      });

      return { creditNote };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

function allocateAmount(baseAmounts: readonly number[], amount: number): number[] {
  const baseTotal = baseAmounts.reduce((total, value) => total + value, 0);
  if (baseTotal <= 0) {
    return baseAmounts.map(() => 0);
  }

  const allocations = baseAmounts.map((baseAmount) =>
    Math.floor((amount * baseAmount) / baseTotal),
  );
  let remainder = amount - allocations.reduce((total, value) => total + value, 0);

  for (let index = 0; index < allocations.length && remainder > 0; index += 1) {
    allocations[index] += 1;
    remainder -= 1;
  }

  return allocations;
}
