"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Download, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPaise } from "@/lib/utils";

type Role = "OWNER" | "MANAGER" | "STAFF";

type BranchOption = {
  id: string;
  name: string;
  code: string;
};

type ReportMeta = {
  currentUser: { role: Role; branchId: string | null; name: string };
  filters: {
    preset: string;
    from: string;
    to: string;
    branchId: string | null;
    staffUserId: string | null;
  };
  branches: BranchOption[];
};

type SalesPayload = ReportMeta & {
  summary: {
    grossSales: number;
    discounts: number;
    refunds: number;
    netSales: number;
    gstCollected: number;
    invoiceCount: number;
    averageBillValue: number;
  };
  byBranch: Array<{
    branchName: string;
    branchCode: string;
    grossSales: number;
    discounts: number;
    refunds: number;
    netSales: number;
    gstCollected: number;
    invoiceCount: number;
  }>;
  byDay: Array<{
    date: string;
    grossSales: number;
    discounts: number;
    refunds: number;
    netSales: number;
    gstCollected: number;
    invoiceCount: number;
  }>;
};

type TendersPayload = ReportMeta & {
  totalsByTender: Record<string, number>;
  mixedTenderInvoiceCount: number;
  rows: Array<{
    invoiceNumber: string;
    receivedAt: string;
    branchName: string;
    branchCode: string;
    operatorName: string;
    tenderLabel: string;
    amount: number;
    reference: string | null;
  }>;
};

type GstPayload = ReportMeta & {
  note: string;
  invoiceRows: Array<{
    invoiceNumber: string;
    invoiceDate: string;
    branchName: string;
    branchCode: string;
    customerName: string;
    customerGstin: string | null;
    taxableValue: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    totalGst: number;
    invoiceTotal: number;
    creditNoteAdjustment: number;
  }>;
  hsnSacSummary: Array<{
    hsnSac: string;
    description: string;
    quantityOrMinutes: number;
    taxableValue: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    totalGst: number;
    totalAmount: number;
  }>;
};

type ShiftsPayload = ReportMeta & {
  summaries: Array<{
    id: string;
    branchName: string;
    branchCode: string;
    operatorName: string;
    openedAt: string;
    closedAt: string | null;
    generatedAt: string;
    grossSales: number;
    discounts: number;
    refunds: number;
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
    unusualActionCount: number;
  }>;
  openShifts: Array<{
    id: string;
    branchName: string;
    branchCode: string;
    operatorName: string;
    openedAt: string;
    warning: string;
  }>;
};

type ExceptionsPayload = ReportMeta & {
  rows: Array<{
    occurredAt: string;
    action: string;
    actorName: string;
    managerApprover: string | null;
    branchName: string;
    target: string;
    amount: number | null;
    reason: string | null;
    metadataSummary: string;
  }>;
};

type ResourcePayload = ReportMeta & {
  rows: Array<{
    branchName: string;
    branchCode: string;
    resourceName: string;
    resourceType: string;
    sessionCount: number;
    totalBillableMinutes: number;
    totalActualElapsedMinutes: number;
    revenue: number;
    averageSessionDuration: number;
  }>;
};

type ProductPayload = ReportMeta & {
  rows: Array<{
    productName: string;
    branchName: string;
    branchCode: string;
    quantitySold: number;
    grossSales: number;
    gstCollected: number;
    currentStock: number | null;
    lowStock: boolean;
  }>;
};

type ReportsState = {
  sales: SalesPayload | null;
  tenders: TendersPayload | null;
  gst: GstPayload | null;
  shifts: ShiftsPayload | null;
  exceptions: ExceptionsPayload | null;
  resources: ResourcePayload | null;
  products: ProductPayload | null;
};

type TabKey =
  | "sales"
  | "tenders"
  | "gst"
  | "shifts"
  | "exceptions"
  | "resources"
  | "products"
  | "exports";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "sales", label: "Sales" },
  { key: "tenders", label: "Tenders" },
  { key: "gst", label: "GST / CA" },
  { key: "shifts", label: "Shifts" },
  { key: "exceptions", label: "Exceptions" },
  { key: "resources", label: "Resources" },
  { key: "products", label: "Products" },
  { key: "exports", label: "Exports" },
];

const initialReports: ReportsState = {
  sales: null,
  tenders: null,
  gst: null,
  shifts: null,
  exceptions: null,
  resources: null,
  products: null,
};

