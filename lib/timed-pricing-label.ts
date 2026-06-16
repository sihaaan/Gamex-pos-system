import { formatPaise } from "@/lib/utils";

export type TimedPricingLabelRule = {
  pricingMode?: string | null;
  ratePerMinute: number;
  halfHourPrice?: number | null;
  hourPrice?: number | null;
};

export function timedPricingLabel(rule: TimedPricingLabelRule): string {
  if (
    rule.pricingMode === "HALF_HOUR_BLOCKS" &&
    rule.halfHourPrice !== undefined &&
    rule.halfHourPrice !== null &&
    rule.hourPrice !== undefined &&
    rule.hourPrice !== null
  ) {
    return `${formatPaise(rule.halfHourPrice)}/30 min + ${formatPaise(rule.hourPrice)}/hr`;
  }

  return `${formatPaise(rule.ratePerMinute * 60)}/hr`;
}
