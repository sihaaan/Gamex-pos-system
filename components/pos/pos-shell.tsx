"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CirclePause,
  CirclePlay,
  CreditCard,
  ExternalLink,
  LogOut,
  MoveRight,
  Plus,
  ReceiptText,
  Square,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OfflineStatus } from "@/components/pwa/offline-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveDraftAction } from "@/lib/offline/draft-queue";
import { formatPaise } from "@/lib/utils";

type Bootstrap = {
  user: { name: string; role: string; branchId: string | null };
  branches: Branch[];
  resources: Resource[];
  services: Service[];
  products: Product[];
  activeShift: OperatorShift | null;
};

type Branch = { id: string; name: string; code: string };
type Resource = {
  id: string;
  branchId: string;
  name: string;
  kind: "POOL_TABLE" | "CONSOLE";
  status: "AVAILABLE" | "OCCUPIED" | "PAUSED" | "MAINTENANCE";
};
type Service = {
  id: string;
  name: string;
  description: string;
  pricingRule: { ratePerMinute: number };
};
type Product = {
  id: string;
  name: string;
  unitPrice: number;
  stockQuantity: number;
};
type OperatorShift = {
  id: string;
  branchId: string;
  openedAt: string;
  status: "OPEN" | "CLOSED" | "REOPENED";
};
type Tab = {
  id: string;
  branchId: string;
  customerLabel: string | null;
  customerName: string | null;
  status: string;
  timedLines: TimedLine[];
  retailLines: RetailLine[];
};
type TimedLine = {
  id: string;
  status: "RUNNING" | "PAUSED" | "STOPPED" | "CLOSED" | "VOIDED";
  descriptionSnapshot: string;
  resourceId: string | null;
  resource?: { name: string } | null;
};
type RetailLine = {
  id: string;
  descriptionSnapshot: string;
  quantity: number;
  unitPriceSnapshot: number;
};
type InvoiceLine = {
  id?: string;
  sourceLineId: string | null;
  lineKind: "SERVICE" | "RETAIL" | string;
  description: string;
  hsnSac: string;
  gstRatePercent?: number;
  gstRate?: number | string;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  unitPrice: number;
  quantity?: number | null;
  billableMinutes?: number | null;
  pricingRuleUsed: string;
  invoiceSeriesSnapshot: string;
};
type TenderType =
  | "CASH"
  | "UPI_GOOGLE_PAY"
  | "UPI_PHONEPE"
  | "UPI_OTHER"
  | "CARD_RECORDED";
type PaymentDraft = {
  id: string;
  tenderType: TenderType;
  amount: string;
  reference: string;
};
type NormalizedPaymentDraft = {
  tenderType: TenderType;
  amount: number;
  reference?: string;
};
type CheckoutQuote = {
  lines: InvoiceLine[];
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  discountAmount: number;
  totalAmount: number;
  hasActiveTimedLines: boolean;
  serverNow: string;
};
type PostedInvoice = {
  id: string;
  invoiceNumber: string;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  discountAmount: number;
  totalAmount: number;
  postedAt: string;
  lines: InvoiceLine[];
};
type ShiftCloseSummary = {
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
  warnings: unknown;
  unusualActions: unknown;
  generatedAt: string;
};