export function ReportsDashboard() {
  const [preset, setPreset] = useState("today");
  const [from, setFrom] = useState(todayInput());
  const [to, setTo] = useState(todayInput());
  const [branchId, setBranchId] = useState("ALL");
  const [activeTab, setActiveTab] = useState<TabKey>("sales");
  const [reports, setReports] = useState<ReportsState>(initialReports);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({ preset });
    if (preset === "custom") {
      params.set("from", from);
      params.set("to", to);
    }
    if (branchId !== "ALL") {
      params.set("branchId", branchId);
    }
    return params.toString();
  }, [branchId, from, preset, to]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        sales,
        tenders,
        gst,
        shifts,
        exceptions,
        resources,
        products,
      ] = await Promise.all([
        fetchReport<SalesPayload>(`/api/reports/sales?${query}`),
        fetchReport<TendersPayload>(`/api/reports/tenders?${query}`),
        fetchReport<GstPayload>(`/api/reports/gst?${query}`),
        fetchReport<ShiftsPayload>(`/api/reports/shifts?${query}`),
        fetchReport<ExceptionsPayload>(`/api/reports/exceptions?${query}`),
        fetchReport<ResourcePayload>(
          `/api/reports/resource-utilization?${query}`,
        ),
        fetchReport<ProductPayload>(`/api/reports/product-sales?${query}`),
      ]);
      setReports({ sales, tenders, gst, shifts, exceptions, resources, products });
      if (sales.currentUser.role === "MANAGER" && sales.currentUser.branchId) {
        setBranchId(sales.currentUser.branchId);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load reports.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const meta =
    reports.sales ??
    reports.tenders ??
    reports.gst ??
    reports.shifts ??
    reports.exceptions ??
    reports.resources ??
    reports.products;
  const owner = meta?.currentUser.role === "OWNER";

  return (
    <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <span className="brand-gradient grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-sm ring-1 ring-white/15">
              <BarChart3 className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-ink">
                Reports
              </h1>
              <p className="mt-0.5 text-sm text-ink-muted">
                Daily control, GST summaries, tender reconciliation, and CA
                exports from posted invoices and refunds.
              </p>
            </div>
          </div>
          <Button onClick={load} variant="secondary">
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-line bg-surface p-5 shadow-card lg:grid-cols-[1fr_1fr_auto]">
        <label className="grid gap-1 text-xs font-medium text-ink-muted">
          Date range
          <select
            className="min-h-10 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink"
            value={preset}
            onChange={(event) => setPreset(event.target.value)}
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7">Last 7 days</option>
            <option value="thisMonth">This month</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        {preset === "custom" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-medium text-ink-muted">
              From
              <input
                className="min-h-10 rounded-lg border border-line-strong px-3 text-sm"
                onChange={(event) => setFrom(event.target.value)}
                type="date"
                value={from}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-ink-muted">
              To
              <input
                className="min-h-10 rounded-lg border border-line-strong px-3 text-sm"
                onChange={(event) => setTo(event.target.value)}
                type="date"
                value={to}
              />
            </label>
          </div>
        ) : (
          <div className="grid content-end text-sm text-ink-muted">
            {meta ? (
              <span>
                {formatDate(meta.filters.from)} to {formatDate(meta.filters.to)}
              </span>
            ) : null}
          </div>
        )}
        <label className="grid gap-1 text-xs font-medium text-ink-muted">
          Branch
          <select
            className="min-h-10 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink disabled:bg-surface-strong"
            disabled={!owner}
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
          >
            {owner ? <option value="ALL">All branches</option> : null}
            {(meta?.branches ?? []).map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} ({branch.code})
              </option>
            ))}
          </select>
        </label>
      </section>

      {error ? (
        <div className="rounded-md border border-danger-line bg-danger-soft p-3 text-sm font-medium text-danger-ink">
          {error}
        </div>
      ) : null}

      <section className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            aria-current={activeTab === tab.key ? "true" : undefined}
            className={`rounded-lg border px-3.5 py-2 text-sm font-semibold transition ${
              activeTab === tab.key
                ? "border-brand bg-brand text-white shadow-sm dark:text-zinc-950"
                : "border-line bg-surface text-ink-muted hover:border-brand hover:text-ink"
            }`}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </section>

      {loading ? (
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-card text-sm text-ink-muted">
          Loading reports...
        </section>
      ) : null}

      {!loading ? (
        <>
          {activeTab === "sales" && reports.sales ? (
            <SalesReport payload={reports.sales} query={query} />
          ) : null}
          {activeTab === "tenders" && reports.tenders ? (
            <TenderReport payload={reports.tenders} query={query} />
          ) : null}
          {activeTab === "gst" && reports.gst ? (
            <GstReport payload={reports.gst} query={query} />
          ) : null}
          {activeTab === "shifts" && reports.shifts ? (
            <ShiftReportPanel payload={reports.shifts} query={query} />
          ) : null}
          {activeTab === "exceptions" && reports.exceptions ? (
            <ExceptionsReport payload={reports.exceptions} query={query} />
          ) : null}
          {activeTab === "resources" && reports.resources ? (
            <ResourceReport payload={reports.resources} query={query} />
          ) : null}
          {activeTab === "products" && reports.products ? (
            <ProductReport payload={reports.products} query={query} />
          ) : null}
          {activeTab === "exports" ? <ExportsPanel query={query} /> : null}
        </>
      ) : null}
    </main>
  );
}

