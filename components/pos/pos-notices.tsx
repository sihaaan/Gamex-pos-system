"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPaise } from "@/lib/utils";
import { invoiceLineMeta } from "./timing";
import type { PosController } from "./use-pos-controller";

export function ConnectionErrorBanner({
  controller,
}: {
  controller: PosController;
}) {
  const { state, actions } = controller;

  if (!state.connectionError) {
    return null;
  }

  return (
    <button
      className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-danger-line bg-danger-soft px-4 py-3 text-left text-sm font-semibold text-danger-ink transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
      onClick={actions.retryConnection}
      type="button"
    >
      <WifiOff className="h-5 w-5 shrink-0" />
      <span>
        Connection error - tap to retry.
        <span className="ml-2 font-normal">{state.connectionError}</span>
      </span>
    </button>
  );
}

export function ShiftClosedBanner({
  controller,
}: {
  controller: PosController;
}) {
  const { state } = controller;

  if (state.bootstrap?.activeShift || state.loading) {
    return null;
  }

  return (
    <section className="rounded-xl border border-warning-line bg-warning-soft p-4 text-warning-ink">
      <div className="flex flex-wrap items-center gap-3">
        <AlertTriangle className="h-5 w-5" />
        <div>
          <h2 className="text-base font-semibold">
            Open your shift to start selling.
          </h2>
          <p className="text-sm">
            Starting play, adding snacks, and checkout stay locked until the
            shift is open.
          </p>
        </div>
      </div>
    </section>
  );
}

export function MessageBanner({ controller }: { controller: PosController }) {
  const { state } = controller;

  if (!state.message) {
    return null;
  }

  return (
    <div
      className="rounded-lg border border-warning-line bg-warning-soft px-4 py-3 text-sm text-warning-ink"
      role="status"
    >
      {state.message}
    </div>
  );
}

export function PostedInvoiceCard({
  controller,
}: {
  controller: PosController;
}) {
  const invoice = controller.state.lastPostedInvoice;

  if (!invoice) {
    return null;
  }

  return (
    <section className="rounded-xl border border-success-line bg-success-soft p-4 text-success-ink">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          <div>
            <h2 className="text-base font-semibold">Invoice posted</h2>
            <p className="text-sm">
              {invoice.invoiceNumber} - {formatPaise(invoice.totalAmount)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="success">Server confirmed</Badge>
          <Button asChild variant="secondary">
            <Link href={`/invoices/${invoice.id}`}>
              <ExternalLink className="h-4 w-4" />
              Open invoice
            </Link>
          </Button>
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-sm">
        {invoice.lines.map((line, index) => (
          <div
            key={line.id ?? line.sourceLineId ?? `${line.description}-${index}`}
            className="flex items-center justify-between gap-3 rounded-md bg-surface/70 px-3 py-2"
          >
            <span className="text-ink">
              {line.description}
              <span className="ml-2 text-xs text-success">
                {invoiceLineMeta(line)}
              </span>
            </span>
            <span className="font-semibold tabular-nums text-ink">
              {formatPaise(line.totalAmount)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ShiftSummaryCard({
  controller,
}: {
  controller: PosController;
}) {
  const { state, derived } = controller;
  const summary = state.lastShiftSummary;

  if (!summary) {
    return null;
  }

  const reviewItems = [...derived.shiftWarnings, ...derived.unusualActions];

  return (
    <section className="rounded-xl border border-success-line bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <div>
            <h2 className="text-base font-semibold text-ink">Shift summary</h2>
            <p className="text-sm text-ink-muted">
              Net sales {formatPaise(summary.netSales)} - GST{" "}
              {formatPaise(summary.gstCollected)}
            </p>
          </div>
        </div>
        {summary.activeTabCount > 0 ? (
          <Badge tone="warning">
            {summary.activeTabCount} open tab
            {summary.activeTabCount === 1 ? "" : "s"}
          </Badge>
        ) : (
          <Badge tone="success">No open tabs</Badge>
        )}
      </div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <SummaryMetric label="Gross sales" value={summary.grossSales} />
        <SummaryMetric label="Discounts" value={summary.discounts} />
        <SummaryMetric label="Refunds" value={summary.refunds} />
        <SummaryMetric label="Voids" value={summary.voidedAmount} />
        <SummaryMetric label="Cash" value={summary.cashTotal} />
        <SummaryMetric label="Google Pay" value={summary.upiGooglePayTotal} />
        <SummaryMetric label="PhonePe" value={summary.upiPhonePeTotal} />
        <SummaryMetric label="Card" value={summary.cardRecordedTotal} />
      </div>
      {reviewItems.length > 0 ? (
        <div className="mt-3 rounded-md border border-warning-line bg-warning-soft p-3 text-sm text-warning-ink">
          <div className="mb-1 flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Review before handover
          </div>
          {reviewItems.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-line bg-surface-muted px-3 py-2">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="font-semibold tabular-nums text-ink">{formatPaise(value)}</p>
    </div>
  );
}
