import { describe, expect, it } from "vitest";
import { catalogBranchFilterMatches } from "@/lib/admin/catalog-filter";
import {
  adminCatalogAuditActions,
  assertCanManageBranchScopedRecord,
  assertResourceCanDeactivate,
  branchOptionalCatalogWhereForActor,
  calculateStockAdjustmentDelta,
  isProductVisibleInPos,
  isResourceVisibleInPos,
  type AdminActor,
  type BranchScopedAdminRecord,
} from "@/lib/admin/management";
import { priceRetailLine } from "@/lib/billing/pricing";
import { splitInclusiveGst } from "@/lib/gst/tax";
import { AppError } from "@/lib/http";

const owner: AdminActor = {
  userId: "owner-1",
  legalEntityId: "entity-1",
  branchId: null,
  role: "OWNER",
};

const manager: AdminActor = {
  userId: "manager-1",
  legalEntityId: "entity-1",
  branchId: "branch-1",
  role: "MANAGER",
};

const staff: AdminActor = {
  userId: "staff-1",
  legalEntityId: "entity-1",
  branchId: "branch-1",
  role: "STAFF",
};

const branchOneRecord: BranchScopedAdminRecord = {
  id: "record-1",
  legalEntityId: "entity-1",
  branchId: "branch-1",
};

describe("admin catalog management policy", () => {
  it("blocks staff from admin catalog scopes", () => {
    expect(() => branchOptionalCatalogWhereForActor(staff)).toThrow(AppError);
  });

  it("scopes managers to branch or global read access", () => {
    expect(branchOptionalCatalogWhereForActor(manager)).toEqual({
      legalEntityId: "entity-1",
      OR: [{ branchId: "branch-1" }, { branchId: null }],
    });
  });

  it("allows owners to manage branch-scoped records across branches", () => {
    expect(() =>
      assertCanManageBranchScopedRecord(owner, {
        ...branchOneRecord,
        branchId: "branch-2",
      }, "Product"),
    ).not.toThrow();
  });

  it("blocks managers from editing another branch or global catalog records", () => {
    expect(() =>
      assertCanManageBranchScopedRecord(manager, {
        ...branchOneRecord,
        branchId: "branch-2",
      }, "Resource"),
    ).toThrow(AppError);
    expect(() =>
      assertCanManageBranchScopedRecord(manager, {
        ...branchOneRecord,
        branchId: null,
      }, "Product"),
    ).toThrow(AppError);
  });

  it("blocks cross-tenant catalog edits", () => {
    expect(() =>
      assertCanManageBranchScopedRecord(owner, {
        ...branchOneRecord,
        legalEntityId: "entity-2",
      }, "Product"),
    ).toThrow(AppError);
  });

  it("blocks deactivation for occupied or running resources", () => {
    expect(() =>
      assertResourceCanDeactivate({
        resource: { isActive: true, status: "OCCUPIED" },
        activeTimedLineCount: 0,
      }),
    ).toThrow(AppError);
    expect(() =>
      assertResourceCanDeactivate({
        resource: { isActive: true, status: "AVAILABLE" },
        activeTimedLineCount: 1,
      }),
    ).toThrow(AppError);
    expect(() =>
      assertResourceCanDeactivate({
        resource: { isActive: true, status: "AVAILABLE" },
        activeTimedLineCount: 0,
      }),
    ).not.toThrow();
  });

  it("hides inactive and wrong-branch products/resources from POS visibility", () => {
    expect(isProductVisibleInPos({ isActive: true, branchId: null }, "branch-1"))
      .toBe(true);
    expect(isProductVisibleInPos({ isActive: true, branchId: "branch-1" }, "branch-1"))
      .toBe(true);
    expect(isProductVisibleInPos({ isActive: true, branchId: "branch-2" }, "branch-1"))
      .toBe(false);
    expect(isProductVisibleInPos({ isActive: false, branchId: "branch-1" }, "branch-1"))
      .toBe(false);
    expect(isResourceVisibleInPos({ isActive: true, branchId: "branch-1" }, "branch-1"))
      .toBe(true);
    expect(isResourceVisibleInPos({ isActive: false, branchId: "branch-1" }, "branch-1"))
      .toBe(false);
  });

  it("keeps all-branch catalog rows visible inside a branch admin filter", () => {
    expect(catalogBranchFilterMatches({ branchId: null }, "branch-1")).toBe(true);
    expect(catalogBranchFilterMatches({ branchId: "branch-1" }, "branch-1")).toBe(true);
    expect(catalogBranchFilterMatches({ branchId: "branch-2" }, "branch-1")).toBe(false);
    expect(catalogBranchFilterMatches({ branchId: null }, "GLOBAL")).toBe(true);
    expect(catalogBranchFilterMatches({ branchId: "branch-1" }, "GLOBAL")).toBe(false);
    expect(catalogBranchFilterMatches({ branchId: "branch-2" }, "")).toBe(true);
  });
});

describe("admin stock and snapshot safety", () => {
  it("calculates stock movement deltas and prevents negative stock", () => {
    expect(
      calculateStockAdjustmentDelta({
        adjustmentType: "INCREASE",
        quantity: 5,
        currentStock: 10,
      }),
    ).toBe(5);
    expect(
      calculateStockAdjustmentDelta({
        adjustmentType: "DECREASE",
        quantity: 4,
        currentStock: 10,
      }),
    ).toBe(-4);
    expect(
      calculateStockAdjustmentDelta({
        adjustmentType: "SET_COUNT",
        quantity: 7,
        currentStock: 10,
      }),
    ).toBe(-3);
    expect(() =>
      calculateStockAdjustmentDelta({
        adjustmentType: "DECREASE",
        quantity: 11,
        currentStock: 10,
      }),
    ).toThrow(AppError);
  });

  it("uses line snapshots so later product price changes do not mutate old totals", () => {
    const postedLineSnapshot = {
      unitPrice: 3_000,
      quantity: 2,
      gstRatePercent: 18,
    };
    const updatedCatalogPrice = 4_500;

    expect(
      priceRetailLine({
        unitPrice: postedLineSnapshot.unitPrice,
        quantity: postedLineSnapshot.quantity,
      }),
    ).toBe(6_000);
    expect(
      priceRetailLine({
        unitPrice: updatedCatalogPrice,
        quantity: postedLineSnapshot.quantity,
      }),
    ).toBe(9_000);
  });

  it("uses tax snapshots so later GST rate changes do not mutate old tax split", () => {
    const postedTax = splitInclusiveGst({
      grossAmount: 1_180,
      gstRatePercent: 18,
      intraState: true,
    });
    const futureTax = splitInclusiveGst({
      grossAmount: 1_180,
      gstRatePercent: 12,
      intraState: true,
    });

    expect(postedTax.taxableValue).toBe(1_000);
    expect(postedTax.cgstAmount + postedTax.sgstAmount).toBe(180);
    expect(futureTax.cgstAmount + futureTax.sgstAmount).toBe(126);
  });

  it("declares audit actions for catalog and stock changes", () => {
    expect(adminCatalogAuditActions).toEqual(
      expect.arrayContaining([
        "ADMIN_RESOURCE_CREATED",
        "ADMIN_PRODUCT_EDITED",
        "ADMIN_STOCK_ADJUSTED",
        "ADMIN_SERVICE_EDITED",
        "ADMIN_GST_RATE_EDITED",
      ]),
    );
  });
});