function SalesReport({ payload, query }: { payload: SalesPayload; query: string }) {
  return (
    <ReportSection
      actions={<ExportLink href={`/api/reports/sales?${query}&format=csv`} />}
      title="Sales"
    >
      <SummaryGrid>
        <Metric label="Gross sales" value={formatPaise(payload.summary.grossSales)} />
        <Metric label="Discounts" value={formatPaise(payload.summary.discounts)} />
        <Metric label="Refunds" value={formatPaise(payload.summary.refunds)} />
        <Metric label="Net sales" value={formatPaise(payload.summary.netSales)} />
        <Metric label="GST collected" value={formatPaise(payload.summary.gstCollected)} />
        <Metric label="Invoices" value={String(payload.summary.invoiceCount)} />
        <Metric
          label="Average bill"
          value={formatPaise(payload.summary.averageBillValue)}
        />
      </SummaryGrid>
      <SimpleTable
        empty="No sales in this range."
        headers={["Branch", "Gross", "Discounts", "Refunds", "Net", "GST", "Invoices"]}
        rows={payload.byBranch.map((row) => [
          `${row.branchName} (${row.branchCode})`,
          formatPaise(row.grossSales),
          formatPaise(row.discounts),
          formatPaise(row.refunds),
          formatPaise(row.netSales),
          formatPaise(row.gstCollected),
          row.invoiceCount,
        ])}
      />
      <SimpleTable
        empty="No daily sales rows."
        headers={["Date", "Gross", "Discounts", "Refunds", "Net", "GST", "Invoices"]}
        rows={payload.byDay.map((row) => [
          row.date,
          formatPaise(row.grossSales),
          formatPaise(row.discounts),
          formatPaise(row.refunds),
          formatPaise(row.netSales),
          formatPaise(row.gstCollected),
          row.invoiceCount,
        ])}
      />
    </ReportSection>
  );
}

function TenderReport({
  payload,
  query,
}: {
  payload: TendersPayload;
  query: string;
}) {
  return (
    <ReportSection
      actions={<ExportLink href={`/api/reports/tenders?${query}&format=csv`} />}
      title="Tenders"
    >
      <SummaryGrid>
        <Metric label="Cash" value={formatPaise(payload.totalsByTender.CASH ?? 0)} />
        <Metric
          label="PhonePe"
          value={formatPaise(payload.totalsByTender.UPI_PHONEPE ?? 0)}
        />
        <Metric
          label="Google Pay"
          value={formatPaise(payload.totalsByTender.UPI_GOOGLE_PAY ?? 0)}
        />
        <Metric
          label="UPI other"
          value={formatPaise(payload.totalsByTender.UPI_OTHER ?? 0)}
        />
        <Metric
          label="Card recorded"
          value={formatPaise(payload.totalsByTender.CARD_RECORDED ?? 0)}
        />
        <Metric
          label="Mixed tender invoices"
          value={String(payload.mixedTenderInvoiceCount)}
        />
      </SummaryGrid>
      <SimpleTable
        empty="No payments in this range."
        headers={["Invoice", "Date/time", "Branch", "Operator", "Tender", "Amount", "Ref"]}
        rows={payload.rows.map((row) => [
          row.invoiceNumber,
          formatDateTime(row.receivedAt),
          `${row.branchName} (${row.branchCode})`,
          row.operatorName,
          row.tenderLabel,
          formatPaise(row.amount),
          row.reference ?? "",
        ])}
      />
    </ReportSection>
  );
}

