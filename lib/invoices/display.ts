import { formatPaise } from "@/lib/utils";

export type InvoiceDisplayLine = {
  lineKind: string;
  description: string;
  quantity?: number | null;
  billableMinutes?: number | null;
  pricingRuleUsed?: string;
};

export type SnapshotTotalsInput = {
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  discountAmount: number;
  totalAmount: number;
};

export type PaymentDisplayInput = {
  tenderType: string;
  amount: number;
  reference?: string | null;
};

export type CreditNoteDisplayInput = {
  status: string;
  totalAmount: number;
};

export type InvoiceRefundDisplayStatus =
  | "Paid"
  | "Partially refunded"
  | "Refunded"
  | "Credit note issued"
  | "Voided";

export function customerInvoiceLineLabel(line: InvoiceDisplayLine): string {
  if (line.lineKind === "SERVICE") {
    const serviceName = customerServiceName(line.description);
    const minutes = line.billableMinutes ?? 0;
    return minutes > 0 ? `${serviceName} - ${minutes} min` : serviceName;
  }

  return `${line.description} x${line.quantity ?? 1}`;
}

export function customerServiceName(description: string): string {
  const normalized = description.toLowerCase();
  if (normalized.includes("pool")) {
    return "Pool play";
  }
  if (normalized.includes("ps5") || normalized.includes("console")) {
    return "PS5 play";
  }
  return description;
}

export function tenderLabel(tenderType: string): string {
  switch (tenderType) {
    case "CASH":
      return "Cash";
    case "UPI_GOOGLE_PAY":
      return "UPI - Google Pay";
    case "UPI_PHONEPE":
      return "UPI - PhonePe";
    case "UPI_OTHER":
      return "UPI - Other";
    case "CARD_RECORDED":
      return "Card recorded";
    default:
      return tenderType;
  }
}

export function paymentDisplayText(payment: PaymentDisplayInput): string {
  const reference = payment.reference ? ` (${payment.reference})` : "";
  return `${tenderLabel(payment.tenderType)}${reference} ${formatPaise(payment.amount)}`;
}

export function formatInvoicePercent(value: unknown): string {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "0%";
  }
  return `${numericValue.toFixed(Number.isInteger(numericValue) ? 0 : 2)}%`;
}

export function formatInvoiceDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

export function invoiceRefundStatus(params: {
  invoiceStatus: string;
  invoiceTotal: number;
  creditNotes: readonly CreditNoteDisplayInput[];
}): InvoiceRefundDisplayStatus {
  if (params.invoiceStatus === "VOIDED") {
    return "Voided";
  }

  const postedCreditNotes = params.creditNotes.filter(
    (creditNote) => creditNote.status === "POSTED",
  );
  if (postedCreditNotes.length === 0) {
    return "Paid";
  }

  const creditedTotal = postedCreditNotes.reduce(
    (total, creditNote) => total + creditNote.totalAmount,
    0,
  );
  if (creditedTotal <= 0) {
    return "Credit note issued";
  }
  if (creditedTotal >= params.invoiceTotal) {
    return "Refunded";
  }
  return "Partially refunded";
}

export function invoiceSnapshotTotals(
  invoice: SnapshotTotalsInput,
): SnapshotTotalsInput & { gstTotal: number } {
  // Customer displays must use immutable posted invoice snapshots, not current catalog or pricing rules.
  return {
    taxableValue: invoice.taxableValue,
    cgstAmount: invoice.cgstAmount,
    sgstAmount: invoice.sgstAmount,
    igstAmount: invoice.igstAmount,
    discountAmount: invoice.discountAmount,
    totalAmount: invoice.totalAmount,
    gstTotal: invoice.cgstAmount + invoice.sgstAmount + invoice.igstAmount,
  };
}
