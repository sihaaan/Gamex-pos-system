import { describe, expect, it } from "vitest";
import { refundJournalLines } from "@/lib/journal/entries";
import { splitInclusiveGst } from "@/lib/gst/tax";

describe("refund credit note flow", () => {
  it("builds reversing GST and journal values without changing the invoice", () => {
    const postedInvoice = Object.freeze({
      id: "invoice-1",
      invoiceNumber: "GXA012526000001",
      totalAmount: 11800,
    });
    const refundGst = splitInclusiveGst({
      grossAmount: 5900,
      gstRatePercent: 18,
      intraState: true,
    });

    const journal = refundJournalLines(refundGst);

    expect(postedInvoice.invoiceNumber).toBe("GXA012526000001");
    expect(refundGst.totalAmount).toBe(5900);
    expect(journal).toContainEqual(
      expect.objectContaining({
        accountCode: "1000",
        side: "CREDIT",
        amount: 5900,
      }),
    );
  });
});
