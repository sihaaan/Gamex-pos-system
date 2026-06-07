export type JournalSide = "DEBIT" | "CREDIT";

export type JournalLineDraft = {
  accountCode: string;
  side: JournalSide;
  amount: number;
  memo?: string;
};

export function assertBalancedJournal(lines: readonly JournalLineDraft[]): void {
  const debitTotal = lines
    .filter((line) => line.side === "DEBIT")
    .reduce((total, line) => total + line.amount, 0);
  const creditTotal = lines
    .filter((line) => line.side === "CREDIT")
    .reduce((total, line) => total + line.amount, 0);

  if (debitTotal !== creditTotal) {
    throw new Error(
      `Journal entry is not balanced. Debit ${debitTotal}, credit ${creditTotal}.`,
    );
  }
}

export function checkoutJournalLines(params: {
  totalAmount: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
}): JournalLineDraft[] {
  const lines: JournalLineDraft[] = [
    {
      accountCode: "1000",
      side: "DEBIT",
      amount: params.totalAmount,
      memo: "Payment received",
    },
    {
      accountCode: "4000",
      side: "CREDIT",
      amount: params.taxableValue,
      memo: "POS sales revenue",
    },
  ];

  if (params.cgstAmount > 0) {
    lines.push({
      accountCode: "2100",
      side: "CREDIT",
      amount: params.cgstAmount,
      memo: "CGST payable",
    });
  }

  if (params.sgstAmount > 0) {
    lines.push({
      accountCode: "2110",
      side: "CREDIT",
      amount: params.sgstAmount,
      memo: "SGST payable",
    });
  }

  if (params.igstAmount > 0) {
    lines.push({
      accountCode: "2120",
      side: "CREDIT",
      amount: params.igstAmount,
      memo: "IGST payable",
    });
  }

  assertBalancedJournal(lines);
  return lines;
}

export function refundJournalLines(params: {
  totalAmount: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
}): JournalLineDraft[] {
  const lines: JournalLineDraft[] = [
    {
      accountCode: "4000",
      side: "DEBIT",
      amount: params.taxableValue,
      memo: "Sales reversal",
    },
    {
      accountCode: "1000",
      side: "CREDIT",
      amount: params.totalAmount,
      memo: "Refund paid",
    },
  ];

  if (params.cgstAmount > 0) {
    lines.push({
      accountCode: "2100",
      side: "DEBIT",
      amount: params.cgstAmount,
      memo: "CGST reversal",
    });
  }

  if (params.sgstAmount > 0) {
    lines.push({
      accountCode: "2110",
      side: "DEBIT",
      amount: params.sgstAmount,
      memo: "SGST reversal",
    });
  }

  if (params.igstAmount > 0) {
    lines.push({
      accountCode: "2120",
      side: "DEBIT",
      amount: params.igstAmount,
      memo: "IGST reversal",
    });
  }

  assertBalancedJournal(lines);
  return lines;
}
