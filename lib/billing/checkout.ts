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
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
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
};

export function buildInvoiceDraft(params: {
  timedLines: readonly TimedLineSnapshot[];
  retailLines: readonly RetailLineSnapshot[];
  discountAmount?: number;
  invoiceSeriesSnapshot: string;
  intraState: boolean;
  now?: Date;
}): InvoiceDraft {
  const grossLines = [
    ...params.timedLines.map((line) => buildTimedGrossLine(line, params.now)),
    ...params.retailLines.map(buildRetailGrossLine),
  ];

  const grossTotal = grossLines.reduce(
    (total, line) => total + line.grossAmount,
    0,
  );
  const discountAmount = Math.min(params.discountAmount ?? 0, grossTotal);
  const discountAllocations = allocateDiscount(grossLines, discountAmount);

  const lines = grossLines.map<InvoiceDraftLine>((line, index) => {
    const discountedGross = Math.max(
      0,
      line.grossAmount - discountAllocations[index],
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
      pricingRuleUsed: line.pricingRuleUsed,
      invoiceSeriesSnapshot: params.invoiceSeriesSnapshot,
    };
  });

  const totals = sumGstBreakups(lines);

  return {
    lines,
    taxableValue: totals.taxableValue,
    cgstAmount: totals.cgstAmount,
    sgstAmount: totals.sgstAmount,
    igstAmount: totals.igstAmount,
    discountAmount,
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
