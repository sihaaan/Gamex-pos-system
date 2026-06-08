import {
  calculateBillableDuration,
  type BillableSessionEvent,
} from "@/lib/billing/duration";
import { priceRetailLine, priceTimedService } from "@/lib/billing/pricing";
import { splitInclusiveGst, sumGstBreakups } from "@/lib/gst/tax";

export type InvoiceLineKind = "SERVICE" | "RETAIL";

export type TimedLineSnapshot = {
  id: string;
  description: string;
  hsnSac: string;
  gstRatePercent: number;
  ratePerMinute: number;
  minimumBillableMinutes: number;
  roundUpToMinutes: number;
  priceOverrideAmount?: number | null;
  events: readonly BillableSessionEvent[];
};

export type RetailLineSnapshot = {
  id: string;
  description: string;
  hsnSac: string;
  gstRatePercent: number;
  unitPrice: number;
  quantity: number;
  discountAmount?: number;
};

export type AutomaticDiscountRuleSnapshot = {
  id: string;
  name: string;
  branchId?: string | null;
  discountPercent: number;
  minimumBillableMinutes: number;
  daysOfWeek: readonly number[];
  startMinuteOfDay: number;
  endMinuteOfDay: number;
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
};

export type InvoiceDraftLine = {
  sourceLineId: string;
  lineKind: InvoiceLineKind;
  description: string;
  hsnSac: string;
  gstRatePercent: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  unitPrice: number;
  quantity?: number;
  billableMinutes?: number;
  pricingRuleUsed: string;
  invoiceSeriesSnapshot: string;
};

export type InvoiceDraft = {
  lines: InvoiceDraftLine[];
  grossAmount: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  automaticDiscountAmount: number;
  manualDiscountAmount: number;
  discountAmount: number;
  totalAmount: number;
};

type GrossLine = {
  sourceLineId: string;
  lineKind: InvoiceLineKind;
  description: string;
  hsnSac: string;
  gstRatePercent: number;
  grossAmount: number;
  unitPrice: number;
  quantity?: number;
  billableMinutes?: number;
  pricingRuleUsed: string;
  startedAt?: Date;
};

export function buildInvoiceDraft(params: {
  timedLines: readonly TimedLineSnapshot[];
  retailLines: readonly RetailLineSnapshot[];
  automaticDiscountRules?: readonly AutomaticDiscountRuleSnapshot[];
  discountAmount?: number;
  invoiceSeriesSnapshot: string;
  intraState: boolean;
  now?: Date;
  branchTimeZone?: string;
}): InvoiceDraft {
  const grossLines = [
    ...params.timedLines.map((line) => buildTimedGrossLine(line, params.now)),
    ...params.retailLines.map(buildRetailGrossLine),
  ];

  const grossTotal = grossLines.reduce(
    (total, line) => total + line.grossAmount,
    0,
  );
  const automaticDiscounts = allocateAutomaticDiscounts({
    lines: grossLines,
    rules: params.automaticDiscountRules ?? [],
    branchTimeZone: params.branchTimeZone ?? "Asia/Kolkata",
  });
  const automaticDiscountAmount = automaticDiscounts.reduce(
    (total, discount) => total + discount.amount,
    0,
  );
  const manualDiscountBaseLines = grossLines.map((line, index) => ({
    ...line,
    grossAmount: Math.max(0, line.grossAmount - automaticDiscounts[index].amount),
  }));
  const manualDiscountAmount = Math.min(
    params.discountAmount ?? 0,
    Math.max(0, grossTotal - automaticDiscountAmount),
  );
  const manualDiscountAllocations = allocateDiscount(
    manualDiscountBaseLines,
    manualDiscountAmount,
  );

  const lines = grossLines.map<InvoiceDraftLine>((line, index) => {
    const discountedGross = Math.max(
      0,
      line.grossAmount -
        automaticDiscounts[index].amount -
        manualDiscountAllocations[index],
    );
    const gst = splitInclusiveGst({
      grossAmount: discountedGross,
      gstRatePercent: line.gstRatePercent,
      intraState: params.intraState,
    });

    return {
      sourceLineId: line.sourceLineId,
      lineKind: line.lineKind,
      description: line.description,
      hsnSac: line.hsnSac,
      gstRatePercent: line.gstRatePercent,
      taxableValue: gst.taxableValue,
      cgstAmount: gst.cgstAmount,
      sgstAmount: gst.sgstAmount,
      igstAmount: gst.igstAmount,
      totalAmount: gst.totalAmount,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      billableMinutes: line.billableMinutes,
      pricingRuleUsed: automaticDiscounts[index].ruleName
        ? `${line.pricingRuleUsed}; AUTO_DISCOUNT ${automaticDiscounts[index].ruleName} ${automaticDiscounts[index].discountPercent}%`
        : line.pricingRuleUsed,
      invoiceSeriesSnapshot: params.invoiceSeriesSnapshot,
    };
  });

  const totals = sumGstBreakups(lines);

  return {
    lines,
    grossAmount: grossTotal,
    taxableValue: totals.taxableValue,
    cgstAmount: totals.cgstAmount,
    sgstAmount: totals.sgstAmount,
    igstAmount: totals.igstAmount,
    automaticDiscountAmount,
    manualDiscountAmount,
    discountAmount: automaticDiscountAmount + manualDiscountAmount,
    totalAmount: totals.totalAmount,
  };
}

