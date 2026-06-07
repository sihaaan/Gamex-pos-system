import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ReceiptText } from "lucide-react";
import { PrintButton } from "@/components/invoices/print-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatPaise } from "@/lib/utils";

type InvoicePageProps = {
  params: Promise<{ invoiceId: string }>;
};

export default async function InvoicePage({ params }: InvoicePageProps) {
  const auth = await getAuthContext();
  if (!auth) {
    redirect("/login");
  }

  const { invoiceId } = await params;
  const invoice = await prisma.gstInvoice.findFirst({
    where: { id: invoiceId, legalEntityId: auth.legalEntityId },
    include: {
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
    },
  });

  if (!invoice) {
    notFound();
  }

  const gstTotal =
    invoice.cgstAmount + invoice.sgstAmount + invoice.igstAmount;
  const paymentTotal = invoice.payments.reduce(
    (total, payment) => total + payment.amount,
    0,
  );

  return (
    <main className="mx-auto grid max-w-5xl gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <section className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="secondary">
          <Link href="/pos">
            <ArrowLeft className="h-4 w-4" />
            POS
          </Link>
        </Button>
        <PrintButton />
      </section>

      <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-800">
              <ReceiptText className="h-5 w-5" />
              <span className="text-sm font-semibold">GST Invoice</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal">
              {invoice.invoiceNumber}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Posted {formatKolkataDate(invoice.postedAt)}
            </p>
          </div>
          <Badge tone={invoice.status === "POSTED" ? "success" : "danger"}>
            {invoice.status}
          </Badge>
        </header>

        <section className="grid gap-4 border-b border-zinc-200 py-4 md:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold">Supplier</h2>
            <div className="mt-2 grid gap-1 text-sm text-zinc-700">
              <p className="font-medium text-zinc-950">
                {invoice.legalEntityName}
              </p>
              <p>GSTIN {invoice.legalEntityGstin}</p>
              <p>{invoice.legalEntityAddress}</p>
              <p>
                {invoice.branchName} - {invoice.branchAddress}
              </p>
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold">Customer</h2>
            <div className="mt-2 grid gap-1 text-sm text-zinc-700">
              <p className="font-medium text-zinc-950">
                {invoice.customerName ||
                  invoice.tab.customerLabel ||
                  "Walk-in customer"}
              </p>
              {invoice.customerPhone ? <p>{invoice.customerPhone}</p> : null}
              {invoice.customerGstin ? (
                <p>GSTIN {invoice.customerGstin}</p>
              ) : null}
              <p>Operator {invoice.operatorShift.staffUser.name}</p>
            </div>
          </div>
        </section>

        <section className="overflow-x-auto py-4">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                <th className="py-2 pr-3 font-semibold">Description</th>
                <th className="px-3 py-2 font-semibold">HSN/SAC</th>
                <th className="px-3 py-2 text-right font-semibold">Qty/Min</th>
                <th className="px-3 py-2 text-right font-semibold">Rate</th>
                <th className="px-3 py-2 text-right font-semibold">GST</th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.id} className="border-b border-zinc-100">
                  <td className="py-3 pr-3 align-top">
                    <p className="font-medium text-zinc-950">
                      {line.description}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {line.pricingRuleUsed} - {line.invoiceSeriesSnapshot}
                    </p>
                  </td>
                  <td className="px-3 py-3 align-top">{line.hsnSac}</td>
                  <td className="px-3 py-3 text-right align-top">
                    {line.billableMinutes ?? line.quantity ?? 1}
                  </td>
                  <td className="px-3 py-3 text-right align-top">
                    {formatPaise(line.unitPrice)}
                  </td>
                  <td className="px-3 py-3 text-right align-top">
                    {formatPercent(line.gstRate)}
                  </td>
                  <td className="px-3 py-3 text-right align-top font-semibold">
                    {formatPaise(line.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="grid gap-4 border-t border-zinc-200 pt-4 md:grid-cols-[1fr_20rem]">
          <div>
            <h2 className="text-sm font-semibold">Payments</h2>
            <div className="mt-2 grid gap-2 text-sm">
              {invoice.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-2"
                >
                  <span>
                    {tenderLabel(payment.tenderType)}
                    {payment.reference ? (
                      <span className="ml-2 text-xs text-zinc-500">
                        {payment.reference}
                      </span>
                    ) : null}
                  </span>
                  <span className="font-semibold">
                    {formatPaise(payment.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-2 text-sm">
            <InvoiceTotalRow label="Taxable value" value={invoice.taxableValue} />
            <InvoiceTotalRow label="CGST" value={invoice.cgstAmount} />
            <InvoiceTotalRow label="SGST" value={invoice.sgstAmount} />
            <InvoiceTotalRow label="IGST" value={invoice.igstAmount} />
            <InvoiceTotalRow label="GST total" value={gstTotal} />
            <InvoiceTotalRow label="Discount" value={invoice.discountAmount} />
            <div className="flex items-center justify-between border-t border-zinc-200 pt-2 text-base font-semibold">
              <span>Invoice total</span>
              <span>{formatPaise(invoice.totalAmount)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-zinc-600">
              <span>Payment total</span>
              <span>{formatPaise(paymentTotal)}</span>
            </div>
          </div>
        </section>
      </article>
    </main>
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

function formatKolkataDate(value: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

function formatPercent(value: unknown): string {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "0%";
  }
  return `${numericValue.toFixed(Number.isInteger(numericValue) ? 0 : 2)}%`;
}

function tenderLabel(tenderType: string): string {
  switch (tenderType) {
    case "CASH":
      return "Cash";
    case "UPI_GOOGLE_PAY":
      return "UPI - Google Pay";
    case "UPI_PHONEPE":
      return "UPI - PhonePe";
    case "UPI_OTHER":
      return "UPI - Other";
    case "CARD_RECORDED":
      return "Card recorded";
    default:
      return tenderType;
  }
}
