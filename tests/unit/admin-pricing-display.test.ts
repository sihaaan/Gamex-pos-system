import { describe, expect, it } from "vitest";
import {
  activeBranchOverrideForService,
  effectiveServiceForBranch,
  pricingEditActionLabel,
  pricingScopeLabel,
  type PricingDisplayService,
} from "@/lib/admin/pricing-display";

const globalPool = service({
  branchId: null,
  name: "Pool table",
  ratePerMinute: 500,
});

const globalPs5 = service({
  branchId: null,
  name: "PS5 console",
  ratePerMinute: 500,
});

const branchPs5 = service({
  branchId: "branch-1",
  name: "PS5 console",
  ratePerMinute: 700,
});

describe("admin pricing display rules", () => {
  it("labels global rows as inherited when viewed inside a branch scope", () => {
    expect(pricingScopeLabel(globalPool, "branch-1")).toBe(
      "Inherited from global default",
    );
    expect(pricingScopeLabel(globalPool, null)).toBe("Global default");
    expect(pricingScopeLabel(branchPs5, "branch-1")).toBe("Branch override");
  });

  it("uses edit wording that matches the action being taken", () => {
    expect(
      pricingEditActionLabel({
        service: globalPs5,
        role: "MANAGER",
        effectiveBranchId: "branch-1",
      }),
    ).toBe("Create branch override");
    expect(
      pricingEditActionLabel({
        service: globalPs5,
        role: "OWNER",
        effectiveBranchId: null,
      }),
    ).toBe("Edit global default");
    expect(
      pricingEditActionLabel({
        service: branchPs5,
        role: "MANAGER",
        effectiveBranchId: "branch-1",
      }),
    ).toBe("Edit branch override");
  });

  it("uses an active branch override as the effective POS rate", () => {
    expect(
      effectiveServiceForBranch(globalPs5, [globalPs5, branchPs5], "branch-1")
        ?.pricingRule.ratePerMinute,
    ).toBe(700);
  });

  it("falls back to the global default when no branch override exists", () => {
    expect(
      effectiveServiceForBranch(globalPool, [globalPool, branchPs5], "branch-1")
        ?.pricingRule.ratePerMinute,
    ).toBe(500);
  });

  it("ignores inactive branch overrides for POS effective pricing", () => {
    const inactiveOverride = service({
      branchId: "branch-1",
      name: "PS5 console",
      ratePerMinute: 900,
      isActive: false,
    });

    expect(
      activeBranchOverrideForService(globalPs5, [globalPs5, inactiveOverride], "branch-1"),
    ).toBeNull();
    expect(
      effectiveServiceForBranch(globalPs5, [globalPs5, inactiveOverride], "branch-1")
        ?.pricingRule.ratePerMinute,
    ).toBe(500);
  });
});

function service({
  branchId,
  name,
  ratePerMinute,
  isActive = true,
}: {
  branchId: string | null;
  name: string;
  ratePerMinute: number;
  isActive?: boolean;
}): PricingDisplayService {
  return {
    branchId,
    isActive,
    name,
    description: `${name} timed play`,
    pricingRule: { ratePerMinute },
  };
}
