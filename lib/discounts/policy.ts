import type { UserRole } from "@/lib/generated/prisma/enums";
import { AppError } from "@/lib/http";
import { isManagerOrOwner } from "@/lib/permissions/policy";

export function isHighDiscount(params: {
  discountAmount: number;
  grossAmount: number;
  limitPercent: number;
}): boolean {
  return (
    params.discountAmount > 0 &&
    params.grossAmount > 0 &&
    (params.discountAmount / params.grossAmount) * 100 > params.limitPercent
  );
}

export function assertDiscountCheckoutRules(params: {
  role: UserRole;
  discountAmount: number;
  grossAmount: number;
  discountReason?: string | null;
  managerOverrideId?: string | null;
  limitPercent: number;
}): { highDiscountRequiresOverride: boolean } {
  if (params.discountAmount > 0 && !params.discountReason?.trim()) {
    throw new AppError(
      400,
      "DISCOUNT_REASON_REQUIRED",
      "Enter a discount reason before checkout.",
    );
  }

  if (params.discountAmount > params.grossAmount) {
    throw new AppError(
      400,
      "DISCOUNT_EXCEEDS_BILL",
      "Discount cannot be greater than the bill total.",
    );
  }

  const highDiscountRequiresOverride = isHighDiscount({
    discountAmount: params.discountAmount,
    grossAmount: params.grossAmount,
    limitPercent: params.limitPercent,
  });

  if (
    highDiscountRequiresOverride &&
    !isManagerOrOwner(params.role) &&
    !params.managerOverrideId
  ) {
    throw new AppError(
      403,
      "MANAGER_OVERRIDE_REQUIRED",
      "This discount requires manager approval.",
    );
  }

  return { highDiscountRequiresOverride };
}
