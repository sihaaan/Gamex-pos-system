import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileText, ReceiptText } from "lucide-react";
import { PrintButton } from "@/components/invoices/print-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAuthContext } from "@/lib/auth/session";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  customerInvoiceLineLabel,
  formatInvoiceDateTime,
  formatInvoicePercent,
  invoiceRefundStatus,
  invoiceSnapshotTotals,
  paymentDisplayText,
  tenderLabel,
} from "@/lib/invoices/display";
import { prisma } from "@/lib/prisma";
import { cn, formatPaise } from "@/lib/utils";

type InvoicePageProps = {
  params: Promise<{ invoiceId: string }>;
  searchParams?: Promise<{ mode?: string | string[] }>;
};

const invoiceInclude = {
  creditNotes: {
    orderBy: { postedAt: "asc" },
    include: {
      refundPayments: { orderBy: { refundedAt: "asc" } },
      lines: { orderBy: { createdAt: "asc" } },
    },
  },
  lines: { orderBy: { createdAt: "asc" } },
  operatorShift: {
    select: {
      id: true,
      openedAt: true,
      staffUser: { select: { name: true } },
    },
  },
  payments: { orderBy: { receivedAt: "asc" } },
  tab: {
    select: {
      customerLabel: true,
      customerName: true,
      customerPhone: true,
    },
  },
} satisfies Prisma.GstInvoiceInclude;

type InvoiceRecord = Prisma.GstInvoiceGetPayload<{
  include: typeof invoiceInclude;
}>;