function buildTimedGrossLine(
  line: TimedLineSnapshot,
  now?: Date,
): GrossLine {
  const duration = calculateBillableDuration(line.events, now);
  const priced = priceTimedService({
    billableMinutes: duration.billableMinutes,
    ratePerMinute: line.ratePerMinute,
    minimumBillableMinutes: line.minimumBillableMinutes,
    roundUpToMinutes: line.roundUpToMinutes,
    priceOverrideAmount: line.priceOverrideAmount,
  });

  return {
    sourceLineId: line.id,
    lineKind: "SERVICE",
    description: line.description,
    hsnSac: line.hsnSac,
    gstRatePercent: line.gstRatePercent,
    grossAmount: priced.grossAmount,
    unitPrice: line.ratePerMinute,
    billableMinutes: priced.chargedMinutes,
    pricingRuleUsed: priced.pricingRuleUsed,
    startedAt: firstStartedAt(line.events),
  };
}

function buildRetailGrossLine(line: RetailLineSnapshot): GrossLine {
  return {
    sourceLineId: line.id,
    lineKind: "RETAIL",
    description: line.description,
    hsnSac: line.hsnSac,
    gstRatePercent: line.gstRatePercent,
    grossAmount: priceRetailLine({
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      discountAmount: line.discountAmount,
    }),
    unitPrice: line.unitPrice,
    quantity: line.quantity,
    pricingRuleUsed: "CATALOG_UNIT_PRICE",
  };
}

function allocateAutomaticDiscounts(params: {
  lines: readonly GrossLine[];
  rules: readonly AutomaticDiscountRuleSnapshot[];
  branchTimeZone: string;
}): Array<{
  amount: number;
  ruleName: string | null;
  discountPercent: number;
}> {
  return params.lines.map((line) => {
    if (
      line.lineKind !== "SERVICE" ||
      !line.startedAt ||
      !line.billableMinutes ||
      line.grossAmount <= 0
    ) {
      return { amount: 0, ruleName: null, discountPercent: 0 };
    }

    const matchingRule = params.rules
      .filter((rule) =>
        discountRuleMatchesLine({
          rule,
          startedAt: line.startedAt as Date,
          billableMinutes: line.billableMinutes ?? 0,
          branchTimeZone: params.branchTimeZone,
        }),
      )
      .sort(
        (left, right) => right.discountPercent - left.discountPercent,
      )[0];

    if (!matchingRule) {
      return { amount: 0, ruleName: null, discountPercent: 0 };
    }

    return {
      amount: Math.floor((line.grossAmount * matchingRule.discountPercent) / 100),
      ruleName: matchingRule.name,
      discountPercent: matchingRule.discountPercent,
    };
  });
}

function discountRuleMatchesLine(params: {
  rule: AutomaticDiscountRuleSnapshot;
  startedAt: Date;
  billableMinutes: number;
  branchTimeZone: string;
}): boolean {
  const { rule, startedAt, billableMinutes, branchTimeZone } = params;
  if (billableMinutes < rule.minimumBillableMinutes) {
    return false;
  }

  if (rule.effectiveFrom && startedAt < rule.effectiveFrom) {
    return false;
  }

  if (rule.effectiveTo && startedAt > rule.effectiveTo) {
    return false;
  }

  const localStart = localRuleTime(startedAt, branchTimeZone);
  if (!rule.daysOfWeek.includes(localStart.dayOfWeek)) {
    return false;
  }

  if (rule.startMinuteOfDay < rule.endMinuteOfDay) {
    return (
      localStart.minuteOfDay >= rule.startMinuteOfDay &&
      localStart.minuteOfDay < rule.endMinuteOfDay
    );
  }

  return (
    localStart.minuteOfDay >= rule.startMinuteOfDay ||
    localStart.minuteOfDay < rule.endMinuteOfDay
  );
}

function firstStartedAt(events: readonly BillableSessionEvent[]): Date | undefined {
  return [...events]
    .filter((event) => event.eventType === "STARTED")
    .sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime())[0]
    ?.occurredAt;
}

function localRuleTime(
  date: Date,
  timeZone: string,
): { dayOfWeek: number; minuteOfDay: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone,
    weekday: "short",
  }).formatToParts(date);
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));
  const weekday = valueByType.get("weekday") ?? "Sun";
  const hour = Number(valueByType.get("hour") ?? "0");
  const minute = Number(valueByType.get("minute") ?? "0");

  return {
    dayOfWeek: weekdayIndex(weekday),
    minuteOfDay: hour * 60 + minute,
  };
}

function weekdayIndex(value: string): number {
  const normalized = value.slice(0, 3).toLowerCase();
  const indexByWeekday: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };
  return indexByWeekday[normalized] ?? 0;
}

function allocateDiscount(
  lines: readonly GrossLine[],
  discountAmount: number,
): number[] {
  if (discountAmount <= 0 || lines.length === 0) {
    return lines.map(() => 0);
  }

  const grossTotal = lines.reduce((total, line) => total + line.grossAmount, 0);
  if (grossTotal <= 0) {
    return lines.map(() => 0);
  }

  const allocations = lines.map((line) =>
    Math.floor((discountAmount * line.grossAmount) / grossTotal),
  );
  let remainder =
    discountAmount - allocations.reduce((total, value) => total + value, 0);

  for (let index = 0; index < allocations.length && remainder > 0; index += 1) {
    allocations[index] += 1;
    remainder -= 1;
  }

  return allocations;
}
