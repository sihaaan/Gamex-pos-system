import type {
  DiscountType,
  NormalizedPaymentDraft,
  PaymentDraft,
  TenderType,
} from "./types";

export function createPaymentDraft(
  id: string,
  amount = "",
  tenderType: TenderType = "UPI_PHONEPE",
  reference = "",
): PaymentDraft {
  return {
    id,
    tenderType,
    amount,
    reference,
    tendered: "",
  };
}

export function makePaymentDraftId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `payment-${Date.now()}`;
}

export type PaymentSummary = {
  payments: NormalizedPaymentDraft[];
  totalAmount: number;
  hasInvalidAmount: boolean;
  hasShortCashTender: boolean;
  changeDueAmount: number;
};

export function summarizePaymentDrafts(
  paymentDrafts: readonly PaymentDraft[],
): PaymentSummary {
  const payments: NormalizedPaymentDraft[] = [];
  let totalAmount = 0;
  let hasInvalidAmount = false;
  let hasShortCashTender = false;
  let changeDueAmount = 0;

  for (const paymentDraft of paymentDrafts) {
    const amount = parseRupeeInputToPaise(paymentDraft.amount);

    if (amount === null) {
      if (paymentDraft.amount.trim() !== "") {
        hasInvalidAmount = true;
      }
      continue;
    }

    if (amount <= 0) {
      continue;
    }

    const reference = paymentDraft.reference.trim();
    let tenderedAmount: number | undefined;

    if (paymentDraft.tenderType === "CASH" && paymentDraft.tendered.trim() !== "") {
      const tendered = parseRupeeInputToPaise(paymentDraft.tendered);
      if (tendered === null) {
        hasInvalidAmount = true;
        continue;
      }
      if (tendered < amount) {
        hasShortCashTender = true;
        continue;
      }
      tenderedAmount = tendered;
      changeDueAmount += tendered - amount;
    }

    totalAmount += amount;
    payments.push({
      tenderType: paymentDraft.tenderType,
      amount,
      ...(reference ? { reference } : {}),
      ...(tenderedAmount !== undefined ? { tenderedAmount } : {}),
    });
  }

  return {
    payments,
    totalAmount,
    hasInvalidAmount,
    hasShortCashTender,
    changeDueAmount,
  };
}

export function parseRupeeInputToPaise(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) {
    return null;
  }

  const [rupees, paise = ""] = normalized.split(".");
  const rupeeAmount = Number(rupees);
  const paiseAmount = Number(paise.padEnd(2, "0"));

  if (!Number.isSafeInteger(rupeeAmount) || !Number.isSafeInteger(paiseAmount)) {
    return null;
  }

  return rupeeAmount * 100 + paiseAmount;
}

export function paiseToRupeeInput(amount: number): string {
  return (amount / 100).toFixed(2);
}

export function calculateDiscountAmount({
  discountType,
  discountValue,
  grossAmount,
}: {
  discountType: DiscountType;
  discountValue: string;
  grossAmount: number;
}): number {
  const numericValue = Number(discountValue.trim());
  if (!Number.isFinite(numericValue) || numericValue <= 0 || grossAmount <= 0) {
    return 0;
  }

  const amount =
    discountType === "PERCENT"
      ? Math.round((grossAmount * Math.min(numericValue, 100)) / 100)
      : Math.round(numericValue * 100);

  return Math.min(Math.max(amount, 0), grossAmount);
}
