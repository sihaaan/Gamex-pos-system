import { formatPaise } from "@/lib/utils";

export type TimedPricingLabelRule = {
  pricingMode?: string | null;
  ratePerMinute: number;
  halfHourPrice?: number | null;
  hourPrice?: number | null;
  controllerPricingEnabled?: boolean | null;
  multiplayerHalfHourPrice?: number | null;
  multiplayerHourPrice?: number | null;
};

export function timedPricingLabel(rule: TimedPricingLabelRule): string {
  if (
    rule.pricingMode === "HALF_HOUR_BLOCKS" &&
    rule.halfHourPrice !== undefined &&
    rule.halfHourPrice !== null &&
    rule.hourPrice !== undefined &&
    rule.hourPrice !== null
  ) {
    const baseLabel = `${formatPaise(rule.halfHourPrice)}/30 min + ${formatPaise(rule.hourPrice)}/hr`;
    if (
      rule.controllerPricingEnabled &&
      rule.multiplayerHalfHourPrice !== undefined &&
      rule.multiplayerHalfHourPrice !== null &&
      rule.multiplayerHourPrice !== undefined &&
      rule.multiplayerHourPrice !== null
    ) {
      return `${baseLabel}; multi ${formatPaise(rule.multiplayerHalfHourPrice)}/30 min + ${formatPaise(rule.multiplayerHourPrice)}/hr per controller`;
    }
    return baseLabel;
  }

  return `${formatPaise(rule.ratePerMinute * 60)}/hr`;
}
