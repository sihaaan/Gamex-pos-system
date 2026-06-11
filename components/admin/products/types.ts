import type { TaxRateOption } from "@/components/admin/shared";

export type ProductRow = {
  id: string;
  branchId: string | null;
  taxRateId: string;
  sku: string;
  name: string;
  hsnCode: string;
  unitPrice: number;
  trackStock: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  isActive: boolean;
  branch: { id: string; name: string; code: string } | null;
  taxRate: TaxRateOption;
};

export type ProductDraft = {
  branchId: string;
  taxRateId: string;
  sku: string;
  name: string;
  hsnCode: string;
  unitPrice: string;
  trackStock: boolean;
  stockQuantity: string;
  lowStockThreshold: string;
  isActive: boolean;
  reason: string;
};

export type StockDraft = {
  adjustmentType: "INCREASE" | "DECREASE" | "SET_COUNT";
  quantity: string;
  reason: string;
};

export const emptyProductDraft: ProductDraft = {
  branchId: "",
  taxRateId: "",
  sku: "",
  name: "",
  hsnCode: "",
  unitPrice: "",
  trackStock: true,
  stockQuantity: "0",
  lowStockThreshold: "0",
  isActive: true,
  reason: "",
};

export const emptyStockDraft: StockDraft = {
  adjustmentType: "INCREASE",
  quantity: "",
  reason: "",
};
