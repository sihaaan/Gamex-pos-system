import { describe, expect, it } from "vitest";
import { compactFinancialYear, formatInvoiceNumber } from "@/lib/gst/invoice-number";

describe("invoice numbering", () => {
  it("uses the Indian financial year compact code", () => {
    expect(compactFinancialYear(new Date("2026-03-31T12:00:00Z"))).toBe("2526");
    expect(compactFinancialYear(new Date("2026-04-01T12:00:00Z"))).toBe("2627");
  });

  it("keeps GST invoice numbers within 16 characters", () => {
    expect(formatInvoiceNumber({ prefix: "GXA012526", nextNumber: 42 })).toBe(
      "GXA012526000042",
    );
  });

  it("rejects overlong invoice series", () => {
    expect(() =>
      formatInvoiceNumber({ prefix: "TOO-LONG-PREFIX", nextNumber: 1 }),
    ).toThrow(/16 character/);
  });
});
