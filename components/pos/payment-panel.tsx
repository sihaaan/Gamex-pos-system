"use client";

import { Banknote, CreditCard, Plus, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatPaise } from "@/lib/utils";
import { parseRupeeInputToPaise } from "./money";
import type { PaymentDraft, TenderType } from "./types";
import type { PosController } from "./use-pos-controller";

export function PaymentPanel({ controller }: { controller: PosController }) {
  const { state, derived, actions } = controller;
  const { paymentStatusLabel, paymentStatusTone, canPostCheckout } = derived;

  if (!derived.selectedTab) {
    return null;
  }

  const statusToneClass =
    paymentStatusTone === "success"
      ? "bg-success-soft text-success-ink"
      : "bg-warning-soft text-warning-ink";

  return (
    <div className="grid gap-2">
      <div className="grid gap-2 rounded-lg border border-line bg-surface p-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Wallet className="h-4 w-4 text-success" />
          Collect payment
        </p>
        {state.paymentDrafts.map((paymentDraft, index) => (
          <div key={paymentDraft.id} className="grid gap-2">
            <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
              <label className="grid gap-1 text-xs font-medium text-ink-muted">
                Tender
                <Select
                  aria-label={`Tender ${index + 1}`}
                  className="min-h-11"
                  disabled={state.actionPending}
                  value={paymentDraft.tenderType}
                  onChange={(event) =>
                    actions.dispatch({
                      type: "PAYMENT_DRAFT_UPDATED",
                      paymentDraftId: paymentDraft.id,
                      patch: {
                        tenderType: event.target.value as TenderType,
                      },
                    })
                  }
                >
                  <option value="UPI_GOOGLE_PAY">UPI - Google Pay</option>
                  <option value="UPI_PHONEPE">UPI - PhonePe</option>
                  <option value="UPI_OTHER">UPI - Other</option>
                  <option value="CARD_RECORDED">Card recorded</option>
                  <option value="CASH">Cash</option>
                </Select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-ink-muted">
                Amount
                <Input
                  aria-label={`Tender ${index + 1} amount`}
                  className="min-h-11 tabular-nums"
                  disabled={state.actionPending}
                  inputMode="decimal"
                  value={paymentDraft.amount}
                  onChange={(event) =>
                    actions.dispatch({
                      type: "PAYMENT_DRAFT_UPDATED",
                      paymentDraftId: paymentDraft.id,
                      patch: { amount: event.target.value },
                    })
                  }
                />
              </label>
            </div>
            {paymentDraft.tenderType === "CASH" ? (
              <CashTenderRow
                controller={controller}
                paymentDraft={paymentDraft}
              />
            ) : null}
            {state.paymentDrafts.length > 1 ? (
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Button
                  className="px-3"
                  disabled={!state.quote || state.actionPending}
                  onClick={() => actions.fillPaymentRemainder(paymentDraft.id)}
                  variant="secondary"
                >
                  Fill rest
                </Button>
                <Button
                  aria-label={`Remove tender ${index + 1}`}
                  className="px-3"
                  disabled={
                    state.paymentDrafts.length === 1 || state.actionPending
                  }
                  onClick={() =>
                    actions.dispatch({
                      type: "PAYMENT_DRAFT_REMOVED",
                      paymentDraftId: paymentDraft.id,
                    })
                  }
                  variant="ghost"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>
        ))}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            variant="secondary"
            onClick={actions.addPaymentDraft}
            disabled={state.paymentDrafts.length >= 5 || state.actionPending}
          >
            <Plus className="h-4 w-4" />
            Add payment
          </Button>
          <Button
            variant="secondary"
            onClick={actions.useTotalPayment}
            disabled={
              !state.quote ||
              state.quote.totalAmount <= 0 ||
              state.quoteLoading ||
              state.actionPending
            }
          >
            Use bill total
          </Button>
        </div>
        <div
          className={`rounded-md px-3 py-2 text-sm font-semibold ${statusToneClass}`}
        >
          {paymentStatusLabel}
        </div>
        {derived.paymentSummary.hasShortCashTender ? (
          <p className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm font-medium text-danger-ink">
            Cash tendered is less than the cash amount.
          </p>
        ) : null}
        {derived.paymentSummary.changeDueAmount > 0 ? (
          <div className="flex items-center justify-between gap-3 rounded-md border border-info-line bg-info-soft px-3 py-2">
            <span className="flex items-center gap-2 text-sm font-semibold text-info-ink">
              <Banknote className="h-4 w-4" />
              Change due
            </span>
            <span className="text-lg font-semibold tabular-nums text-info-ink">
              {formatPaise(derived.paymentSummary.changeDueAmount)}
            </span>
          </div>
        ) : null}
      </div>
      <Button
        className="min-h-12 text-base"
        onClick={() => void actions.checkout()}
        disabled={!canPostCheckout}
        variant={canPostCheckout ? "primary" : "secondary"}
      >
        <CreditCard className="h-4 w-4" />
        {derived.checkoutButtonLabel}
      </Button>
    </div>
  );
}

function CashTenderRow({
  controller,
  paymentDraft,
}: {
  controller: PosController;
  paymentDraft: PaymentDraft;
}) {
  const { state, actions } = controller;
  const cashAmount = parseRupeeInputToPaise(paymentDraft.amount);
  const tenderedAmount =
    paymentDraft.tendered.trim() === ""
      ? null
      : parseRupeeInputToPaise(paymentDraft.tendered);
  const change =
    cashAmount !== null && tenderedAmount !== null
      ? tenderedAmount - cashAmount
      : null;

  return (
    <div className="grid gap-1 rounded-md bg-surface-muted p-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
        <label className="grid gap-1 text-xs font-medium text-ink-muted">
          Tendered amount (cash given by customer)
          <Input
            className="min-h-11 tabular-nums"
            disabled={state.actionPending}
            inputMode="decimal"
            placeholder={paymentDraft.amount || "500"}
            value={paymentDraft.tendered}
            onChange={(event) =>
              actions.dispatch({
                type: "PAYMENT_DRAFT_UPDATED",
                paymentDraftId: paymentDraft.id,
                patch: { tendered: event.target.value },
              })
            }
          />
        </label>
        <div className="grid content-end gap-1 text-xs font-medium text-ink-muted">
          Change
          <p
            className={`flex min-h-11 items-center rounded-md px-3 text-sm font-semibold tabular-nums ${
              change !== null && change < 0
                ? "bg-danger-soft text-danger-ink"
                : "bg-surface text-ink"
            }`}
          >
            {change === null ? "--" : formatPaise(Math.max(change, 0))}
          </p>
        </div>
      </div>
      <p className="text-xs text-ink-subtle">
        Leave blank for exact cash. Only the bill amount is recorded on the
        invoice; tendered and change go to the payment record.
      </p>
    </div>
  );
}
