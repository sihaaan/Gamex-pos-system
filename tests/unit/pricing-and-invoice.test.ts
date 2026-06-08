import { describe, expect, it } from "vitest";
import { buildInvoiceDraft } from "@/lib/billing/checkout";
import { priceTimedService } from "@/lib/billing/pricing";
import { splitInclusiveGst } from "@/lib/gst/tax";

describe("pricing and GST invoice draft", () => {
  it("rounds timed service minutes with minimums", () => {
    expect(
      priceTimedService({
        billableMinutes: 7,
        ratePerMinute: 500,
        minimumBillableMinutes: 10,
        roundUpToMinutes: 5,
      }),
    ).toMatchObject({ chargedMinutes: 10, grossAmount: 5000 });
  });

  it("splits inclusive GST for intra-state Karnataka sales", () => {
    expect(
      splitInclusiveGst({
        grossAmount: 11800,
        gstRatePercent: 18,
        intraState: true,
      }),
    ).toEqual({
      taxableValue: 10000,
      cgstAmount: 900,
      sgstAmount: 900,
      igstAmount: 0,
      totalAmount: 11800,
    });
  });

  it("builds immutable invoice line snapshots from timed and retail lines", () => {
    const draft = buildInvoiceDraft({
      invoiceSeriesSnapshot: "GXA012526",
      intraState: true,
      timedLines: [
        {
          id: "timed-1",
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
      ],
      retailLines: [
        {
          id: "retail-1",
          description: "Cold drink",
          hsnSac: "2202",
          gstRatePercent: 18,
          unitPrice: 6000,
          quantity: 1,
        },
      ],
    });

    expect(draft.totalAmount).toBe(26000);
    expect(draft.lines).toHaveLength(2);
    expect(draft.lines[0]).toMatchObject({
      description: "Pool table timed play",
      hsnSac: "9996",
      billableMinutes: 40,
      invoiceSeriesSnapshot: "GXA012526",
    });
  });

  it("documents line-level GST rounding for pool plus PS5 plus chips", () => {
    const draft = buildInvoiceDraft({
      invoiceSeriesSnapshot: "GXA012526",
      intraState: true,
      timedLines: [
        timedLine("pool-line", "Pool table timed play"),
        timedLine("ps5-line", "PS5 console timed play"),
      ],
      retailLines: [
        {
          id: "chips-line",
          description: "Chips pack",
          hsnSac: "2106",
          gstRatePercent: 18,
          unitPrice: 3000,
          quantity: 1,
        },
      ],
    });

    // GST is split per immutable invoice line, then summed. That keeps line
    // snapshots auditable, so CGST/SGST can differ by one paise on odd tax.
    expect(draft).toMatchObject({
      taxableValue: 11016,
      cgstAmount: 991,
      sgstAmount: 993,
      igstAmount: 0,
      totalAmount: 13000,
    });
    expect(draft.cgstAmount + draft.sgstAmount + draft.igstAmount).toBe(1984);
  });

  it("stores invoice discount snapshots and changes final payable amount", () => {
    const draft = buildInvoiceDraft({
      invoiceSeriesSnapshot: "GXA012526",
      intraState: true,
      timedLines: [timedLine("pool-line", "Pool table timed play")],
      retailLines: [],
      discountAmount: 500,
    });

    expect(draft.discountAmount).toBe(500);
    expect(draft.totalAmount).toBe(4500);
    expect(draft.lines[0]).toMatchObject({
      totalAmount: 4500,
      billableMinutes: 10,
    });
  });

  it("applies configured happy hour discounts to eligible timed play", () => {
    const draft = buildInvoiceDraft({
      invoiceSeriesSnapshot: "GXA012526",
      intraState: true,
      timedLines: [
        {
          ...timedLine("pool-line", "Pool table timed play"),
          events: [
            {
              eventType: "STARTED" as const,
              occurredAt: new Date("2026-06-08T04:30:00Z"),
            },
            {
              eventType: "STOPPED" as const,
              occurredAt: new Date("2026-06-08T05:30:00Z"),
            },
          ],
        },
      ],
      retailLines: [],
      automaticDiscountRules: [
        {
          id: "happy-hour",
          name: "Happy Hour",
          discountPercent: 30,
          minimumBillableMinutes: 60,
          daysOfWeek: [1, 2],
          startMinuteOfDay: 10 * 60,
          endMinuteOfDay: 17 * 60,
        },
      ],
      branchTimeZone: "Asia/Kolkata",
    });

    expect(draft.grossAmount).toBe(30000);
    expect(draft.automaticDiscountAmount).toBe(9000);
    expect(draft.manualDiscountAmount).toBe(0);
    expect(draft.discountAmount).toBe(9000);
    expect(draft.totalAmount).toBe(21000);
    expect(draft.lines[0].pricingRuleUsed).toContain("Happy Hour 30%");
  });

  it("does not apply happy hour below the configured minimum duration", () => {
    const draft = buildInvoiceDraft({
      invoiceSeriesSnapshot: "GXA012526",
      intraState: true,
      timedLines: [timedLine("pool-line", "Pool table timed play")],
      retailLines: [],
      automaticDiscountRules: [
        {
          id: "happy-hour",
          name: "Happy Hour",
          discountPercent: 30,
          minimumBillableMinutes: 60,
          daysOfWeek: [1, 2],
          startMinuteOfDay: 10 * 60,
          endMinuteOfDay: 17 * 60,
        },
      ],
      branchTimeZone: "Asia/Kolkata",
    });

    expect(draft.automaticDiscountAmount).toBe(0);
    expect(draft.totalAmount).toBe(5000);
  });
});

function timedLine(id: string, description: string) {
  return {
    id,
    description,
    hsnSac: "9996",
    gstRatePercent: 18,
    ratePerMinute: 500,
    minimumBillableMinutes: 10,
    roundUpToMinutes: 5,
    events: [
      {
        eventType: "STARTED" as const,
        occurredAt: new Date("2026-06-07T10:00:00Z"),
      },
      {
        eventType: "STOPPED" as const,
        occurredAt: new Date("2026-06-07T10:10:00Z"),
      },
    ],
  };
}
