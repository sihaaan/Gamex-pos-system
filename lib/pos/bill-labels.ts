type BillLike = {
  customerLabel: string | null;
  customerName: string | null;
};

export function nextWalkInBillLabel(openBills: readonly BillLike[]): string {
  const nextNumber =
    openBills.reduce((max, bill) => {
      const label = bill.customerLabel ?? bill.customerName ?? "";
      const match = /^Walk-in\s+(\d{1,3})$/i.exec(label.trim());
      if (!match) {
        return max;
      }
      return Math.max(max, Number(match[1]));
    }, 0) + 1;

  return `Walk-in ${String(nextNumber).padStart(3, "0")}`;
}

export function resourceStartBillLabel(
  resourceName: string,
  openBills: readonly BillLike[],
): string {
  const baseLabel = `${resourceName.trim() || "Walk-in"} bill`;
  return uniqueBillLabel(baseLabel, openBills);
}

function uniqueBillLabel(baseLabel: string, openBills: readonly BillLike[]): string {
  const existingLabels = new Set(
    openBills
      .map((bill) => bill.customerLabel ?? bill.customerName ?? "")
      .map((label) => label.trim().toLowerCase())
      .filter(Boolean),
  );

  if (!existingLabels.has(baseLabel.toLowerCase())) {
    return baseLabel;
  }

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${baseLabel} ${suffix}`;
    if (!existingLabels.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  return nextWalkInBillLabel(openBills);
}