export function PosShell() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedTabId, setSelectedTabId] = useState("");
  const [movingTimedLineId, setMovingTimedLineId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [paymentDrafts, setPaymentDrafts] = useState<PaymentDraft[]>([
    createPaymentDraft("payment-1"),
  ]);
  const paymentsEditedRef = useRef(false);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [customerLabel, setCustomerLabel] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [lastPostedInvoice, setLastPostedInvoice] =
    useState<PostedInvoice | null>(null);
  const [lastShiftSummary, setLastShiftSummary] =
    useState<ShiftCloseSummary | null>(null);
  const [closeShiftArmed, setCloseShiftArmed] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [loading, setLoading] = useState(true);

  async function refresh(options?: { branchId?: string; preferredTabId?: string }) {
    setLoading(true);
    const bootstrapResponse = await fetch("/api/pos/bootstrap", {
      cache: "no-store",
    });
    if (bootstrapResponse.status === 401) {
      window.location.href = "/login";
      return;
    }
    const bootstrapData = (await bootstrapResponse.json()) as Bootstrap;
    setBootstrap(bootstrapData);
    const branchId =
      options?.branchId ||
      selectedBranchId ||
      bootstrapData.activeShift?.branchId ||
      bootstrapData.branches[0]?.id ||
      "";
    setSelectedBranchId(branchId);
    setSelectedProductId((current) => current || bootstrapData.products[0]?.id || "");

    const tabsResponse = await fetch(
      branchId ? `/api/tabs?branchId=${branchId}` : "/api/tabs",
      { cache: "no-store" },
    );
    const tabsData = (await tabsResponse.json()) as { tabs: Tab[] };
    const nextTabs = tabsData.tabs ?? [];
    const preferredTabId = options?.preferredTabId ?? selectedTabId;
    const nextSelectedTabId =
      nextTabs.find((tab) => tab.id === preferredTabId)?.id ??
      nextTabs[0]?.id ??
      "";
    setTabs(nextTabs);
    setSelectedTabId(nextSelectedTabId);
    setMovingTimedLineId((current) =>
      nextTabs.some((tab) =>
        tab.timedLines.some((line) => line.id === current && line.status === "RUNNING"),
      )
        ? current
        : "",
    );
    if (!nextSelectedTabId) {
      setQuote(null);
      resetPaymentDrafts();
    }
    setLoading(false);
  }

  const refreshQuote = useCallback(async (tabId: string) => {
    setQuoteLoading(true);
    const response = await fetch(
      `/api/checkout/quote?tabId=${encodeURIComponent(tabId)}`,
      { cache: "no-store" },
    );
    setQuoteLoading(false);

    if (!response.ok) {
      setQuote(null);
      return;
    }

    const payload = (await response.json()) as { quote: CheckoutQuote };
    setQuote(payload.quote);
    if (!paymentsEditedRef.current) {
      setPaymentDrafts([
        createPaymentDraft(
          "payment-1",
          payload.quote.totalAmount > 0
            ? paiseToRupeeInput(payload.quote.totalAmount)
            : "",
        ),
      ]);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      refresh().catch((error: unknown) => {
        setLoading(false);
        setMessage(
          error instanceof Error ? error.message : "Unable to load POS.",
        );
      });
    }, 0);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!selectedTabId) {
        setQuote(null);
        return;
      }
      refreshQuote(selectedTabId).catch(() => setQuote(null));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [refreshQuote, selectedTabId, tabs]);

  const selectedTab = tabs.find((tab) => tab.id === selectedTabId) ?? null;
  const currentBranchId =
    selectedBranchId ||
    bootstrap?.activeShift?.branchId ||
    bootstrap?.branches[0]?.id ||
    "";
  const timedLines = selectedTab?.timedLines ?? [];
  const activeTimedLines = timedLines.filter(isLiveTimedLine);
  const canStartTimedSession = Boolean(
    bootstrap?.activeShift &&
      selectedTabId &&
      !actionPending,
  );
  const branchResources = useMemo(
    () =>
      bootstrap?.resources.filter(
        (resource) => resource.branchId === currentBranchId,
      ) ?? [],
    [bootstrap?.resources, currentBranchId],
  );
  const paymentSummary = useMemo(
    () => summarizePaymentDrafts(paymentDrafts),
    [paymentDrafts],
  );
  const paymentBalance = quote
    ? quote.totalAmount - paymentSummary.totalAmount
    : 0;
  const canPostCheckout = Boolean(
    quote &&
      quote.totalAmount > 0 &&
      !quote.hasActiveTimedLines &&
      paymentSummary.payments.length > 0 &&
      !paymentSummary.hasInvalidAmount &&
      paymentBalance === 0 &&
      !actionPending,
  );

  async function postJson<TPayload>(
    path: string,
    body: Record<string, unknown>,
    options?: { offlineDraft?: boolean; successMessage?: string },
  ): Promise<TPayload | null> {
    setLastPostedInvoice(null);
    setLastShiftSummary(null);

    if (!navigator.onLine) {
      if (options?.offlineDraft) {
        await saveDraftAction({
          id: crypto.randomUUID(),
          actionType: "TAB_DRAFT",
          payload: { path, body },
          createdAt: new Date().toISOString(),
          status: "DRAFT_NOT_POSTED",
        });
        setMessage("Saved as Draft / Not Posted. Reconnect before posting.");
        return null;
      }

      setMessage("You are offline. Reconnect before posting this action.");
      return null;
    }

    setActionPending(true);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        error?: { message?: string };
      } & TPayload;
      if (!response.ok) {
        setMessage(payload.error?.message ?? "Action failed.");
        return null;
      }
      setMessage(options?.successMessage ?? "Posted.");
      await refresh();
      return payload;
    } finally {
      setActionPending(false);
    }
  }

  async function openShift() {
    if (!currentBranchId) {
      setMessage("Select a branch first.");
      return;
    }
    setSelectedBranchId(currentBranchId);
    setCloseShiftArmed(false);
    await postJson("/api/shifts/open", { branchId: currentBranchId }, {
      successMessage: "Shift opened.",
    });
  }

  async function closeShift() {
    if (!bootstrap?.activeShift) {
      setMessage("No active shift is open.");
      return;
    }
    if (tabs.length > 0 && !closeShiftArmed) {
      setCloseShiftArmed(true);
      setMessage(
        `${tabs.length} open tab${tabs.length === 1 ? "" : "s"} still need attention. Close shift again to confirm.`,
      );
      return;
    }
    const payload = await postJson<{ summary: ShiftCloseSummary }>(
      "/api/shifts/close",
      { operatorShiftId: bootstrap.activeShift.id },
      { successMessage: "Shift closed." },
    );
    if (payload?.summary) {
      setLastShiftSummary(payload.summary);
      setCloseShiftArmed(false);
    }
  }

  async function createTab() {
    const payload = await postJson<{ tab: Tab }>(
      "/api/tabs",
      {
        branchId: currentBranchId,
        customerLabel: customerLabel || undefined,
      },
      { offlineDraft: true, successMessage: "Tab created." },
    );
    setCustomerLabel("");
    if (payload?.tab) {
      setSelectedTabId(payload.tab.id);
      await refresh({ branchId: currentBranchId, preferredTabId: payload.tab.id });
    }
  }

  async function startSession(resource: Resource) {
    if (!selectedTabId) {
      setMessage("Select or create a customer tab first.");
      return;
    }

    const service = findServiceForResource(resource, bootstrap?.services ?? []);
    if (!service) {
      setMessage(`No timed service is configured for ${resourceLabel(resource.kind)}.`);
      return;
    }

    const payload = await postJson<{ timedLine: TimedLine }>(
      "/api/service-sessions/start",
      {
        tabId: selectedTabId,
        serviceCatalogId: service.id,
        resourceId: resource.id,
      },
      { successMessage: "Timed session started." },
    );
    if (payload?.timedLine) {
      setMovingTimedLineId("");
    }
  }

  async function moveTimedSession(line: TimedLine, resourceId: string) {
    if (line.status !== "RUNNING") {
      setMessage("Only a running timed session can be moved.");
      return;
    }

    const payload = await postJson<{ timedLine: TimedLine }>(
      "/api/service-sessions/transfer",
      {
        tabTimedLineId: line.id,
        toResourceId: resourceId,
      },
      { successMessage: "Timed session moved." },
    );
    if (payload?.timedLine) {
      setMovingTimedLineId("");
    }
  }

  async function addRetailLine() {
    if (!selectedTabId || !selectedProductId) {
      setMessage("Select a tab and product first.");
      return;
    }
    await postJson(
      `/api/tabs/${selectedTabId}/retail-lines`,
      {
        tabId: selectedTabId,
        productCatalogId: selectedProductId,
        quantity: 1,
      },
      { offlineDraft: true, successMessage: "Retail item added." },
    );
  }

  async function checkout() {
    if (!selectedTabId) {
      setMessage("Select a tab before checkout.");
      return;
    }
    if (quote?.hasActiveTimedLines) {
      setMessage("Stop all timed sessions before final checkout.");
      return;
    }
    if (!quote) {
      setMessage("Wait for the server total before checkout.");
      return;
    }
    if (paymentSummary.hasInvalidAmount) {
      setMessage("Use payment amounts like 500 or 500.50.");
      return;
    }
    if (paymentSummary.payments.length === 0) {
      setMessage("Enter at least one payment amount before checkout.");
      return;
    }
    if (paymentSummary.totalAmount !== quote.totalAmount) {
      setMessage(
        `Payment split is ${formatPaise(paymentSummary.totalAmount)}. Server total is ${formatPaise(quote.totalAmount)}.`,
      );
      return;
    }
    const payload = await postJson<{ invoice: PostedInvoice }>(
      "/api/checkout",
      {
        tabId: selectedTabId,
        payments: paymentSummary.payments,
      },
      { successMessage: "Checkout posted." },
    );
    if (payload?.invoice) {
      setLastPostedInvoice(payload.invoice);
      resetPaymentDrafts();
      setQuote(null);
      setMovingTimedLineId("");
    }
  }

  function handleTabSelect(tabId: string) {
    setSelectedTabId(tabId);
    setMovingTimedLineId("");
    resetPaymentDrafts();
    setQuote(null);
  }

  function handleBranchChange(branchId: string) {
    setSelectedBranchId(branchId);
    setSelectedTabId("");
    setMovingTimedLineId("");
    resetPaymentDrafts();
    setQuote(null);
    setCloseShiftArmed(false);
    setMessage(null);
    void refresh({ branchId, preferredTabId: "" });
  }

  function resetPaymentDrafts(amountPaise?: number) {
    setPaymentDrafts([
      createPaymentDraft(
        "payment-1",
        typeof amountPaise === "number" && amountPaise > 0
          ? paiseToRupeeInput(amountPaise)
          : "",
      ),
    ]);
    paymentsEditedRef.current = false;
  }

  function updatePaymentDraft(
    paymentDraftId: string,
    patch: Partial<Omit<PaymentDraft, "id">>,
  ) {
    paymentsEditedRef.current = true;
    setPaymentDrafts((current) =>
      current.map((draft) =>
        draft.id === paymentDraftId ? { ...draft, ...patch } : draft,
      ),
    );
  }

  function addPaymentDraft() {
    paymentsEditedRef.current = true;
    setPaymentDrafts((current) =>
      current.length >= 5
        ? current
        : [...current, createPaymentDraft(makePaymentDraftId())],
    );
  }

  function removePaymentDraft(paymentDraftId: string) {
    paymentsEditedRef.current = true;
    setPaymentDrafts((current) =>
      current.length === 1
        ? current
        : current.filter((draft) => draft.id !== paymentDraftId),
    );
  }

  function useTotalPayment() {
    if (!quote) {
      return;
    }
    resetPaymentDrafts(quote.totalAmount);
  }

  function fillPaymentRemainder(paymentDraftId: string) {
    if (!quote) {
      return;
    }

    paymentsEditedRef.current = true;
    setPaymentDrafts((current) => {
      const otherTotal = current.reduce((total, draft) => {
        if (draft.id === paymentDraftId) {
          return total;
        }
        return total + (parseRupeeInputToPaise(draft.amount) ?? 0);
      }, 0);
      const remainingAmount = Math.max(quote.totalAmount - otherTotal, 0);

      return current.map((draft) =>
        draft.id === paymentDraftId
          ? { ...draft, amount: paiseToRupeeInput(remainingAmount) }
          : draft,
      );
    });
  }

  const shiftWarnings = lastShiftSummary
    ? toStringArray(lastShiftSummary.warnings)
    : [];
  const unusualActions = lastShiftSummary
    ? toStringArray(lastShiftSummary.unusualActions)
    : [];

  return (
    <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <div>
          <h1 className="text-xl font-semibold tracking-normal">Counter POS</h1>
          <p className="text-sm text-zinc-600">
            {bootstrap?.user.name ?? "Operator"} - {bootstrap?.user.role ?? ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OfflineStatus />
          <select
            className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm"
            value={currentBranchId}
            onChange={(event) => handleBranchChange(event.target.value)}
          >
            {bootstrap?.branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          {loading && !bootstrap ? (
            <Badge>Loading</Badge>
          ) : bootstrap?.activeShift ? (
            <>
              <Badge tone="success">Shift open</Badge>
              {actionPending ? <Badge tone="warning">Posting</Badge> : null}
              <Button
                variant={closeShiftArmed ? "danger" : "secondary"}
                onClick={closeShift}
                disabled={actionPending}
              >
                <LogOut className="h-4 w-4" />
                {closeShiftArmed ? "Close anyway" : "Close shift"}
              </Button>
            </>
          ) : (
            <Button
              onClick={openShift}
              disabled={!currentBranchId || actionPending}
            >
              <CirclePlay className="h-4 w-4" />
              Open shift
            </Button>
          )}
        </div>
      </section>

      {message ? (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          {message}
        </div>
      ) : null}

      {lastPostedInvoice ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              <div>
                <h2 className="text-base font-semibold">Invoice posted</h2>
                <p className="text-sm">
                  {lastPostedInvoice.invoiceNumber} - {formatPaise(lastPostedInvoice.totalAmount)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="success">Server confirmed</Badge>
              <Button asChild className="bg-white" variant="secondary">
                <Link href={`/invoices/${lastPostedInvoice.id}`}>
                  <ExternalLink className="h-4 w-4" />
                  Open invoice
                </Link>
              </Button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 text-sm">
            {lastPostedInvoice.lines.map((line, index) => (
              <div
                key={line.id ?? line.sourceLineId ?? `${line.description}-${index}`}
                className="flex items-center justify-between gap-3 rounded-md bg-white/70 px-3 py-2"
              >
                <span>
                  {line.description}
                  <span className="ml-2 text-xs text-emerald-800">
                    {invoiceLineMeta(line)}
                  </span>
                </span>
                <span className="font-semibold">{formatPaise(line.totalAmount)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {lastShiftSummary ? (
        <section className="rounded-lg border border-emerald-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-700" />
              <div>
                <h2 className="text-base font-semibold">Shift summary</h2>
                <p className="text-sm text-zinc-600">
                  Net sales {formatPaise(lastShiftSummary.netSales)} - GST{" "}
                  {formatPaise(lastShiftSummary.gstCollected)}
                </p>
              </div>
            </div>
            {lastShiftSummary.activeTabCount > 0 ? (
              <Badge tone="warning">
                {lastShiftSummary.activeTabCount} open tab
                {lastShiftSummary.activeTabCount === 1 ? "" : "s"}
              </Badge>
            ) : (
              <Badge tone="success">No open tabs</Badge>
            )}
          </div>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <SummaryMetric label="Gross sales" value={lastShiftSummary.grossSales} />
            <SummaryMetric label="Discounts" value={lastShiftSummary.discounts} />
            <SummaryMetric label="Refunds" value={lastShiftSummary.refunds} />
            <SummaryMetric label="Voids" value={lastShiftSummary.voidedAmount} />
            <SummaryMetric label="Cash" value={lastShiftSummary.cashTotal} />
            <SummaryMetric label="Google Pay" value={lastShiftSummary.upiGooglePayTotal} />
            <SummaryMetric label="PhonePe" value={lastShiftSummary.upiPhonePeTotal} />
            <SummaryMetric label="Card" value={lastShiftSummary.cardRecordedTotal} />
          </div>
          {shiftWarnings.length > 0 || unusualActions.length > 0 ? (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <div className="mb-1 flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Review before handover
              </div>
              {[...shiftWarnings, ...unusualActions].map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Add session</h2>
                <p className="text-sm text-zinc-600">
                  Click an available Pool or PS5 resource to add it to the selected tab.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {branchResources.map((resource) => {
                const service = findServiceForResource(
                  resource,
                  bootstrap?.services ?? [],
                );
                const canStart =
                  resource.status === "AVAILABLE" &&
                  canStartTimedSession &&
                  Boolean(service);

                return (
                  <button
                    key={resource.id}
                    aria-label={
                      service
                        ? `Add ${service.name} on ${resource.name} to current tab`
                        : `Add timed session on ${resource.name} to current tab`
                    }
                    className="grid min-h-32 gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left transition hover:border-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!canStart}
                    onClick={() => startSession(resource)}
                  >
                    <span className="text-sm font-semibold">{resource.name}</span>
                    <span className="text-xs text-zinc-600">
                      {resourceLabel(resource.kind)}
                    </span>
                    <Badge tone={resourceBadgeTone(resource.status)}>
                      {formatStatus(resource.status)}
                    </Badge>
                    <span className="text-xs text-zinc-600">
                      {service
                        ? `${service.name} - ${formatPaise(service.pricingRule.ratePerMinute)}/min`
                        : "Timed service missing"}
                    </span>
                    {resource.status === "AVAILABLE" ? (
                      <span className="text-xs font-medium text-zinc-700">
                        {resourceStartState({
                          hasShift: Boolean(bootstrap?.activeShift),
                          hasTab: Boolean(selectedTabId),
                          hasService: Boolean(service),
                          actionPending,
                        })}
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {!loading && branchResources.length === 0 ? (
                <p className="col-span-full text-sm text-zinc-600">
                  No resources configured for this branch.
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Running tabs</h2>
              <div className="flex items-center gap-2">
                <Input
                  className="w-44"
                  placeholder="Name or table label"
                  value={customerLabel}
                  onChange={(event) => setCustomerLabel(event.target.value)}
                />
                <Button
                  onClick={createTab}
                  disabled={
                    !bootstrap?.activeShift || !currentBranchId || actionPending
                  }
                >
                  <Plus className="h-4 w-4" />
                  New tab
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              {tabs.map((tab) => {
                const liveTimedCount = tab.timedLines.filter(isLiveTimedLine).length;

                return (
                  <button
                    key={tab.id}
                    className={`rounded-md border p-3 text-left ${
                      selectedTabId === tab.id
                        ? "border-emerald-700 bg-emerald-50"
                        : "border-zinc-200 bg-white"
                    }`}
                    onClick={() => handleTabSelect(tab.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">
                        {tab.customerLabel || tab.customerName || "Walk-in tab"}
                      </span>
                      <span className="flex items-center gap-2">
                        {liveTimedCount > 0 ? (
                          <Badge tone="warning">{liveTimedCount} live</Badge>
                        ) : null}
                        <Badge>{tab.status}</Badge>
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-600">
                      {tab.timedLines.length} timed - {tab.retailLines.length} retail
                    </p>
                  </button>
                );
              })}
              {!loading && tabs.length === 0 ? (
                <p className="text-sm text-zinc-600">No open tabs.</p>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="grid content-start gap-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="text-base font-semibold">Selected tab</h2>
            {selectedTab ? (
              <div className="mt-3 grid gap-4">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">Timed sessions</p>
                    {activeTimedLines.length > 0 ? (
                      <Badge tone="warning">{activeTimedLines.length} active</Badge>
                    ) : (
                      <Badge>None active</Badge>
                    )}
                  </div>
                  {timedLines.map((line) => {
                    const isMoving = movingTimedLineId === line.id;
                    const moveTargetKind = resourceKindForTimedLine(line);
                    const availableMoveTargets = branchResources.filter(
                      (resource) =>
                        resource.status === "AVAILABLE" &&
                        (!moveTargetKind || resource.kind === moveTargetKind),
                    );

                    return (
                      <div
                        key={line.id}
                        className="rounded-md border border-zinc-200 bg-white p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-medium">
                                {line.descriptionSnapshot}
                              </span>
                              <Badge tone={timedLineBadgeTone(line.status)}>
                                {formatStatus(line.status)}
                              </Badge>
                            </span>
                            <span className="mt-1 block text-xs text-zinc-600">
                              {line.resource?.name ?? "No resource"}
                            </span>
                          </div>
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button
                              aria-label={`Pause ${line.descriptionSnapshot} on ${
                                line.resource?.name ?? "no resource"
                              }`}
                              className="h-9 px-2"
                              variant="secondary"
                              onClick={() => {
                                setMovingTimedLineId("");
                                void postJson(
                                  "/api/service-sessions/pause",
                                  { tabTimedLineId: line.id },
                                  { successMessage: "Timed session paused." },
                                );
                              }}
                              disabled={actionPending || line.status !== "RUNNING"}
                            >
                              <CirclePause className="h-4 w-4" />
                              Pause
                            </Button>
                            <Button
                              aria-label={`Resume ${line.descriptionSnapshot} on ${
                                line.resource?.name ?? "no resource"
                              }`}
                              className="h-9 px-2"
                              variant="secondary"
                              onClick={() => {
                                setMovingTimedLineId("");
                                void postJson(
                                  "/api/service-sessions/resume",
                                  { tabTimedLineId: line.id },
                                  { successMessage: "Timed session resumed." },
                                );
                              }}
                              disabled={actionPending || line.status !== "PAUSED"}
                            >
                              <CirclePlay className="h-4 w-4" />
                              Resume
                            </Button>
                            <Button
                              aria-label={`Stop ${line.descriptionSnapshot} on ${
                                line.resource?.name ?? "no resource"
                              }`}
                              className="h-9 px-2"
                              variant="secondary"
                              onClick={() => {
                                setMovingTimedLineId("");
                                void postJson(
                                  "/api/service-sessions/stop",
                                  { tabTimedLineId: line.id },
                                  { successMessage: "Timed session stopped." },
                                );
                              }}
                              disabled={
                                actionPending ||
                                (line.status !== "RUNNING" && line.status !== "PAUSED")
                              }
                            >
                              <Square className="h-4 w-4" />
                              Stop
                            </Button>
                            <Button
                              aria-label={`Move ${line.descriptionSnapshot} from ${
                                line.resource?.name ?? "no resource"
                              }`}
                              className="h-9 px-2"
                              variant="ghost"
                              onClick={() =>
                                setMovingTimedLineId((current) =>
                                  current === line.id ? "" : line.id,
                                )
                              }
                              disabled={actionPending || line.status !== "RUNNING"}
                            >
                              <MoveRight className="h-4 w-4" />
                              Move
                            </Button>
                          </div>
                        </div>
                        {isMoving ? (
                          <div className="mt-3 rounded-md bg-zinc-50 p-3">
                            <p className="mb-2 text-xs font-medium text-zinc-700">
                              Move this session to:
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {availableMoveTargets.map((resource) => (
                                <Button
                                  key={resource.id}
                                  variant="secondary"
                                  onClick={() => moveTimedSession(line, resource.id)}
                                  disabled={actionPending}
                                >
                                  <MoveRight className="h-4 w-4" />
                                  {resource.name}
                                </Button>
                              ))}
                            </div>
                            {availableMoveTargets.length === 0 ? (
                              <p className="text-sm text-zinc-600">
                                No available resources to move into.
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {timedLines.length === 0 ? (
                    <p className="rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                      No timed sessions on this tab.
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <select
                      className="min-h-10 flex-1 rounded-md border border-zinc-300 bg-white px-3 text-sm"
                      value={selectedProductId}
                      onChange={(event) => setSelectedProductId(event.target.value)}
                    >
                      {bootstrap?.products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} - {formatPaise(product.unitPrice)}
                        </option>
                      ))}
                    </select>
                    <Button
                      aria-label="Add retail item"
                      disabled={actionPending}
                      variant="secondary"
                      onClick={addRetailLine}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {selectedTab.retailLines.map((line) => (
                    <p key={line.id} className="text-sm text-zinc-700">
                      {line.quantity} x {line.descriptionSnapshot} -{" "}
                      {formatPaise(line.unitPriceSnapshot * line.quantity)}
                    </p>
                  ))}
                </div>

                <div className="grid gap-2 rounded-md border border-zinc-200 p-3">
                  <div className="flex items-center gap-2">
                    <ReceiptText className="h-4 w-4 text-emerald-700" />
                    <p className="text-sm font-semibold">Checkout</p>
                  </div>
                  <div className="rounded-md bg-zinc-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-zinc-600">
                        {quoteLoading ? "Calculating" : "Server total"}
                      </span>
                      <span className="text-lg font-semibold">
                        {quote ? formatPaise(quote.totalAmount) : "--"}
                      </span>
                    </div>
                    {quote ? (
                      <>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-zinc-600">
                          <span>CGST {formatPaise(quote.cgstAmount)}</span>
                          <span>SGST {formatPaise(quote.sgstAmount)}</span>
                          <span>IGST {formatPaise(quote.igstAmount)}</span>
                        </div>
                        <div className="mt-3 grid gap-1.5">
                          {quote.lines.map((line, index) => (
                            <div
                              key={
                                line.id ??
                                line.sourceLineId ??
                                `${line.description}-${index}`
                              }
                              className="flex items-center justify-between gap-3 text-sm"
                            >
                              <span className="min-w-0 truncate">
                                {line.description}
                                <span className="ml-2 text-xs text-zinc-500">
                                  {invoiceLineMeta(line)}
                                </span>
                              </span>
                              <span className="font-medium">
                                {formatPaise(line.totalAmount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : null}
                    {quote?.hasActiveTimedLines ? (
                      <p className="mt-2 text-xs font-medium text-amber-900">
                        Stop timed sessions before final checkout. This is a live estimate.
                      </p>
                    ) : null}
                  </div>
                  <div className="grid gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">Payment split</p>
                      <Badge tone={paymentBalance === 0 ? "success" : "warning"}>
                        {paymentBalanceLabel(paymentBalance)}
                      </Badge>
                    </div>
                    {paymentDrafts.map((paymentDraft, index) => (
                      <div
                        key={paymentDraft.id}
                        className="grid gap-2 rounded-md border border-zinc-200 bg-white p-2"
                      >
                        <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
                          <select
                            aria-label={`Tender ${index + 1}`}
                            className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm"
                            disabled={actionPending}
                            value={paymentDraft.tenderType}
                            onChange={(event) =>
                              updatePaymentDraft(paymentDraft.id, {
                                tenderType: event.target.value as TenderType,
                              })
                            }
                          >
                            <option value="UPI_GOOGLE_PAY">UPI - Google Pay</option>
                            <option value="UPI_PHONEPE">UPI - PhonePe</option>
                            <option value="UPI_OTHER">UPI - Other</option>
                            <option value="CARD_RECORDED">Card recorded</option>
                            <option value="CASH">Cash</option>
                          </select>
                          <Input
                            aria-label={`Tender ${index + 1} amount`}
                            disabled={actionPending}
                            inputMode="decimal"
                            placeholder="Amount"
                            value={paymentDraft.amount}
                            onChange={(event) =>
                              updatePaymentDraft(paymentDraft.id, {
                                amount: event.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                          <Input
                            aria-label={`Tender ${index + 1} reference`}
                            disabled={actionPending}
                            placeholder="UPI ref / note"
                            value={paymentDraft.reference}
                            onChange={(event) =>
                              updatePaymentDraft(paymentDraft.id, {
                                reference: event.target.value,
                              })
                            }
                          />
                          <Button
                            className="px-3"
                            disabled={!quote || actionPending}
                            onClick={() => fillPaymentRemainder(paymentDraft.id)}
                            variant="secondary"
                          >
                            Fill rest
                          </Button>
                          <Button
                            aria-label={`Remove tender ${index + 1}`}
                            className="px-3"
                            disabled={paymentDrafts.length === 1 || actionPending}
                            onClick={() => removePaymentDraft(paymentDraft.id)}
                            variant="ghost"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        variant="secondary"
                        onClick={addPaymentDraft}
                        disabled={paymentDrafts.length >= 5 || actionPending}
                      >
                        <Plus className="h-4 w-4" />
                        Add tender
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={useTotalPayment}
                        disabled={!quote || actionPending}
                      >
                        Use total
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 rounded-md bg-zinc-50 p-3 text-sm">
                      <span className="text-zinc-600">Payment total</span>
                      <span className="text-right font-semibold">
                        {formatPaise(paymentSummary.totalAmount)}
                      </span>
                      <span className="text-zinc-600">Server total</span>
                      <span className="text-right font-semibold">
                        {quote ? formatPaise(quote.totalAmount) : "--"}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={checkout}
                    disabled={!canPostCheckout}
                  >
                    <CreditCard className="h-4 w-4" />
                    Post checkout
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-600">
                Select or create a tab to start billing.
              </p>
            )}
          </div>

        </aside>
      </section>
    </main>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
      <p className="text-xs text-zinc-600">{label}</p>
      <p className="font-semibold text-zinc-950">{formatPaise(value)}</p>
    </div>
  );
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function invoiceLineMeta(line: InvoiceLine): string {
  if (line.lineKind === "SERVICE") {
    return `${line.billableMinutes ?? 0} min`;
  }

  return `${line.quantity ?? 1} x ${formatPaise(line.unitPrice)}`;
}

function createPaymentDraft(
  id: string,
  amount = "",
  tenderType: TenderType = "UPI_PHONEPE",
): PaymentDraft {
  return {
    id,
    tenderType,
    amount,
    reference: "",
  };
}

function makePaymentDraftId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `payment-${Date.now()}`;
}

function summarizePaymentDrafts(paymentDrafts: readonly PaymentDraft[]): {
  payments: NormalizedPaymentDraft[];
  totalAmount: number;
  hasInvalidAmount: boolean;
} {
  const payments: NormalizedPaymentDraft[] = [];
  let totalAmount = 0;
  let hasInvalidAmount = false;

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
    totalAmount += amount;
    payments.push({
      tenderType: paymentDraft.tenderType,
      amount,
      ...(reference ? { reference } : {}),
    });
  }

  return { payments, totalAmount, hasInvalidAmount };
}

function parseRupeeInputToPaise(value: string): number | null {
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

function paiseToRupeeInput(amount: number): string {
  return (amount / 100).toFixed(2);
}

function paymentBalanceLabel(balance: number): string {
  if (balance === 0) {
    return "Matched";
  }
  if (balance > 0) {
    return `${formatPaise(balance)} remaining`;
  }
  return `${formatPaise(Math.abs(balance))} over`;
}

function isLiveTimedLine(line: TimedLine): boolean {
  return line.status === "RUNNING" || line.status === "PAUSED";
}

function timedLineBadgeTone(
  status: TimedLine["status"],
): "neutral" | "success" | "warning" | "danger" {
  if (status === "RUNNING") {
    return "success";
  }
  if (status === "PAUSED") {
    return "warning";
  }
  if (status === "VOIDED") {
    return "danger";
  }
  return "neutral";
}

function formatStatus(status: string): string {
  return status.replaceAll("_", " ");
}

function findServiceForResource(
  resource: Resource,
  services: readonly Service[],
): Service | null {
  const candidates =
    resource.kind === "POOL_TABLE"
      ? ["pool"]
      : ["ps5", "console"];

  return (
    services.find((service) => {
      const searchable = `${service.name} ${service.description}`.toLowerCase();
      return candidates.some((candidate) => searchable.includes(candidate));
    }) ?? null
  );
}

function resourceLabel(kind: Resource["kind"]): string {
  return kind === "POOL_TABLE" ? "Pool table" : "PS5 console";
}

function resourceBadgeTone(
  status: Resource["status"],
): "neutral" | "success" | "warning" | "danger" {
  if (status === "AVAILABLE") {
    return "success";
  }
  if (status === "MAINTENANCE") {
    return "danger";
  }
  return "warning";
}

function resourceKindForTimedLine(line: TimedLine): Resource["kind"] | null {
  const description = line.descriptionSnapshot.toLowerCase();
  if (description.includes("pool")) {
    return "POOL_TABLE";
  }
  if (description.includes("ps5") || description.includes("console")) {
    return "CONSOLE";
  }
  return null;
}

function resourceStartState({
  hasShift,
  hasTab,
  hasService,
  actionPending,
}: {
  hasShift: boolean;
  hasTab: boolean;
  hasService: boolean;
  actionPending: boolean;
}): string {
  if (actionPending) {
    return "Posting";
  }
  if (!hasShift) {
    return "Open shift first";
  }
  if (!hasTab) {
    return "Select tab";
  }
  if (!hasService) {
    return "Service missing";
  }
  return "Ready to start";
}
