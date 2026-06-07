export type TimedPricingInput = {
  billableMinutes: number;
  ratePerMinute: number;
  minimumBillableMinutes: number;
  roundUpToMinutes: number;
  priceOverrideAmount?: number | null;
};

export type TimedPricingResult = {
  chargedMinutes: number;
  grossAmount: number;
  pricingRuleUsed: string;
};

export function priceTimedService(input: TimedPricingInput): TimedPricingResult {
  if (input.priceOverrideAmount !== undefined && input.priceOverrideAmount !== null) {
    return {
      chargedMinutes: input.billableMinutes,
      grossAmount: input.priceOverrideAmount,
      pricingRuleUsed: "MANAGER_PRICE_OVERRIDE",
    };
  }

  const minimumMinutes = Math.max(1, input.minimumBillableMinutes);
  const rounding = Math.max(1, input.roundUpToMinutes);
  const roundedMinutes =
    Math.ceil(Math.max(input.billableMinutes, minimumMinutes) / rounding) *
    rounding;

  return {
    chargedMinutes: roundedMinutes,
    grossAmount: roundedMinutes * input.ratePerMinute,
    pricingRuleUsed: `MIN_${minimumMinutes}_ROUND_${rounding}_RATE_${input.ratePerMinute}`,
  };
}

export function priceRetailLine(params: {
  unitPrice: number;
  quantity: number;
  discountAmount?: number;
}): number {
  const discountAmount = params.discountAmount ?? 0;
  return Math.max(0, params.unitPrice * params.quantity - discountAmount);
}

export function sumPaise(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
