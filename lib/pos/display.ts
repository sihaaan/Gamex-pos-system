export type StaffBillStatus = "Running" | "Stopped" | "Ready";

export type StaffInvoiceLineDisplay = {
  lineKind: string;
  description: string;
  quantity?: number | null;
  billableMinutes?: number | null;
};

export function staffBillStatus(params: {
  activeTimedLineCount: number;
  timedLineCount: number;
  paymentBalance: number;
  totalAmount: number;
}): StaffBillStatus {
  if (params.activeTimedLineCount > 0) {
    return "Running";
  }

  if (params.totalAmount > 0 && params.paymentBalance === 0) {
    return "Ready";
  }

  return params.timedLineCount > 0 ? "Stopped" : "Ready";
}

export function compactBillStats(params: {
  gameCount: number;
  snackCount: number;
  status: StaffBillStatus;
}): string {
  return `${params.gameCount} ${pluralize("game", params.gameCount)} | ${params.snackCount} ${pluralize("snack/drink", params.snackCount)} | ${params.status}`;
}

export function staffInvoiceLineLabel(line: StaffInvoiceLineDisplay): string {
  if (line.lineKind === "SERVICE") {
    const serviceName = staffServiceName(line.description);
    const minutes = line.billableMinutes ?? 0;
    return minutes > 0 ? `${serviceName} - ${minutes} min` : serviceName;
  }

  return `${line.description} x${line.quantity ?? 1}`;
}

export function staffServiceName(description: string): string {
  const normalized = description.toLowerCase();
  if (normalized.includes("pool")) {
    return "Pool play";
  }
  if (normalized.includes("ps5") || normalized.includes("console")) {
    return "PS5 play";
  }
  return description;
}

function pluralize(label: string, count: number): string {
  return count === 1 ? label : `${label}s`;
}
