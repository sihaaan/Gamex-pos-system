import { describe, expect, it } from "vitest";
import {
  assertBalancedJournal,
  checkoutJournalLines,
  refundJournalLines,
} from "@/lib/journal/entries";

describe("hidden journal engine", () => {
  it("creates balanced checkout entries", () => {
    const lines = checkoutJournalLines({
      totalAmount: 11800,
      taxableValue: 10000,
      cgstAmount: 900,
      sgstAmount: 900,
      igstAmount: 0,
    });

    expect(() => assertBalancedJournal(lines)).not.toThrow();
  });

  it("creates balanced refund reversal entries", () => {
    const lines = refundJournalLines({
      totalAmount: 11800,
      taxableValue: 10000,
      cgstAmount: 900,
      sgstAmount: 900,
      igstAmount: 0,
    });

    expect(() => assertBalancedJournal(lines)).not.toThrow();
  });

  it("rejects unbalanced manual lines", () => {
    expect(() =>
      assertBalancedJournal([
        { accountCode: "1000", side: "DEBIT", amount: 100 },
        { accountCode: "4000", side: "CREDIT", amount: 99 },
      ]),
    ).toThrow(/not balanced/);
  });
});
