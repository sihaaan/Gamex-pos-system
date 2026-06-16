export type TimedPricingInput = {
  billableMinutes: number;
  pricingMode?: "PER_MINUTE" | "HALF_HOUR_BLOCKS" | string | null;
  ratePerMinute: number;
  halfHourPrice?: number | null;
  hourPrice?: number | null;
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

  if (
    input.pricingMode === "HALF_HOUR_BLOCKS" &&
    input.halfHourPrice !== undefined &&
    input.halfHourPrice !== null &&
    input.hourPrice !== undefined &&
    input.hourPrice !== null
  ) {
    const minimumMinutes = Math.max(1, input.minimumBillableMinutes);
    const chargedMinutes =
      Math.ceil(Math.max(input.billableMinutes, minimumMinutes) / 30) * 30;
    const fullHours = Math.floor(chargedMinutes / 60);
    const hasHalfHour = chargedMinutes % 60 > 0;

    return {
      chargedMinutes,
      grossAmount:
        fullHours * input.hourPrice +
        (hasHalfHour ? input.halfHourPrice : 0),
      pricingRuleUsed: `HALF_HOUR_BLOCKS_30_${input.halfHourPrice}_60_${input.hourPrice}`,
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