export default async function InvoicePage({
  params,
  searchParams,
}: InvoicePageProps) {
  const auth = await getAuthContext();
  if (!auth) {
    redirect("/login");
  }

  const { invoiceId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const rawMode = resolvedSearchParams.mode;
  const mode = Array.isArray(rawMode) ? rawMode[0] : rawMode;
  const receiptMode = mode === "receipt";

  const invoice = await prisma.gstInvoice.findFirst({
    where: { id: invoiceId, legalEntityId: auth.legalEntityId },
    include: invoiceInclude,
  });

  if (!invoice) {
    notFound();
  }

  const totals = invoiceSnapshotTotals(invoice);
  const paymentTotal = invoice.payments.reduce(
    (total, payment) => total + payment.amount,
    0,
  );
  const refundTotal = invoice.creditNotes
    .filter((creditNote) => creditNote.status === "POSTED")
    .reduce((total, creditNote) => total + creditNote.totalAmount, 0);
  const displayStatus = invoiceRefundStatus({
    invoiceStatus: invoice.status,
    invoiceTotal: invoice.totalAmount,
    creditNotes: invoice.creditNotes,
  });
  const customerName =
    invoice.customerName || invoice.tab.customerLabel || "Walk-in customer";
  const invoiceHref = `/invoices/${invoice.id}`;
  const receiptHref = `/invoices/${invoice.id}?mode=receipt`;

  return (
    <main
      className={cn(
        "mx-auto grid gap-4 px-4 py-4 sm:px-6 lg:px-8 print:p-0",
        receiptMode ? "max-w-3xl" : "max-w-6xl",
      )}
    >
      <section className="print-controls flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/pos">
              <ArrowLeft className="h-4 w-4" />
              Back to POS
            </Link>
          </Button>
          {receiptMode ? (
            <Button asChild variant="secondary">
              <Link href={invoiceHref}>
                <FileText className="h-4 w-4" />
                GST invoice
              </Link>
            </Button>
          ) : (
            <Button asChild variant="secondary">
              <Link href={receiptHref}>
                <ReceiptText className="h-4 w-4" />
                Receipt view
              </Link>
            </Button>
          )}
          {invoice.creditNotes.length > 0 ? (
            <Button asChild variant="secondary">
              <a href="#credit-notes">View refund / credit note</a>
            </Button>
          ) : null}
        </div>
        <PrintButton>{receiptMode ? "Print receipt" : "Print invoice"}</PrintButton>
      </section>

      {receiptMode ? (
        <ReceiptView
          customerName={customerName}
          displayStatus={displayStatus}
          invoice={invoice}
          paymentTotal={paymentTotal}
          refundTotal={refundTotal}
          totals={totals}
        />
      ) : (
        <InvoiceView
          customerName={customerName}
          displayStatus={displayStatus}
          invoice={invoice}
          paymentTotal={paymentTotal}
          refundTotal={refundTotal}
          totals={totals}
        />
      )}
    </main>
  );
}

type TotalsRecord = ReturnType<typeof invoiceSnapshotTotals>;

function InvoiceView({
  customerName,
  displayStatus,
  invoice,
  paymentTotal,
  refundTotal,
  totals,
}: {
  customerName: string;
  displayStatus: string;
  invoice: InvoiceRecord;
  paymentTotal: number;
  refundTotal: number;
  totals: TotalsRecord;
}) {
  return (
    <article className="invoice-print rounded-lg border border-zinc-200 bg-white p-6 shadow-sm print:border-0 print:p-0 print:shadow-none">
      <header className="print-avoid-break grid gap-4 border-b border-zinc-200 pb-5 md:grid-cols-[1fr_auto]">
        <div>
          <div className="flex items-center gap-2 text-emerald-800">
            <ReceiptText className="h-5 w-5 print:hidden" />
            <span className="text-sm font-semibold uppercase tracking-wide">
              GST Tax Invoice
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            {invoice.legalEntityName}
          </h1>
          <div className="mt-2 grid gap-1 text-sm text-zinc-700">
            {invoice.legalEntityGstin ? <p>GSTIN {invoice.legalEntityGstin}</p> : null}
            <p>{invoice.legalEntityAddress}</p>
            <p>
              {invoice.branchName} - {invoice.branchAddress}
            </p>
          </div>
        </div>
        <div className="grid gap-2 text-sm md:min-w-72">
          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-600">Invoice no.</span>
            <span className="font-semibold">{invoice.invoiceNumber}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-600">Date/time</span>
            <span className="font-medium">
              {formatInvoiceDateTime(invoice.postedAt)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-600">Cashier</span>
            <span className="font-medium">{invoice.operatorShift.staffUser.name}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-600">Status</span>
            <Badge tone={statusTone(displayStatus)}>{displayStatus}</Badge>
          </div>
        </div>
      </header>

      <section className="print-avoid-break grid gap-4 border-b border-zinc-200 py-5 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold">Customer</h2>
          <div className="mt-2 grid gap-1 text-sm text-zinc-700">
            <p className="font-medium text-zinc-950">{customerName}</p>
            {invoice.customerPhone ? <p>{invoice.customerPhone}</p> : null}
            {invoice.customerGstin ? <p>GSTIN {invoice.customerGstin}</p> : null}
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Payment</h2>
          <div className="mt-2 grid gap-1 text-sm text-zinc-700">
            <p>{invoice.payments.length > 1 ? "Mixed tender" : "Single tender"}</p>
            {invoice.payments.map((payment) => (
              <p key={payment.id}>{paymentDisplayText(payment)}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-x-auto py-5">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <th className="py-2 pr-3 font-semibold">Description</th>
              <th className="px-3 py-2 font-semibold">HSN/SAC</th>
              <th className="px-3 py-2 text-right font-semibold">Qty/Min</th>
              <th className="px-3 py-2 text-right font-semibold">Rate</th>
              <th className="px-3 py-2 text-right font-semibold">Taxable</th>
              <th className="px-3 py-2 text-right font-semibold">GST</th>
              <th className="px-3 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id} className="break-inside-avoid border-b border-zinc-100">
                <td className="py-3 pr-3 align-top">
                  <p className="font-medium text-zinc-950">
                    {customerInvoiceLineLabel(line)}
                  </p>
                </td>
                <td className="px-3 py-3 align-top">{line.hsnSac}</td>
                <td className="px-3 py-3 text-right align-top">
                  {line.lineKind === "SERVICE"
                    ? `${line.billableMinutes ?? 0} min`
                    : `x${line.quantity ?? 1}`}
                </td>
                <td className="px-3 py-3 text-right align-top">
                  {formatPaise(line.unitPrice)}
                </td>
                <td className="px-3 py-3 text-right align-top">
                  {formatPaise(line.taxableValue)}
                </td>
                <td className="px-3 py-3 text-right align-top">
                  {formatInvoicePercent(line.gstRate)}
                </td>
                <td className="px-3 py-3 text-right align-top font-semibold">
                  {formatPaise(line.totalAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="print-avoid-break grid gap-5 border-t border-zinc-200 pt-5 md:grid-cols-[1fr_22rem]">
        <PaymentPanel payments={invoice.payments} paymentTotal={paymentTotal} />
        <TotalsPanel refundTotal={refundTotal} totals={totals} />
      </section>

      {invoice.creditNotes.length > 0 ? (
        <CreditNotePanel creditNotes={invoice.creditNotes} />
      ) : null}
    </article>
  );
}

function ReceiptView({
  customerName,
  displayStatus,
  invoice,
  paymentTotal,
  refundTotal,
  totals,
}: {
  customerName: string;
  displayStatus: string;
  invoice: InvoiceRecord;
  paymentTotal: number;
  refundTotal: number;
  totals: TotalsRecord;
}) {
  return (
    <article className="receipt-print mx-auto w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-5 text-sm shadow-sm print:border-0 print:p-0 print:shadow-none">
      <header className="border-b border-dashed border-zinc-300 pb-3 text-center">
        <p className="text-base font-semibold">{invoice.legalEntityName}</p>
        <p className="text-xs text-zinc-600">{invoice.branchName}</p>
        {invoice.legalEntityGstin ? (
          <p className="text-xs text-zinc-600">GSTIN {invoice.legalEntityGstin}</p>
        ) : null}
      </header>

      <section className="grid gap-1 border-b border-dashed border-zinc-300 py-3 text-xs">
        <ReceiptMeta label="Invoice" value={invoice.invoiceNumber} />
        <ReceiptMeta label="Date" value={formatInvoiceDateTime(invoice.postedAt)} />
        <ReceiptMeta label="Cashier" value={invoice.operatorShift.staffUser.name} />
        <ReceiptMeta label="Customer" value={customerName} />
        <ReceiptMeta label="Status" value={displayStatus} />
      </section>

      <section className="grid gap-2 border-b border-dashed border-zinc-300 py-3">
        {invoice.lines.map((line) => (
          <div key={line.id} className="grid gap-1">
            <div className="flex items-start justify-between gap-3">
              <span className="font-medium">{customerInvoiceLineLabel(line)}</span>
              <span className="whitespace-nowrap font-semibold">
                {formatPaise(line.totalAmount)}
              </span>
            </div>
            <div className="flex justify-between gap-3 text-xs text-zinc-600">
              <span>
                {line.lineKind === "SERVICE"
                  ? `${line.billableMinutes ?? 0} min`
                  : `x${line.quantity ?? 1}`}{" "}
                at {formatPaise(line.unitPrice)}
              </span>
              <span>GST {formatInvoicePercent(line.gstRate)}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="print-avoid-break grid gap-1 border-b border-dashed border-zinc-300 py-3 text-xs">
        <ReceiptTotal label="Taxable" value={totals.taxableValue} />
        {totals.discountAmount > 0 ? (
          <ReceiptTotal label="Discount" value={-totals.discountAmount} />
        ) : null}
        <ReceiptTotal label="CGST" value={totals.cgstAmount} />
        <ReceiptTotal label="SGST" value={totals.sgstAmount} />
        <ReceiptTotal label="IGST" value={totals.igstAmount} />
        <ReceiptTotal label="GST total" value={totals.gstTotal} />
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-dashed border-zinc-300 pt-2 text-base font-semibold">
          <span>Total</span>
          <span>{formatPaise(totals.totalAmount)}</span>
        </div>
        {refundTotal > 0 ? (
          <ReceiptTotal label="Refunded" value={refundTotal} />
        ) : null}
      </section>

      <section className="grid gap-1 border-b border-dashed border-zinc-300 py-3 text-xs">
        {invoice.payments.map((payment) => (
          <ReceiptMeta
            key={payment.id}
            label={tenderLabel(payment.tenderType)}
            value={formatPaise(payment.amount)}
          />
        ))}
        <ReceiptMeta label="Payment total" value={formatPaise(paymentTotal)} />
      </section>

      <p className="pt-3 text-center text-xs font-medium">
        Thank you for playing at {invoice.branchName}.
      </p>
    </article>
  );
}

function PaymentPanel({
  payments,
  paymentTotal,
}: {
  payments: InvoiceRecord["payments"];
  paymentTotal: number;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold">Payments</h2>
      <div className="mt-2 grid gap-2 text-sm">
        {payments.map((payment) => (
          <div
            key={payment.id}
            className="flex items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-2 print:bg-white"
          >
            <span>
              {tenderLabel(payment.tenderType)}
              {payment.reference ? (
                <span className="ml-2 text-xs text-zinc-500">
                  {payment.reference}
                </span>
              ) : null}
            </span>
            <span className="font-semibold">{formatPaise(payment.amount)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 px-3 py-1 font-semibold">
          <span>{payments.length > 1 ? "Mixed tender total" : "Payment total"}</span>
          <span>{formatPaise(paymentTotal)}</span>
        </div>
      </div>
    </div>
  );
}

function TotalsPanel({
  refundTotal,
  totals,
}: {
  refundTotal: number;
  totals: TotalsRecord;
}) {
  return (
    <div className="grid gap-2 text-sm">
      <InvoiceTotalRow label="Taxable value" value={totals.taxableValue} />
      {totals.discountAmount > 0 ? (
        <InvoiceTotalRow label="Discount" value={-totals.discountAmount} />
      ) : null}
      <InvoiceTotalRow label="CGST" value={totals.cgstAmount} />
      <InvoiceTotalRow label="SGST" value={totals.sgstAmount} />
      <InvoiceTotalRow label="IGST" value={totals.igstAmount} />
      <InvoiceTotalRow label="GST total" value={totals.gstTotal} />
      <div className="flex items-center justify-between border-t border-zinc-200 pt-2 text-base font-semibold">
        <span>Final total</span>
        <span>{formatPaise(totals.totalAmount)}</span>
      </div>
      {refundTotal > 0 ? (
        <InvoiceTotalRow label="Refunded / credited" value={refundTotal} />
      ) : null}
    </div>
  );
}

function CreditNotePanel({
  creditNotes,
}: {
  creditNotes: InvoiceRecord["creditNotes"];
}) {
  return (
    <section
      className="print-avoid-break mt-5 border-t border-zinc-200 pt-5"
      id="credit-notes"
    >
      <h2 className="text-sm font-semibold">Refunds and credit notes</h2>
      <div className="mt-2 grid gap-2 text-sm">
        {creditNotes.map((creditNote) => (
          <div
            key={creditNote.id}
            className="rounded-md border border-zinc-200 p-3 print:border-zinc-300"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{creditNote.creditNoteNumber}</p>
                <p className="text-xs text-zinc-600">
                  {creditNote.reason} - {formatInvoiceDateTime(creditNote.postedAt)}
                </p>
              </div>
              <Badge tone={creditNote.status === "POSTED" ? "warning" : "danger"}>
                Credit note issued
              </Badge>
            </div>
            <div className="mt-2 grid gap-1">
              <InvoiceTotalRow label="Credit note total" value={creditNote.totalAmount} />
              {creditNote.refundPayments.map((refundPayment) => (
                <InvoiceTotalRow
                  key={refundPayment.id}
                  label={`${tenderLabel(refundPayment.tenderType)} refund`}
                  value={refundPayment.amount}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function InvoiceTotalRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-zinc-600">{label}</span>
      <span className="font-medium">{formatPaise(value)}</span>
    </div>
  );
}

function ReceiptMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-zinc-600">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function ReceiptTotal({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-zinc-600">{label}</span>
      <span className="font-medium">{formatPaise(value)}</span>
    </div>
  );
}

function statusTone(
  status: string,
): "neutral" | "success" | "warning" | "danger" {
  if (status === "Paid") {
    return "success";
  }
  if (status === "Partially refunded" || status === "Credit note issued") {
    return "warning";
  }
  if (status === "Refunded") {
    return "warning";
  }
  return "danger";
}
