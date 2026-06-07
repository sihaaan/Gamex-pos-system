export type GstBreakup = {
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
};

export function splitInclusiveGst(params: {
  grossAmount: number;
  gstRatePercent: number;
  intraState: boolean;
}): GstBreakup {
  if (params.grossAmount < 0) {
    throw new Error("GST gross amount cannot be negative.");
  }

  const divisor = 100 + params.gstRatePercent;
  const taxableValue = Math.round((params.grossAmount * 100) / divisor);
  const taxAmount = params.grossAmount - taxableValue;

  if (!params.intraState) {
    return {
      taxableValue,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: taxAmount,
      totalAmount: params.grossAmount,
    };
  }

  const cgstAmount = Math.floor(taxAmount / 2);
  return {
    taxableValue,
    cgstAmount,
    sgstAmount: taxAmount - cgstAmount,
    igstAmount: 0,
    totalAmount: params.grossAmount,
  };
}

export function sumGstBreakups(lines: readonly GstBreakup[]): GstBreakup {
  return lines.reduce<GstBreakup>(
    (total, line) => ({
      taxableValue: total.taxableValue + line.taxableValue,
      cgstAmount: total.cgstAmount + line.cgstAmount,
      sgstAmount: total.sgstAmount + line.sgstAmount,
      igstAmount: total.igstAmount + line.igstAmount,
      totalAmount: total.totalAmount + line.totalAmount,
    }),
    {
      taxableValue: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalAmount: 0,
    },
  );
}