function GstReport({ payload, query }: { payload: GstPayload; query: string }) {
  return (
    <ReportSection
      actions={
        <div className="flex flex-wrap gap-2">
          <ExportLink href={`/api/reports/gst?${query}&format=csv`}>
            Export invoices
          </ExportLink>
          <ExportLink href={`/api/reports/gst?${query}&format=csv&section=hsn-sac`}>
            Export HSN/SAC
          </ExportLink>
        </div>
      }
      title="GST / CA export"
    >
      <p className="rounded-md border border-warning-line bg-warning-soft p-3 text-sm text-warning-ink">
        {payload.note}
      </p>
      <SimpleTable
        empty="No posted invoices in this range."
        headers={[
          "Invoice",
          "Date",
          "Branch",
          "Customer",
          "GSTIN",
          "Taxable",
          "CGST",
          "SGST",
          "IGST",
          "Total",
          "Credit notes",
        ]}
        rows={payload.invoiceRows.map((row) => [
          row.invoiceNumber,
          formatDate(row.invoiceDate),
          `${row.branchName} (${row.branchCode})`,
          row.customerName,
          row.customerGstin ?? "",
          formatPaise(row.taxableValue),
          formatPaise(row.cgstAmount),
          formatPaise(row.sgstAmount),
          formatPaise(row.igstAmount),
          formatPaise(row.invoiceTotal),
          formatPaise(row.creditNoteAdjustment),
        ])}
      />
      <SimpleTable
        empty="No HSN/SAC rows."
        headers={[
          "HSN/SAC",
          "Category",
          "Qty/Min",
          "Taxable",
          "CGST",
          "SGST",
          "IGST",
          "GST",
          "Total",
        ]}
        rows={payload.hsnSacSummary.map((row) => [
          row.hsnSac,
          row.description,
          row.quantityOrMinutes,
          formatPaise(row.taxableValue),
          formatPaise(row.cgstAmount),
          formatPaise(row.sgstAmount),
          formatPaise(row.igstAmount),
          formatPaise(row.totalGst),
          formatPaise(row.totalAmount),
        ])}
      />
    </ReportSection>
  );
}

function ShiftReportPanel({
  payload,
  query,
}: {
  payload: ShiftsPayload;
  query: string;
}) {
  return (
    <ReportSection
      actions={<ExportLink href={`/api/reports/shifts?${query}&format=csv`} />}
      title="Shifts"
    >
      {payload.openShifts.length > 0 ? (
        <div className="rounded-md border border-warning-line bg-warning-soft p-3 text-sm text-warning-ink">
          {payload.openShifts.length} open shift(s) in scope. Final totals are
          available after close.
        </div>
      ) : null}
      <SimpleTable
        empty="No closed shift summaries in this range."
        headers={[
          "Closed",
          "Branch",
          "Operator",
          "Gross",
          "Discounts",
          "Refunds",
          "Net",
          "GST",
          "Active tabs",
          "Unusual",
        ]}
        rows={payload.summaries.map((row) => [
          formatDateTime(row.generatedAt),
          `${row.branchName} (${row.branchCode})`,
          row.operatorName,
          formatPaise(row.grossSales),
          formatPaise(row.discounts),
          formatPaise(row.refunds),
          formatPaise(row.netSales),
          formatPaise(row.gstCollected),
          row.activeTabCount,
          row.unusualActionCount,
        ])}
      />
    </ReportSection>
  );
}

function ExceptionsReport({
  payload,
  query,
}: {
  payload: ExceptionsPayload;
  query: string;
}) {
  return (
    <ReportSection
      actions={<ExportLink href={`/api/reports/exceptions?${query}&format=csv`} />}
      title="Exceptions"
    >
      <SimpleTable
        empty="No sensitive actions in this range."
        headers={[
          "Date/time",
          "Action",
          "Actor",
          "Manager",
          "Branch",
          "Amount",
          "Reason",
        ]}
        rows={payload.rows.map((row) => [
          formatDateTime(row.occurredAt),
          row.action,
          row.actorName,
          row.managerApprover ?? "",
          row.branchName,
          row.amount == null ? "" : formatPaise(row.amount),
          row.reason ?? row.metadataSummary,
        ])}
      />
    </ReportSection>
  );
}

