import { describe, expect, it } from "vitest";
import { buildInvoiceDraft } from "@/lib/billing/checkout";
import { checkoutJournalLines } from "@/lib/journal/entries";

describe("start stop checkout flow", () => {
  it("charges pool plus console plus retail on one tab", () => {
    const invoice = buildInvoiceDraft({
      invoiceSeriesSnapshot: "GXA012526",
      intraState: true,
      timedLines: [
        {
          id: "pool-line",
          description: "Pool table timed play",
          hsnSac: "9996",
          gstRatePercent: 18,
          ratePerMinute: 500,
          minimumBillableMinutes: 10,
          roundUpToMinutes: 5,
          events: [
            {
              eventType: "STARTED",
              occurredAt: new Date("2026-06-07T10:00:00Z"),
            },
            {
              eventType: "STOPPED",
              occurredAt: new Date("2026-06-07T10:40:00Z"),
            },
          ],
        },
        {
          id: "ps5-line",
          description: "PS5 console timed play",
          hsnSac: "9996",
          gstRatePercent: 18,
          ratePerMinute: 500,
          minimumBillableMinutes: 10,
          roundUpToMinutes: 5,
          events: [
            {
              eventType: "STARTED",
              occurredAt: new Date("2026-06-07T10:40:00Z"),
            },
            {
              eventType: "STOPPED",
              occurredAt: new Date("2026-06-07T11:40:00Z"),
            },
          ],
        },
      ],
      retailLines: [
        {
          id: "drink-line",
          description: "Cold drink",
          hsnSac: "2202",
          gstRatePercent: 18,
          unitPrice: 6000,
          quantity: 2,
        },
      ],
    });

    expect(invoice.lines[0].billableMinutes).toBe(40);
    expect(invoice.lines[1].billableMinutes).toBe(60);
    expect(invoice.totalAmount).toBe(62000);
    expect(() =>
      checkoutJournalLines({
        totalAmount: invoice.totalAmount,
        taxableValue: invoice.taxableValue,
        cgstAmount: invoice.cgstAmount,
        sgstAmount: invoice.sgstAmount,
        igstAmount: invoice.igstAmount,
      }),
    ).not.toThrow();
  });
});
