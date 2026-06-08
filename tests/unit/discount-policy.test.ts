import { describe, expect, it } from "vitest";
import { assertDiscountCheckoutRules } from "@/lib/discounts/policy";

describe("discount checkout policy", () => {
  it("requires a reason for any discount", () => {
    expect(() =>
      assertDiscountCheckoutRules({
        role: "STAFF",
        discountAmount: 500,
        grossAmount: 5000,
        discountReason: "",
        limitPercent: 10,
      }),
    ).toThrow(/discount reason/i);
  });

  it("requires manager override for high staff discounts", () => {
    expect(() =>
      assertDiscountCheckoutRules({
        role: "STAFF",
        discountAmount: 1500,
        grossAmount: 10000,
        discountReason: "Tournament promo",
        limitPercent: 10,
      }),
    ).toThrow(/manager approval/i);
  });

  it("allows high staff discounts with manager override", () => {
    expect(
      assertDiscountCheckoutRules({
        role: "STAFF",
        discountAmount: 1500,
        grossAmount: 10000,
        discountReason: "Tournament promo",
        managerOverrideId: "override-1",
        limitPercent: 10,
      }),
    ).toEqual({ highDiscountRequiresOverride: true });
  });
});
