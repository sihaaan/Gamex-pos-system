export function compactFinancialYear(date: Date): string {
  const month = date.getMonth() + 1;
  const startYear = month >= 4 ? date.getFullYear() : date.getFullYear() - 1;
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}${String(endYear).slice(-2)}`;
}

export function formatInvoiceNumber(params: {
  prefix: string;
  nextNumber: number;
  width?: number;
}): string {
  const width = params.width ?? 6;
  if (!/^[A-Za-z0-9/-]+$/.test(params.prefix)) {
    throw new Error("Invoice series prefix contains unsupported characters.");
  }

  const invoiceNumber = `${params.prefix}${params.nextNumber
    .toString()
    .padStart(width, "0")}`;

  if (invoiceNumber.length > 16) {
    throw new Error("GST invoice number exceeds the 16 character limit.");
  }

  return invoiceNumber;
}