function ResourceReport({
  payload,
  query,
}: {
  payload: ResourcePayload;
  query: string;
}) {
  return (
    <ReportSection
      actions={
        <ExportLink href={`/api/reports/resource-utilization?${query}&format=csv`} />
      }
      title="Resource utilization"
    >
      <SimpleTable
        empty="No posted resource usage in this range."
        headers={[
          "Resource",
          "Type",
          "Branch",
          "Sessions",
          "Billable min",
          "Actual min",
          "Revenue",
          "Avg min",
        ]}
        rows={payload.rows.map((row) => [
          row.resourceName,
          row.resourceType,
          `${row.branchName} (${row.branchCode})`,
          row.sessionCount,
          row.totalBillableMinutes,
          row.totalActualElapsedMinutes,
          formatPaise(row.revenue),
          row.averageSessionDuration,
        ])}
      />
    </ReportSection>
  );
}

function ProductReport({
  payload,
  query,
}: {
  payload: ProductPayload;
  query: string;
}) {
  return (
    <ReportSection
      actions={<ExportLink href={`/api/reports/product-sales?${query}&format=csv`} />}
      title="Product sales"
    >
      <SimpleTable
        empty="No product sales in this range."
        headers={["Product", "Branch", "Qty", "Gross", "GST", "Stock", "Low stock"]}
        rows={payload.rows.map((row) => [
          row.productName,
          `${row.branchName} (${row.branchCode})`,
          row.quantitySold,
          formatPaise(row.grossSales),
          formatPaise(row.gstCollected),
          row.currentStock ?? "",
          row.lowStock ? "Yes" : "No",
        ])}
      />
    </ReportSection>
  );
}

function ExportsPanel({ query }: { query: string }) {
  const exports = [
    ["Sales summary", `/api/reports/sales?${query}&format=csv`],
    ["Tender report", `/api/reports/tenders?${query}&format=csv`],
    ["GST invoice rows", `/api/reports/gst?${query}&format=csv`],
    ["GST HSN/SAC summary", `/api/reports/gst?${query}&format=csv&section=hsn-sac`],
    ["Shift summary", `/api/reports/shifts?${query}&format=csv`],
    ["Exceptions", `/api/reports/exceptions?${query}&format=csv`],
    [
      "Resource utilization",
      `/api/reports/resource-utilization?${query}&format=csv`,
    ],
    ["Product sales", `/api/reports/product-sales?${query}&format=csv`],
  ] as const;

  return (
    <ReportSection title="Exports">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {exports.map(([label, href]) => (
          <ExportLink key={label} href={href}>
            {label}
          </ExportLink>
        ))}
      </div>
    </ReportSection>
  );
}

function ReportSection({
  actions,
  children,
  title,
}: {
  actions?: React.ReactNode;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="grid gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold tracking-tight text-ink">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

function SummaryGrid({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      {children}
    </dl>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-muted p-3.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-bold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function SimpleTable({
  empty,
  headers,
  rows,
}: {
  empty: string;
  headers: readonly string[];
  rows: ReadonlyArray<ReadonlyArray<string | number>>;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line-strong bg-surface-muted p-4 text-sm text-ink-muted">
        {empty}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm tabular-nums">
        <thead>
          <tr className="border-b border-line bg-surface-muted text-xs uppercase text-ink-subtle">
            {headers.map((header) => (
              <th key={header} className="px-3 py-2.5 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              className="border-b border-line transition last:border-0 hover:bg-surface-muted"
            >
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2.5 align-top text-ink">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExportLink({
  children = "Export CSV",
  href,
}: {
  children?: React.ReactNode;
  href: string;
}) {
  return (
    <a
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-surface-strong"
      href={href}
    >
      <Download className="h-4 w-4" />
      {children}
    </a>
  );
}

async function fetchReport<TPayload>(url: string): Promise<TPayload> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(payload?.error?.message ?? "Unable to load reports.");
  }
  return (await response.json()) as TPayload;
}

function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}
