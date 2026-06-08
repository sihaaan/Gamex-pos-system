import { z } from "zod";

export const cuidSchema = z.string().min(8).max(40);

export const optionalTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .optional();

export const paiseSchema = z.number().int().min(0).max(99_999_999);

export const tenderSchema = z.enum([
  "CASH",
  "UPI_GOOGLE_PAY",
  "UPI_PHONEPE",
  "UPI_OTHER",
  "CARD_RECORDED",
]);

export const paymentInputSchema = z.object({
  tenderType: tenderSchema,
  amount: paiseSchema,
  reference: z.string().trim().max(120).optional(),
});

export const branchScopedSchema = z.object({
  branchId: cuidSchema,
});

export const openShiftSchema = branchScopedSchema.extend({
  cashOpeningFloat: paiseSchema.optional(),
  notes: z.string().trim().max(500).optional(),
});

export const closeShiftSchema = z.object({
  operatorShiftId: cuidSchema,
  cashCountedAmount: paiseSchema.optional(),
  notes: z.string().trim().max(500).optional(),
});

export const createTabSchema = branchScopedSchema.extend({
  customerLabel: z.string().trim().max(80).optional(),
  customerName: z.string().trim().max(120).optional(),
  customerPhone: z.string().trim().max(20).optional(),
  customerGstin: z.string().trim().max(15).optional(),
});

export const serviceStartSchema = z.object({
  tabId: cuidSchema,
  serviceCatalogId: cuidSchema,
  resourceId: cuidSchema,
});

export const serviceLineActionSchema = z.object({
  tabTimedLineId: cuidSchema,
  reason: z.string().trim().max(240).optional(),
});

export const serviceTransferSchema = serviceLineActionSchema.extend({
  toResourceId: cuidSchema,
});

export const serviceManualAdjustSchema = serviceLineActionSchema.extend({
  billableMinutesDelta: z.number().int().min(-600).max(600),
  reason: z.string().trim().min(3).max(240),
});

export const addRetailLineSchema = z.object({
  tabId: cuidSchema,
  productCatalogId: cuidSchema,
  quantity: z.number().int().positive().max(999),
});

export const checkoutSchema = z.object({
  tabId: cuidSchema,
  payments: z.array(paymentInputSchema).min(1).max(5),
  discountAmount: paiseSchema.optional(),
  discountReason: z.string().trim().max(240).optional(),
  managerOverrideId: cuidSchema.optional(),
});

export const managerOverrideApproveSchema = z.object({
  action: z.enum([
    "VOID_TAB",
    "VOID_INVOICE",
    "HIGH_DISCOUNT",
    "PRICE_OVERRIDE",
    "RETROACTIVE_SESSION_EDIT",
    "REFUND",
    "CREDIT_NOTE",
    "STOCK_ADJUSTMENT",
    "REOPEN_CLOSED_TAB",
    "REOPEN_OR_ADJUST_SHIFT",
    "CHANGE_TAX_PRICING_CONFIG",
  ]),
  targetType: z.string().trim().min(2).max(80),
  targetId: z.string().trim().min(1).max(80).optional(),
  branchId: cuidSchema.optional(),
  reason: z.string().trim().min(3).max(500),
  managerEmailOrCode: z.string().trim().min(3).max(255),
  managerPassword: z.string().min(8).max(200),
});

export const refundSchema = z.object({
  gstInvoiceId: cuidSchema,
  amount: paiseSchema,
  tenderType: tenderSchema,
  reference: z.string().trim().max(120).optional(),
  reason: z.string().trim().min(3).max(500),
});

export const managerReasonSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const reopenShiftSchema = managerReasonSchema.extend({
  operatorShiftId: cuidSchema,
});

export const stockAdjustmentSchema = managerReasonSchema.extend({
  branchId: cuidSchema,
  productCatalogId: cuidSchema,
  quantityDelta: z.number().int().min(-9999).max(9999),
});

export const taxRateSchema = z.object({
  code: z.string().trim().min(2).max(12),
  kind: z.enum(["HSN", "SAC"]),
  description: z.string().trim().min(2).max(160),
  gstRate: z.number().min(0).max(28),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional(),
  reason: z.string().trim().min(3).max(240),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(200),
});
