"use client";

import { CreditCard, Plus, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { TenderType } from "./types";
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
