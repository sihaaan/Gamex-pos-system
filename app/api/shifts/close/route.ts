import { NextResponse } from "next/server";
import { requestFingerprint, requireAuth } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/log";
import { errorResponse, parseJson } from "@/lib/http";
import { requirePermission } from "@/lib/permissions/policy";
import { assertBranchScope, assertLegalEntityScope } from "@/lib/permissions/tenant";
import { prisma } from "@/lib/prisma";
import { buildShiftCloseSummary } from "@/lib/shifts/summary";
import { closeShiftSchema } from "@/lib/validation/common";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    requirePermission(auth.role, "shift:close");
    const input = await parseJson(request, closeShiftSchema);

    const shift = await prisma.operatorShift.findFirst({
      where: {
        id: input.operatorShiftId,
        legalEntityId: auth.legalEntityId,
        staffUserId: auth.role === "STAFF" ? auth.userId : undefined,
      },
      select: {
        id: true,
        legalEntityId: true,
        branchId: true,
        status: true,
        cashOpeningFloat: true,
      },
    });
    assertLegalEntityScope(auth.legalEntityId, shift);
    assertBranchScope(auth, shift);

    if (shift.status !== "OPEN" && shift.status !== "REOPENED") {
      return NextResponse.json(
        {
          error: {
            code: "SHIFT_NOT_OPEN",
            message: "Only an open or reopened shift can be closed.",
          },
        },
        { status: 409 },
      );
    }

    const [invoices, payments, refunds, voidedInvoices, activeTabCount, auditLogs] =
      await Promise.all([
        prisma.gstInvoice.findMany({
          where: {
            legalEntityId: auth.legalEntityId,
            operatorShiftId: shift.id,
            status: "POSTED",
          },
          include: { payments: true },
        }),
        prisma.payment.findMany({
          where: {
            legalEntityId: auth.legalEntityId,
            operatorShiftId: shift.id,
          },
          select: { tenderType: true, amount: true },
        }),
        prisma.refundPayment.findMany({
          where: {
            legalEntityId: auth.legalEntityId,
            operatorShiftId: shift.id,
            status: "POSTED",
          },
          select: { amount: true },
        }),
        prisma.gstInvoice.findMany({
          where: {
            legalEntityId: auth.legalEntityId,
            operatorShiftId: shift.id,
            status: "VOIDED",
          },
          select: { totalAmount: true },
        }),
        prisma.tab.count({
          where: {
            legalEntityId: auth.legalEntityId,
            operatorShiftId: shift.id,
            status: { in: ["OPEN", "REOPENED"] },
          },
        }),
        prisma.auditLog.findMany({
          where: {
            legalEntityId: auth.legalEntityId,
            operatorShiftId: shift.id,
            action: {
              in: [
                "VOID_TAB",
                "VOID_INVOICE",
                "HIGH_DISCOUNT",
                "PRICE_OVERRIDE",
                "RETROACTIVE_SESSION_EDIT",
                "REFUND",
                "CREDIT_NOTE",
                "STOCK_ADJUSTMENT",
                "REOPEN_CLOSED_TAB",
                "REOPEN_OR_ADJUST_SHIFT",
              ],
            },
          },
          select: { action: true, targetType: true, targetId: true },
        }),
      ]);

    const summaryDraft = buildShiftCloseSummary({
      invoices: invoices.map((invoice) => ({
        totalAmount: invoice.totalAmount,
        discountAmount: invoice.discountAmount,
        cgstAmount: invoice.cgstAmount,
        sgstAmount: invoice.sgstAmount,
        igstAmount: invoice.igstAmount,
        paymentCount: invoice.payments.length,
      })),
      payments,
      refunds: refunds.reduce((total, refund) => total + refund.amount, 0),
      voidedAmount: voidedInvoices.reduce(
        (total, invoice) => total + invoice.totalAmount,
        0,
      ),
      activeTabCount,
      unusualActions: auditLogs.map(
        (log) => `${log.action} on ${log.targetType}:${log.targetId}`,
      ),
    });

    const summary = await prisma.$transaction(async (tx) => {
      const latest = await tx.shiftCloseSummary.findFirst({
        where: { operatorShiftId: shift.id },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      const createdSummary = await tx.shiftCloseSummary.create({
        data: {
          legalEntityId: auth.legalEntityId,
          branchId: shift.branchId,
          operatorShiftId: shift.id,
          version: (latest?.version ?? 0) + 1,
          grossSales: summaryDraft.grossSales,
          discounts: summaryDraft.discounts,
          refunds: summaryDraft.refunds,
          voidedAmount: summaryDraft.voidedAmount,
          netSales: summaryDraft.netSales,
          gstCollected: summaryDraft.gstCollected,
          cashTotal: summaryDraft.cashTotal,
          upiGooglePayTotal: summaryDraft.upiGooglePayTotal,
          upiPhonePeTotal: summaryDraft.upiPhonePeTotal,
          upiOtherTotal: summaryDraft.upiOtherTotal,
          cardRecordedTotal: summaryDraft.cardRecordedTotal,
          mixedTenderTotal: summaryDraft.mixedTenderTotal,
          activeTabCount: summaryDraft.activeTabCount,
          warnings: summaryDraft.warnings,
          unusualActions: summaryDraft.unusualActions,
        },
      });

      await tx.operatorShift.update({
        where: { id: shift.id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          cashCountedAmount: input.cashCountedAmount,
          notes: input.notes,
        },
      });

      return createdSummary;
    });

    const fingerprint = await requestFingerprint();
    await writeAuditLog({
      legalEntityId: auth.legalEntityId,
      branchId: shift.branchId,
      operatorShiftId: shift.id,
      actorUserId: auth.userId,
      action: "SHIFT_CLOSED",
      targetType: "operator_shift",
      targetId: shift.id,
      afterJson: summary,
      ...fingerprint,
    });

    return NextResponse.json({ summary });
  } catch (error) {
    return errorResponse(error);
  }
}
