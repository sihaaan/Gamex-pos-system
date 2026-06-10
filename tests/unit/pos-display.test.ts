import { describe, expect, it } from "vitest";
import {
  compactBillStats,
  staffBillStatus,
  staffInvoiceLineLabel,
  staffPaymentStatusLabel,
  staffServiceName,
} from "@/lib/pos/display";

describe("POS staff display helpers", () => {
  it("summarizes bill status without repeating accounting detail", () => {
    expect(
      compactBillStats({
        gameCount: 2,
        snackCount: 1,
        status: "Ready",
      }),
    ).toBe("2 games | 1 snack/drink | Ready");
  });

  it("uses cashier-friendly status labels", () => {
    expect(
      staffBillStatus({
        activeTimedLineCount: 1,
        timedLineCount: 2,
        paymentBalance: 5000,
        totalAmount: 5000,
      }),
    ).toBe("Running");

    expect(
      staffBillStatus({
        activeTimedLineCount: 0,
        timedLineCount: 1,
        paymentBalance: 5000,
        totalAmount: 5000,
      }),
    ).toBe("Stopped");

    expect(
      staffBillStatus({
        activeTimedLineCount: 0,
        timedLineCount: 1,
        paymentBalance: 0,
        totalAmount: 5000,
      }),
    ).toBe("Ready");
  });

  it("keeps staff line item labels compact", () => {
    expect(
      staffInvoiceLineLabel({
        lineKind: "SERVICE",
        description: "PS5 console timed play",
        billableMinutes: 60,
      }),
    ).toBe("PS5 play - 60 min");

    expect(
      staffInvoiceLineLabel({
        lineKind: "RETAIL",
        description: "Chips pack",
        quantity: 1,
      }),
    ).toBe("Chips pack x1");
  });

  it("uses one clear payment state", () => {
    const formatAmount = (amount: number) => `INR ${amount / 100}`;

    expect(
      staffPaymentStatusLabel({
        paymentTotal: 12500,
        paymentBalance: 0,
        hasActiveTimedLines: false,
        formatAmount,
      }),
    ).toBe("Payment matched INR 125");

    expect(
      staffPaymentStatusLabel({
        paymentTotal: 10000,
        paymentBalance: 2500,
        hasActiveTimedLines: false,
        formatAmount,
      }),
    ).toBe("Remaining INR 25");

    expect(
      staffPaymentStatusLabel({
        paymentTotal: 15000,
        paymentBalance: -500,
        hasActiveTimedLines: false,
        formatAmount,
      }),
    ).toBe("Overpaid INR 5");
  });

  it("keeps running game payments clearly provisional", () => {
    const formatAmount = (amount: number) => `INR ${amount / 100}`;

    expect(
      staffPaymentStatusLabel({
        paymentTotal: 12500,
        paymentBalance: 0,
        hasActiveTimedLines: true,
        formatAmount,
      }),
    ).toBe("Estimate only — stop games for final bill.");
  });

  it("hides timed service catalog wording from POS service names", () => {
    expect(staffServiceName("Pool table timed play")).toBe("Pool play");
    expect(staffServiceName("PS5 console timed play")).toBe("PS5 play");
  });
});
