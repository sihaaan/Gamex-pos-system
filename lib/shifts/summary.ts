export type TenderTypeName =
  | "CASH"
  | "UPI_GOOGLE_PAY"
  | "UPI_PHONEPE"
  | "UPI_OTHER"
  | "CARD_RECORDED";

export type ShiftInvoiceSummaryInput = {
  totalAmount: number;
  discountAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  paymentCount: number;
};

export type ShiftPaymentSummaryInput = {
  tenderType: TenderTypeName;
  amount: number;
};

export type ShiftCloseSummaryDraft = {
  grossSales: number;
  discounts: number;
  refunds: number;
  voidedAmount: number;
  netSales: number;
  gstCollected: number;
  cashTotal: number;
  upiGooglePayTotal: number;
  upiPhonePeTotal: number;
  upiOtherTotal: number;
  cardRecordedTotal: number;
  mixedTenderTotal: number;
  activeTabCount: number;
  warnings: string[];
  unusualActions: string[];
};

export function buildShiftCloseSummary(params: {
  invoices: readonly ShiftInvoiceSummaryInput[];
  payments: readonly ShiftPaymentSummaryInput[];
  refunds: number;
  voidedAmount: number;
  activeTabCount: number;
  unusualActions: readonly string[];
}): ShiftCloseSummaryDraft {
  const grossSales = params.invoices.reduce(
    (total, invoice) => total + invoice.totalAmount + invoice.discountAmount,
    0,
  );
  const discounts = params.invoices.reduce(
    (total, invoice) => total + invoice.discountAmount,
    0,
  );
  const gstCollected = params.invoices.reduce(
    (total, invoice) =>
      total + invoice.cgstAmount + invoice.sgstAmount + invoice.igstAmount,
    0,
  );
  const tenderTotals = tenderTotalMap(params.payments);
  const mixedTenderTotal = params.invoices
    .filter((invoice) => invoice.paymentCount > 1)
    .reduce((total, invoice) => total + invoice.totalAmount, 0);
  const warnings =
    params.activeTabCount > 0
      ? [`${params.activeTabCount} active tab(s) are still unclosed.`]
      : [];

  return {
    grossSales,
    discounts,
    refunds: params.refunds,
    voidedAmount: params.voidedAmount,
    netSales: grossSales - discounts - params.refunds - params.voidedAmount,
    gstCollected,
    cashTotal: tenderTotals.CASH,
    upiGooglePayTotal: tenderTotals.UPI_GOOGLE_PAY,
    upiPhonePeTotal: tenderTotals.UPI_PHONEPE,
    upiOtherTotal: tenderTotals.UPI_OTHER,
    cardRecordedTotal: tenderTotals.CARD_RECORDED,
    mixedTenderTotal,
    activeTabCount: params.activeTabCount,
    warnings,
    unusualActions: [...params.unusualActions],
  };
}

function tenderTotalMap(
  payments: readonly ShiftPaymentSummaryInput[],
): Record<TenderTypeName, number> {
  const totals: Record<TenderTypeName, number> = {
    CASH: 0,
    UPI_GOOGLE_PAY: 0,
    UPI_PHONEPE: 0,
    UPI_OTHER: 0,
    CARD_RECORDED: 0,
  };

  for (const payment of payments) {
    totals[payment.tenderType] += payment.amount;
  }

  return totals;
}
