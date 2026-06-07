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
});
