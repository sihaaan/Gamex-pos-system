"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatPaise } from "@/lib/utils";

type ShiftSummary = {
  id: string;
  grossSales: number;
  discounts: number;
  refunds: number;
  voidedAmount: number;
  netSales: number;
  gstCollected: number;
  cashTotal: number;
  upiGooglePayTotal: number;
  upiPhonePeTotal: number;
  upiOtherTotal: number;
  cardRecordedTotal: number;
  mixedTenderTotal: number;
  activeTabCount: number;
  warnings: string[];
  generatedAt: string;
  branch: { name: string; code: string };
  operatorShift: {
    staffUser: { name: string; email: string };
    openedAt: string;
    closedAt: string | null;
  };
};

export function ShiftReport() {
  const [summaries, setSummaries] = useState<ShiftSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/reports/shifts", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load shift summaries.");
        }
        return (await response.json()) as { summaries: ShiftSummary[] };
      })
      .then((payload) => setSummaries(payload.summaries))
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Unable to load reports."),
      );
  }, []);

  return (
    <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h1 className="text-xl font-semibold tracking-normal">Shift reports</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Branch reconciliation across sales, GST, tenders, refunds, voids, and warnings.
        </p>
      </section>
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      <section className="grid gap-3">
        {summaries.map((summary) => (
          <article
            key={summary.id}
            className="rounded-lg border border-zinc-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">
                  {summary.branch.name} · {summary.operatorShift.staffUser.name}
                </h2>
                <p className="text-sm text-zinc-600">
                  Closed {new Date(summary.generatedAt).toLocaleString("en-IN")}
                </p>
              </div>
              {summary.activeTabCount > 0 ? (
                <Badge tone="warning">{summary.activeTabCount} active tabs</Badge>
              ) : (
                <Badge tone="success">Closed cleanly</Badge>
              )}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:grid-cols-6">
              <Metric label="Gross" value={formatPaise(summary.grossSales)} />
              <Metric label="Discounts" value={formatPaise(summary.discounts)} />
              <Metric label="Refunds" value={formatPaise(summary.refunds)} />
              <Metric label="Net" value={formatPaise(summary.netSales)} />
              <Metric label="GST" value={formatPaise(summary.gstCollected)} />
              <Metric label="Mixed" value={formatPaise(summary.mixedTenderTotal)} />
              <Metric label="Cash" value={formatPaise(summary.cashTotal)} />
              <Metric label="Google Pay" value={formatPaise(summary.upiGooglePayTotal)} />
              <Metric label="PhonePe" value={formatPaise(summary.upiPhonePeTotal)} />
              <Metric label="UPI Other" value={formatPaise(summary.upiOtherTotal)} />
              <Metric label="Card" value={formatPaise(summary.cardRecordedTotal)} />
              <Metric label="Voids" value={formatPaise(summary.voidedAmount)} />
            </dl>
            {summary.warnings.length > 0 ? (
              <p className="mt-3 text-sm font-medium text-amber-900">
                {summary.warnings.join(" ")}
              </p>
            ) : null}
          </article>
        ))}
        {summaries.length === 0 ? (
          <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
            No closed shift summaries yet.
          </p>
        ) : null}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-zinc-500">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}
