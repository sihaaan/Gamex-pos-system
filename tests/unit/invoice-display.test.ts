import { describe, expect, it } from "vitest";
import {
  customerInvoiceLineLabel,
  invoiceRefundStatus,
  invoiceSnapshotTotals,
  paymentDisplayText,
  tenderLabel,
} from "@/lib/invoices/display";

describe("customer invoice display", () => {
  it("uses customer-friendly line labels and hides internal pricing rule codes", () => {
    const label = customerInvoiceLineLabel({
      lineKind: "SERVICE",
      description: "Pool table timed play",
      billableMinutes: 10,
      pricingRuleUsed: "MIN_10_ROUND_5_RATE_500",
    });

    expect(label).toBe("Pool play - 10 min");
    expect(label).not.toContain("MIN_10_ROUND_5_RATE_500");
  });

  it("labels PS5 play and retail quantities cleanly", () => {
    expect(
      customerInvoiceLineLabel({
        lineKind: "SERVICE",
        description: "PS5 console timed play",
        billableMinutes: 60,
      }),
    ).toBe("PS5 play - 60 min");
    expect(
      customerInvoiceLineLabel({
        lineKind: "RETAIL",
        description: "Chips pack",
        quantity: 1,
      }),
    ).toBe("Chips pack x1");
  });

  it("formats mixed tender payments with customer-facing names", () => {
    expect(tenderLabel("UPI_PHONEPE")).toBe("UPI - PhonePe");
    expect(tenderLabel("UPI_GOOGLE_PAY")).toBe("UPI - Google Pay");
    expect(
      paymentDisplayText({
        tenderType: "CASH",
        amount: 5000,
      }),
    ).toBe("Cash ₹50.00");
    expect(
      paymentDisplayText({
        tenderType: "UPI_PHONEPE",
        amount: 8000,
        reference: "TXN123",
      }),
    ).toBe("UPI - PhonePe (TXN123) ₹80.00");
  });

  it("uses stored invoice snapshot totals instead of recalculating catalog values", () => {
    const totals = invoiceSnapshotTotals({
      taxableValue: 11_017,
      cgstAmount: 991,
      sgstAmount: 992,
      igstAmount: 0,
      discountAmount: 1_000,
      totalAmount: 13_000,
    });

    expect(totals.taxableValue).toBe(11_017);
    expect(totals.cgstAmount).toBe(991);
    expect(totals.sgstAmount).toBe(992);
    expect(totals.discountAmount).toBe(1_000);
    expect(totals.totalAmount).toBe(13_000);
    expect(totals.gstTotal).toBe(1_983);
  });

  it("shows paid, partial refund, full refund, and credit note statuses", () => {
    expect(
      invoiceRefundStatus({
        invoiceStatus: "POSTED",
        invoiceTotal: 10_000,
        creditNotes: [],
      }),
    ).toBe("Paid");
    expect(
      invoiceRefundStatus({
        invoiceStatus: "POSTED",
        invoiceTotal: 10_000,
        creditNotes: [{ status: "POSTED", totalAmount: 3_000 }],
      }),
    ).toBe("Partially refunded");
    expect(
      invoiceRefundStatus({
        invoiceStatus: "POSTED",
        invoiceTotal: 10_000,
        creditNotes: [{ status: "POSTED", totalAmount: 10_000 }],
      }),
    ).toBe("Refunded");
    expect(
      invoiceRefundStatus({
        invoiceStatus: "POSTED",
        invoiceTotal: 10_000,
        creditNotes: [{ status: "POSTED", totalAmount: 0 }],
      }),
    ).toBe("Credit note issued");
  });
});
