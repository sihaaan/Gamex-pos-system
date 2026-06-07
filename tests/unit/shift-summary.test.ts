import { describe, expect, it } from "vitest";
import { buildShiftCloseSummary } from "@/lib/shifts/summary";

describe("shift close summary", () => {
  it("summarizes tenders, GST, refunds, voids, and active-tab warnings", () => {
    const summary = buildShiftCloseSummary({
      invoices: [
        {
          totalAmount: 11800,
          discountAmount: 200,
          cgstAmount: 900,
          sgstAmount: 900,
          igstAmount: 0,
          paymentCount: 2,
        },
      ],
      payments: [
        { tenderType: "UPI_PHONEPE", amount: 8000 },
        { tenderType: "CASH", amount: 3800 },
      ],
      refunds: 1000,
      voidedAmount: 500,
      activeTabCount: 1,
      unusualActions: ["HIGH_DISCOUNT on tab:abc"],
    });

    expect(summary.grossSales).toBe(12000);
    expect(summary.netSales).toBe(10300);
    expect(summary.gstCollected).toBe(1800);
    expect(summary.upiPhonePeTotal).toBe(8000);
    expect(summary.cashTotal).toBe(3800);
    expect(summary.mixedTenderTotal).toBe(11800);
    expect(summary.warnings[0]).toContain("active tab");
  });
});
