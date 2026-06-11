export type ReportInvoiceInput = {
  id: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  invoiceNumber: string;
  postedAt: Date;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  discountAmount: number;
  totalAmount: number;
};

export type ReportCreditNoteInput = {
  branchId: string;
  branchName: string;
  branchCode: string;
  status: string;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  postedAt: Date;
};

export type SalesSummary = {
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  gstCollected: number;
  invoiceCount: number;
  averageBillValue: number;
};

export type SalesBranchRow = {
  branchId: string;
  branchName: string;
  branchCode: string;
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  gstCollected: number;
  invoiceCount: number;
};

export type SalesDayRow = {
  date: string;
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  gstCollected: number;
  invoiceCount: number;
};

export type TenderPaymentInput = {
  tenderType: string;
  amount: number;
  gstInvoiceId: string | null;
};

export type HsnSacLineInput = {
  hsnSac: string;
  description: string;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
};

export type HsnSacSummaryRow = HsnSacLineInput & {
  totalGst: number;
  quantityOrMinutes: number;
};

export function buildSalesReport(params: {
  invoices: readonly ReportInvoiceInput[];
  creditNotes: readonly ReportCreditNoteInput[];
}): {
  summary: SalesSummary;
  byBranch: SalesBranchRow[];
  byDay: SalesDayRow[];
} {
  const postedCreditNotes = params.creditNotes.filter(
    (creditNote) => creditNote.status === "POSTED",
  );
  const invoiceTotal = params.invoices.reduce(
    (total, invoice) => total + invoice.totalAmount,
    0,
  );
  const discounts = params.invoices.reduce(
    (total, invoice) => total + invoice.discountAmount,
    0,
  );
  const refunds = postedCreditNotes.reduce(
    (total, creditNote) => total + creditNote.totalAmount,
    0,
  );
  const invoiceGst = params.invoices.reduce(
    (total, invoice) =>
      total + invoice.cgstAmount + invoice.sgstAmount + invoice.igstAmount,
    0,
  );
  const creditNoteGst = postedCreditNotes.reduce(
    (total, creditNote) =>
      total + creditNote.cgstAmount + creditNote.sgstAmount + creditNote.igstAmount,
    0,
  );
  const summary = {
    grossSales: invoiceTotal + discounts,
    discounts,
    refunds,
    netSales: invoiceTotal - refunds,
    gstCollected: invoiceGst - creditNoteGst,
    invoiceCount: params.invoices.length,
    averageBillValue:
      params.invoices.length > 0 ? Math.round(invoiceTotal / params.invoices.length) : 0,
  };

  return {
    summary,
    byBranch: Array.from(
      branchAccumulator(params.invoices, postedCreditNotes).values(),
    ).sort((left, right) => left.branchCode.localeCompare(right.branchCode)),
    byDay: Array.from(dayAccumulator(params.invoices, postedCreditNotes).values()).sort(
      (left, right) => left.date.localeCompare(right.date),
    ),
  };
}

export function buildTenderSummary(payments: readonly TenderPaymentInput[]): {
  totalsByTender: Record<string, number>;
  mixedTenderInvoiceCount: number;
} {
  const totalsByTender: Record<string, number> = {
    CASH: 0,
    UPI_GOOGLE_PAY: 0,
    UPI_PHONEPE: 0,
    UPI_OTHER: 0,
    CARD_RECORDED: 0,
  };
  const paymentCountByInvoice = new Map<string, number>();
  for (const payment of payments) {
    totalsByTender[payment.tenderType] =
      (totalsByTender[payment.tenderType] ?? 0) + payment.amount;
    if (payment.gstInvoiceId) {
      paymentCountByInvoice.set(
        payment.gstInvoiceId,
        (paymentCountByInvoice.get(payment.gstInvoiceId) ?? 0) + 1,
      );
    }
  }
  return {
    totalsByTender,
    mixedTenderInvoiceCount: Array.from(paymentCountByInvoice.values()).filter(
      (count) => count > 1,
    ).length,
  };
}

export function buildHsnSacSummary(
  lines: readonly (HsnSacLineInput & {
    quantity?: number | null;
    billableMinutes?: number | null;
  })[],
): HsnSacSummaryRow[] {
  const rows = new Map<string, HsnSacSummaryRow>();
  for (const line of lines) {
    const key = `${line.hsnSac}|${categoryFromDescription(line.description)}`;
    const current =
      rows.get(key) ??
      {
        hsnSac: line.hsnSac,
        description: categoryFromDescription(line.description),
        taxableValue: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        totalGst: 0,
        totalAmount: 0,
        quantityOrMinutes: 0,
      };
    current.taxableValue += line.taxableValue;
    current.cgstAmount += line.cgstAmount;
    current.sgstAmount += line.sgstAmount;
    current.igstAmount += line.igstAmount;
    current.totalGst += line.cgstAmount + line.sgstAmount + line.igstAmount;
    current.totalAmount += line.totalAmount;
    current.quantityOrMinutes += line.billableMinutes ?? line.quantity ?? 1;
    rows.set(key, current);
  }
  return Array.from(rows.values()).sort((left, right) =>
    left.hsnSac.localeCompare(right.hsnSac),
  );
}

