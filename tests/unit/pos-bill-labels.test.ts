import { describe, expect, it } from "vitest";
import {
  nextWalkInBillLabel,
  resourceStartBillLabel,
} from "@/lib/pos/bill-labels";

describe("POS bill labels", () => {
  it("uses human-readable walk-in labels", () => {
    expect(nextWalkInBillLabel([])).toBe("Walk-in 001");
    expect(
      nextWalkInBillLabel([
        { customerLabel: "Walk-in 001", customerName: null },
        { customerLabel: "Table 1", customerName: null },
        { customerLabel: "Walk-in 004", customerName: null },
      ]),
    ).toBe("Walk-in 005");
  });

  it("suggests a resource bill for one-click start", () => {
    expect(resourceStartBillLabel("Pool 1", [])).toBe("Pool 1 bill");
    expect(
      resourceStartBillLabel("PS5 1", [
        { customerLabel: "PS5 1 bill", customerName: null },
      ]),
    ).toBe("PS5 1 bill 2");
  });

  it("does not generate timestamp-style labels", () => {
    const label = nextWalkInBillLabel([]);
    expect(label).not.toMatch(/\d{6,}/);
  });
});