export function actualElapsedMinutesFromEvents(
  events: readonly { eventType: string; occurredAt: Date }[],
): number {
  const sorted = [...events].sort(
    (left, right) => left.occurredAt.getTime() - right.occurredAt.getTime(),
  );
  let runningFrom: Date | null = null;
  let elapsedMs = 0;
  for (const event of sorted) {
    if (event.eventType === "STARTED" || event.eventType === "RESUMED") {
      runningFrom = event.occurredAt;
      continue;
    }
    if (
      runningFrom &&
      (event.eventType === "PAUSED" ||
        event.eventType === "STOPPED" ||
        event.eventType === "CLOSED")
    ) {
      elapsedMs += Math.max(0, event.occurredAt.getTime() - runningFrom.getTime());
      runningFrom = null;
    }
  }
  return Math.round(elapsedMs / 60_000);
}

function branchAccumulator(
  invoices: readonly ReportInvoiceInput[],
  creditNotes: readonly ReportCreditNoteInput[],
): Map<string, SalesBranchRow> {
  const rows = new Map<string, SalesBranchRow>();
  for (const invoice of invoices) {
    const row = getBranchRow(rows, invoice);
    row.grossSales += invoice.totalAmount + invoice.discountAmount;
    row.discounts += invoice.discountAmount;
    row.netSales += invoice.totalAmount;
    row.gstCollected += invoice.cgstAmount + invoice.sgstAmount + invoice.igstAmount;
    row.invoiceCount += 1;
  }
  for (const creditNote of creditNotes) {
    const row = getBranchRow(rows, creditNote);
    row.refunds += creditNote.totalAmount;
    row.netSales -= creditNote.totalAmount;
    row.gstCollected -=
      creditNote.cgstAmount + creditNote.sgstAmount + creditNote.igstAmount;
  }
  return rows;
}

function dayAccumulator(
  invoices: readonly ReportInvoiceInput[],
  creditNotes: readonly ReportCreditNoteInput[],
): Map<string, SalesDayRow> {
  const rows = new Map<string, SalesDayRow>();
  for (const invoice of invoices) {
    const date = reportDayKey(invoice.postedAt);
    const row = getDayRow(rows, date);
    row.grossSales += invoice.totalAmount + invoice.discountAmount;
    row.discounts += invoice.discountAmount;
    row.netSales += invoice.totalAmount;
    row.gstCollected += invoice.cgstAmount + invoice.sgstAmount + invoice.igstAmount;
    row.invoiceCount += 1;
  }
  for (const creditNote of creditNotes) {
    const date = reportDayKey(creditNote.postedAt);
    const row = getDayRow(rows, date);
    row.refunds += creditNote.totalAmount;
    row.netSales -= creditNote.totalAmount;
    row.gstCollected -=
      creditNote.cgstAmount + creditNote.sgstAmount + creditNote.igstAmount;
  }
  return rows;
}

function getBranchRow(
  rows: Map<string, SalesBranchRow>,
  item: {
    branchId: string;
    branchName: string;
    branchCode: string;
  },
): SalesBranchRow {
  const existing = rows.get(item.branchId);
  if (existing) {
    return existing;
  }
  const row: SalesBranchRow = {
    branchId: item.branchId,
    branchName: item.branchName,
    branchCode: item.branchCode,
    grossSales: 0,
    discounts: 0,
    refunds: 0,
    netSales: 0,
    gstCollected: 0,
    invoiceCount: 0,
  };
  rows.set(item.branchId, row);
  return row;
}

function getDayRow(rows: Map<string, SalesDayRow>, date: string): SalesDayRow {
  const existing = rows.get(date);
  if (existing) {
    return existing;
  }
  const row: SalesDayRow = {
    date,
    grossSales: 0,
    discounts: 0,
    refunds: 0,
    netSales: 0,
    gstCollected: 0,
    invoiceCount: 0,
  };
  rows.set(date, row);
  return row;
}

function reportDayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function categoryFromDescription(description: string): string {
  const normalized = description.toLowerCase();
  if (normalized.includes("pool")) {
    return "Pool play";
  }
  if (normalized.includes("ps5") || normalized.includes("console")) {
    return "PS5 play";
  }
  return description;
}
