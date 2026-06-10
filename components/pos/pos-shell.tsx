"use client";

import {
  AlertTriangle,
  ChevronDown,
  Check,
  CheckCircle2,
  CircleDot,
  CirclePause,
  CirclePlay,
  Clock,
  CreditCard,
  ExternalLink,
  Gamepad2,
  Lock,
  Monitor,
  MoveRight,
  Plus,
  ShoppingBasket,
  Square,
  Trash2,
  UserRound,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OfflineStatus } from "@/components/pwa/offline-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveDraftAction } from "@/lib/offline/draft-queue";
import {
  nextWalkInBillLabel,
  resourceStartBillLabel,
} from "@/lib/pos/bill-labels";
import {
  compactBillStats,
  staffBillStatus,
  staffInvoiceLineLabel,
  staffPaymentStatusLabel,
  staffServiceName,
} from "@/lib/pos/display";
import { formatPaise } from "@/lib/utils";

type Bootstrap = {
  user: { name: string; role: string; branchId: string | null };
  branches: Branch[];
  resources: Resource[];
  services: Service[];
  products: Product[];
  activeShift: OperatorShift | null;
  managerDiscountLimitPercent: number;
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
  sessionEvents?: SessionEvent[];
};
type SessionEvent = {
  eventType:
    | "STARTED"
    | "PAUSED"
    | "RESUMED"
    | "STOPPED"
    | "TRANSFERRED"
    | "CLOSED"
    | "MANUAL_ADJUSTED";
  occurredAt: string;
};
type TimedLineTiming = {
  startAt: Date | null;
  stopAt: Date | null;
  durationMs: number | null;
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
  grossAmount: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  automaticDiscountAmount: number;
  manualDiscountAmount: number;
  discountAmount: number;
  totalAmount: number;
  managerDiscountLimitPercent: number;
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
type StartPrompt = {
  resource: Resource;
  suggestedLabel: string;
};
type DiscountType = "AMOUNT" | "PERCENT";

export function PosShell() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedTabId, setSelectedTabId] = useState("");
  const [movingTimedLineId, setMovingTimedLineId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [startPrompt, setStartPrompt] = useState<StartPrompt | null>(null);
  const [startBillLabel, setStartBillLabel] = useState("");
  const [discountOpen, setDiscountOpen] = useState(false);
  const [billDetailsOpen, setBillDetailsOpen] = useState(false);
  const [expandedStoppedLineId, setExpandedStoppedLineId] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("AMOUNT");
  const [discountValue, setDiscountValue] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [managerEmailOrCode, setManagerEmailOrCode] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [managerOverrideId, setManagerOverrideId] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
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
  const [stopConfirmLineId, setStopConfirmLineId] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [loading, setLoading] = useState(true);

  const resetPaymentDrafts = useCallback((amountPaise?: number) => {
    setPaymentDrafts([
      createPaymentDraft(
        "payment-1",
        typeof amountPaise === "number" && amountPaise > 0
          ? paiseToRupeeInput(amountPaise)
          : "",
      ),
    ]);
    paymentsEditedRef.current = false;
  }, []);

  function resetDiscountDraft() {
    setDiscountOpen(false);
    setDiscountType("AMOUNT");
    setDiscountValue("");
    setDiscountReason("");
    setManagerEmailOrCode("");
    setManagerPassword("");
    setManagerOverrideId(null);
  }

  function removeDiscountDraft() {
    setDiscountOpen(false);
    setDiscountValue("");
    setDiscountReason("");
    setManagerEmailOrCode("");
    setManagerPassword("");
    setManagerOverrideId(null);
  }

  async function refresh(options?: {
    branchId?: string;
    preferredTabId?: string;
    clearSelection?: boolean;
  }) {
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
    const preferredTabId = options?.preferredTabId;
    const nextSelectedTabId = options?.clearSelection
      ? ""
      : preferredTabId
        ? nextTabs.find((tab) => tab.id === preferredTabId)?.id ?? ""
        : nextTabs.find((tab) => tab.id === selectedTabId)?.id ?? "";
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

  const refreshQuote = useCallback(async (tabId: string, discountAmount = 0) => {
    setQuoteLoading(true);
    const query = new URLSearchParams({ tabId });
    if (discountAmount > 0) {
      query.set("discountAmount", String(discountAmount));
    }
    const response = await fetch(`/api/checkout/quote?${query.toString()}`, {
      cache: "no-store",
    });
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
    const interval = window.setInterval(() => setClockNow(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const quoteGrossAmount = quote?.grossAmount ?? 0;
  const requestedDiscountAmount = useMemo(
    () =>
      calculateDiscountAmount({
        discountType,
        discountValue,
        grossAmount: quoteGrossAmount,
      }),
    [discountType, discountValue, quoteGrossAmount],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!selectedTabId) {
        setQuote(null);
        return;
      }
      refreshQuote(selectedTabId, requestedDiscountAmount).catch(() =>
        setQuote(null),
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [refreshQuote, requestedDiscountAmount, selectedTabId, tabs]);

  const selectedTab = tabs.find((tab) => tab.id === selectedTabId) ?? null;
  const isStaff = bootstrap?.user.role === "STAFF";
  const currentBranchId =
    selectedBranchId ||
    bootstrap?.activeShift?.branchId ||
    bootstrap?.branches[0]?.id ||
    "";
  const timedLines = selectedTab?.timedLines ?? [];
  const activeTimedLines = timedLines.filter(isLiveTimedLine);
  const currentBillLabel = selectedTab ? billLabel(selectedTab) : "No bill selected";
  const billDueLabel = quote?.hasActiveTimedLines ? "Running estimate" : "Amount due";
  const quoteServerNowMs = quote ? Date.parse(quote.serverNow) : Number.NaN;
  const timingNowMs = Number.isFinite(clockNow)
    ? clockNow
    : Number.isFinite(quoteServerNowMs)
      ? quoteServerNowMs
      : null;
  const canUseResourceBoard = Boolean(bootstrap?.activeShift && !actionPending);
  const branchResources = useMemo(
    () =>
      bootstrap?.resources.filter(
        (resource) => resource.branchId === currentBranchId,
      ) ?? [],
    [bootstrap?.resources, currentBranchId],
  );
  const resourceUseById = useMemo(() => {
    const uses = new Map<string, { tab: Tab; line: TimedLine }>();
    for (const tab of tabs) {
      for (const line of tab.timedLines) {
        if (line.resourceId && isLiveTimedLine(line)) {
          uses.set(line.resourceId, { tab, line });
        }
      }
    }
    return uses;
  }, [tabs]);
  const paymentSummary = useMemo(
    () => summarizePaymentDrafts(paymentDrafts),
    [paymentDrafts],
  );
  const paymentBalance = quote
    ? quote.totalAmount - paymentSummary.totalAmount
    : 0;
  const discountLimitPercent =
    quote?.managerDiscountLimitPercent ??
    bootstrap?.managerDiscountLimitPercent ??
    10;
  const requestedDiscountPercent =
    quoteGrossAmount > 0
      ? (requestedDiscountAmount / quoteGrossAmount) * 100
      : 0;
  const currentBillStatus = staffBillStatus({
    activeTimedLineCount: activeTimedLines.length,
    timedLineCount: timedLines.length,
    paymentBalance,
    totalAmount: quote?.totalAmount ?? 0,
  });
  const currentBillStats = compactBillStats({
    gameCount: timedLines.length,
    snackCount: selectedTab?.retailLines.length ?? 0,
    status: currentBillStatus,
  });
  const discountSummary =
    requestedDiscountAmount > 0 ? formatPaise(requestedDiscountAmount) : null;
  const automaticDiscountAmount = quote?.automaticDiscountAmount ?? 0;
  const automaticDiscountSummary =
    automaticDiscountAmount > 0 ? formatPaise(automaticDiscountAmount) : null;
  const totalDiscountSummary =
    quote && quote.discountAmount > 0 ? formatPaise(quote.discountAmount) : null;
  const paymentStatusLabel = quote
    ? staffPaymentStatusLabel({
        paymentTotal: paymentSummary.totalAmount,
        paymentBalance,
        hasActiveTimedLines: quote.hasActiveTimedLines,
        formatAmount: formatPaise,
      })
    : "Payment not ready";
  const paymentStatusTone = quote?.hasActiveTimedLines
    ? "bg-amber-50 text-amber-950"
    : paymentBalance === 0
      ? "bg-emerald-50 text-emerald-900"
      : "bg-amber-50 text-amber-950";
  const discountReasonMissing =
    requestedDiscountAmount > 0 && discountReason.trim().length === 0;
  const discountRequiresManagerApproval = Boolean(
    isStaff &&
      requestedDiscountAmount > 0 &&
      requestedDiscountPercent > discountLimitPercent &&
      !managerOverrideId,
  );
  const canPostCheckout = Boolean(
    quote &&
      quote.totalAmount > 0 &&
      !quote.hasActiveTimedLines &&
      !discountReasonMissing &&
      !discountRequiresManagerApproval &&
      paymentSummary.payments.length > 0 &&
      !paymentSummary.hasInvalidAmount &&
      paymentBalance === 0 &&
      !actionPending,
  );
  const checkoutButtonLabel = quote?.hasActiveTimedLines
    ? "Stop games to checkout"
    : "Post checkout";

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
    await postJson("/api/shifts/open", { branchId: currentBranchId }, {
      successMessage: "Shift opened.",
    });
  }

  async function closeShift() {
    if (!bootstrap?.activeShift) {
      setMessage("No active shift is open.");
      return;
    }
    if (tabs.length > 0) {
      setMessage(
        `Close blocked: finish checkout or void ${tabs.length} open bill${tabs.length === 1 ? "" : "s"} before closing shift.`,
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
    }
  }

  async function createTab() {
    const label = customerLabel.trim() || nextWalkInBillLabel(tabs);
    const payload = await postJson<{ tab: Tab }>(
      "/api/tabs",
      {
        branchId: currentBranchId,
        customerLabel: label,
      },
      { offlineDraft: true, successMessage: `${label} created.` },
    );
    setCustomerLabel("");
    if (payload?.tab) {
      setSelectedTabId(payload.tab.id);
      await refresh({ branchId: currentBranchId, preferredTabId: payload.tab.id });
    }
  }

  function openStartPrompt(resource: Resource) {
    if (!bootstrap?.activeShift) {
      setMessage("Open your shift to start selling.");
      return;
    }

    const service = findServiceForResource(resource, bootstrap.services);
    if (!service) {
      setMessage(`No timed service is configured for ${resourceLabel(resource.kind)}.`);
      return;
    }

    const suggestedLabel = resourceStartBillLabel(resource.name, tabs);
    setStartPrompt({ resource, suggestedLabel });
    setStartBillLabel(suggestedLabel);
    setMessage(null);
  }

  async function confirmStartPrompt() {
    if (!startPrompt) {
      return;
    }
    if (!navigator.onLine) {
      setMessage("Reconnect before starting play.");
      return;
    }

    const label = startBillLabel.trim() || startPrompt.suggestedLabel;
    const resource = startPrompt.resource;
    setStartPrompt(null);
    setStartBillLabel("");

    const payload = await postJson<{ tab: Tab }>(
      "/api/tabs",
      {
        branchId: currentBranchId,
        customerLabel: label,
      },
      { successMessage: `${label} created.` },
    );

    if (!payload?.tab) {
      return;
    }

    setSelectedTabId(payload.tab.id);
    await startSessionForTab(resource, payload.tab.id, label);
  }

  async function startSession(resource: Resource) {
    if (!selectedTabId || !selectedTab) {
      openStartPrompt(resource);
      return;
    }

    await startSessionForTab(resource, selectedTabId, billLabel(selectedTab));
  }

  async function startSessionForTab(
    resource: Resource,
    tabId: string,
    targetBillLabel: string,
  ) {
    const service = findServiceForResource(resource, bootstrap?.services ?? []);
    if (!service) {
      setMessage(`No timed service is configured for ${resourceLabel(resource.kind)}.`);
      return;
    }

    const payload = await postJson<{ timedLine: TimedLine }>(
      "/api/service-sessions/start",
      {
        tabId,
        serviceCatalogId: service.id,
        resourceId: resource.id,
      },
      { successMessage: `${resource.name} added to ${targetBillLabel}.` },
    );
    if (payload?.timedLine) {
      setSelectedTabId(tabId);
      setMovingTimedLineId("");
      setStopConfirmLineId("");
      await refresh({ branchId: currentBranchId, preferredTabId: tabId });
    }
  }

  async function moveTimedSession(line: TimedLine, resourceId: string) {
    if (line.status !== "RUNNING") {
      setMessage("Only a running game can be moved.");
      return;
    }

    const payload = await postJson<{ timedLine: TimedLine }>(
      "/api/service-sessions/transfer",
      {
        tabTimedLineId: line.id,
        toResourceId: resourceId,
      },
      { successMessage: "Game moved." },
    );
    if (payload?.timedLine) {
      setMovingTimedLineId("");
      setStopConfirmLineId("");
    }
  }

  async function pauseTimedLine(line: TimedLine) {
    setMovingTimedLineId("");
    setStopConfirmLineId("");
    await postJson(
      "/api/service-sessions/pause",
      { tabTimedLineId: line.id },
      { successMessage: "Game paused." },
    );
  }

  async function resumeTimedLine(line: TimedLine) {
    setMovingTimedLineId("");
    setStopConfirmLineId("");
    await postJson(
      "/api/service-sessions/resume",
      { tabTimedLineId: line.id },
      { successMessage: "Game resumed." },
    );
  }

  async function stopTimedLine(line: TimedLine) {
    if (stopConfirmLineId !== line.id) {
      setMovingTimedLineId("");
      setStopConfirmLineId(line.id);
      setMessage(
        `Tap Confirm stop on ${line.resource?.name ?? "this game"} to end billing for that game.`,
      );
      return;
    }

    setMovingTimedLineId("");
    setStopConfirmLineId("");
    await postJson(
      "/api/service-sessions/stop",
      { tabTimedLineId: line.id },
      { successMessage: "Game stopped." },
    );
  }

  async function addRetailLine(productId = selectedProductId) {
    if (!selectedTabId) {
      setMessage("Select or create a bill before adding snacks.");
      return;
    }
    if (!productId) {
      setMessage("Select a snack or drink first.");
      return;
    }
    const tabId = selectedTabId;
    const posted = await postJson(
      `/api/tabs/${selectedTabId}/retail-lines`,
      {
        tabId: selectedTabId,
        productCatalogId: productId,
        quantity: 1,
      },
      { offlineDraft: true, successMessage: "Snack or drink added." },
    );
    if (posted) {
      await refreshQuote(tabId, requestedDiscountAmount);
    }
  }

  async function approveDiscountOverride() {
    if (!selectedTabId || !quote) {
      setMessage("Select a bill before requesting approval.");
      return;
    }
    if (requestedDiscountAmount <= 0) {
      setMessage("Enter a discount before requesting approval.");
      return;
    }
    if (!discountReason.trim()) {
      setMessage("Enter a discount reason before requesting approval.");
      return;
    }
    if (!managerEmailOrCode.trim() || !managerPassword) {
      setMessage("Enter manager email and password.");
      return;
    }
    if (!navigator.onLine) {
      setMessage("Reconnect before requesting manager approval.");
      return;
    }

    setActionPending(true);
    try {
      const response = await fetch("/api/manager-overrides/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "HIGH_DISCOUNT",
          targetType: "tab",
          targetId: selectedTabId,
          branchId: currentBranchId,
          reason: discountReason.trim(),
          managerEmailOrCode,
          managerPassword,
        }),
      });
      const payload = (await response.json()) as {
        managerOverrideId?: string;
        error?: { message?: string };
      };
      if (!response.ok || !payload.managerOverrideId) {
        setMessage(payload.error?.message ?? "Manager approval failed.");
        return;
      }
      setManagerOverrideId(payload.managerOverrideId);
      setManagerPassword("");
      setMessage("Manager approved this discount.");
    } finally {
      setActionPending(false);
    }
  }

  async function checkout() {
    if (!selectedTabId) {
      setMessage("Select a customer bill before checkout.");
      return;
    }
    if (quote?.hasActiveTimedLines) {
      setMessage("Stop running games before checkout.");
      return;
    }
    if (discountReasonMissing) {
      setMessage("Enter a discount reason before checkout.");
      return;
    }
    if (discountRequiresManagerApproval) {
      setMessage("Manager approval is required for this discount.");
      return;
    }
    if (!quote) {
      setMessage("Wait for the final bill before checkout.");
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
        `Payment is ${formatPaise(paymentSummary.totalAmount)}. Amount due is ${formatPaise(quote.totalAmount)}.`,
      );
      return;
    }
    const payload = await postJson<{ invoice: PostedInvoice }>(
      "/api/checkout",
      {
        tabId: selectedTabId,
        payments: paymentSummary.payments,
        discountAmount: requestedDiscountAmount || undefined,
        discountReason:
          requestedDiscountAmount > 0 ? discountReason.trim() : undefined,
        managerOverrideId: managerOverrideId ?? undefined,
      },
      { successMessage: "Checkout posted." },
    );
    if (payload?.invoice) {
      setLastPostedInvoice(payload.invoice);
      setSelectedTabId("");
      setTabs((current) => current.filter((tab) => tab.id !== selectedTabId));
      resetPaymentDrafts();
      resetDiscountDraft();
      setQuote(null);
      setMovingTimedLineId("");
      setStopConfirmLineId("");
      setExpandedStoppedLineId("");
      setBillDetailsOpen(false);
    }
  }

  function handleTabSelect(tabId: string) {
    if (tabId === selectedTabId) {
      return;
    }
    setSelectedTabId(tabId);
    setMovingTimedLineId("");
    setStopConfirmLineId("");
    setExpandedStoppedLineId("");
    setStartPrompt(null);
    setStartBillLabel("");
    resetPaymentDrafts();
    resetDiscountDraft();
    setBillDetailsOpen(false);
    setQuote(null);
  }

  function handleBranchChange(branchId: string) {
    setSelectedBranchId(branchId);
    setSelectedTabId("");
    setMovingTimedLineId("");
    setStopConfirmLineId("");
    setExpandedStoppedLineId("");
    setStartPrompt(null);
    setStartBillLabel("");
    resetPaymentDrafts();
    resetDiscountDraft();
    setBillDetailsOpen(false);
    setQuote(null);
    setMessage(null);
    void refresh({ branchId, clearSelection: true });
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
    const currentPrimaryPayment = paymentDrafts[0];
    setPaymentDrafts([
      createPaymentDraft(
        "payment-1",
        paiseToRupeeInput(quote.totalAmount),
        currentPrimaryPayment?.tenderType ?? "UPI_PHONEPE",
        currentPrimaryPayment?.reference ?? "",
      ),
    ]);
    paymentsEditedRef.current = true;
    setMessage(`Payment updated to ${formatPaise(quote.totalAmount)}.`);
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
          <h1 className="text-xl font-semibold tracking-normal">Selling counter</h1>
          <p className="text-sm text-zinc-600">
            {bootstrap?.user.name ?? "Operator"} - {bootstrap?.user.role ?? ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OfflineStatus />
          {isStaff ? (
            <div className="inline-flex min-h-10 items-center gap-2 rounded-md border border-zinc-300 bg-zinc-50 px-3 text-sm font-medium text-zinc-700">
              <Lock className="h-4 w-4" />
              <span className="grid leading-tight">
                <span>
                  {branchName(currentBranchId, bootstrap?.branches ?? []) ||
                    "Assigned branch"}
                </span>
                <span className="text-xs font-normal text-zinc-500">
                  Branch locked
                </span>
              </span>
            </div>
          ) : (
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Branch
              <select
                className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950"
                value={currentBranchId}
                onChange={(event) => handleBranchChange(event.target.value)}
              >
                {bootstrap?.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {loading && !bootstrap ? (
            <Badge>Loading</Badge>
          ) : bootstrap?.activeShift ? (
            <>
              <Badge tone="success">Shift open</Badge>
              {actionPending ? <Badge tone="warning">Posting</Badge> : null}
              <Button
                aria-label="Close operator shift"
                className="ml-2 border-zinc-300 text-zinc-800 hover:bg-zinc-100"
                variant="secondary"
                onClick={closeShift}
                disabled={actionPending}
              >
                <CheckCircle2 className="h-4 w-4" />
                Close shift
              </Button>
            </>
          ) : (
            <Button
              className="min-h-12 px-5 text-base"
              onClick={openShift}
              disabled={!currentBranchId || actionPending}
            >
              <CirclePlay className="h-4 w-4" />
              Open shift
            </Button>
          )}
        </div>
      </section>

      {!bootstrap?.activeShift && !loading ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <div className="flex flex-wrap items-center gap-3">
            <AlertTriangle className="h-5 w-5" />
            <div>
              <h2 className="text-base font-semibold">
                Open your shift to start selling.
              </h2>
              <p className="text-sm">
                Starting play, adding snacks, and checkout stay locked until the shift is open.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {message ? (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          {message}
        </div>
      ) : null}

      {startPrompt ? (
        <div
          aria-labelledby="start-play-title"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/40 px-4"
          role="dialog"
        >
          <form
            className="grid w-full max-w-sm gap-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-xl"
            onSubmit={(event) => {
              event.preventDefault();
              void confirmStartPrompt();
            }}
          >
            <div>
              <h2
                className="text-lg font-semibold tracking-normal"
                id="start-play-title"
              >
                Start play on {startPrompt.resource.name}
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Create a bill and start this game in one step.
              </p>
            </div>
            <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
              Customer / table name
              <Input
                autoFocus
                value={startBillLabel}
                onChange={(event) => setStartBillLabel(event.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button
                disabled={actionPending}
                onClick={() => {
                  setStartPrompt(null);
                  setStartBillLabel("");
                }}
                type="button"
                variant="secondary"
              >
                Cancel
              </Button>
              <Button disabled={actionPending} type="submit">
                <CirclePlay className="h-4 w-4" />
                Start play
              </Button>
            </div>
          </form>
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

      <section className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(390px,0.95fr)] lg:items-start">
        <div className="grid min-h-0 gap-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Start play</h2>
                <p className="text-sm text-zinc-600">
                  Tap an available pool table or PS5 to start a bill or add to the current bill.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {branchResources.map((resource) => {
                const service = findServiceForResource(
                  resource,
                  bootstrap?.services ?? [],
                );
                const resourceUse = resourceUseById.get(resource.id) ?? null;
                const estimatedLine = quote?.lines.find(
                  (line) => line.sourceLineId === resourceUse?.line.id,
                );
                const canStart =
                  resource.status === "AVAILABLE" &&
                  canUseResourceBoard &&
                  Boolean(service);
                const startState = resourceStartState({
                  hasShift: Boolean(bootstrap?.activeShift),
                  hasService: Boolean(service),
                  actionPending,
                  currentBillLabel: selectedTab ? billLabel(selectedTab) : null,
                });

                if (resource.status === "AVAILABLE") {
                  return (
                    <button
                      key={resource.id}
                      aria-label={
                        service
                          ? `Start ${cashierServiceName(service)} on ${resource.name}`
                          : `Start play on ${resource.name}`
                      }
                      className={`grid min-h-44 gap-3 rounded-lg border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 disabled:cursor-not-allowed ${
                        canStart
                          ? "border-emerald-300 bg-emerald-50 hover:border-emerald-700"
                          : "border-zinc-200 bg-zinc-50"
                      }`}
                      disabled={!canStart}
                      onClick={() => startSession(resource)}
                    >
                      <ResourceCardHeader
                        resource={resource}
                        liveLine={null}
                      />
                      <span className="rounded-md bg-white/80 px-3 py-2 text-sm font-semibold text-emerald-950">
                        {startState}
                      </span>
                      {selectedTab ? (
                        <span className="rounded-md bg-white/70 px-3 py-2 text-xs font-medium text-emerald-900">
                          Selected bill: {currentBillLabel}
                        </span>
                      ) : null}
                      {service ? (
                        <span className="text-sm text-zinc-700">
                          {cashierServiceName(service)} -{" "}
                          {formatPaise(service.pricingRule.ratePerMinute)}/min
                        </span>
                      ) : (
                        <span className="text-sm text-red-700">Service missing</span>
                      )}
                    </button>
                  );
                }

                return (
                  <div
                    key={resource.id}
                    className={`grid min-h-44 gap-3 rounded-lg border p-4 text-left ${
                      resource.status === "MAINTENANCE"
                        ? "border-red-200 bg-red-50"
                        : "border-amber-200 bg-amber-50"
                    }`}
                  >
                    <ResourceCardHeader
                      resource={resource}
                      liveLine={resourceUse?.line ?? null}
                    />
                    {resourceUse ? (
                      <>
                        <div className="grid gap-1 rounded-md bg-white/80 px-3 py-2 text-sm text-zinc-800">
                          <span className="flex items-center gap-1.5 font-semibold">
                            <UserRound className="h-4 w-4" />
                            {billLabel(resourceUse.tab)}
                          </span>
                          <span>
                            {staffServiceName(resourceUse.line.descriptionSnapshot)}{" "}
                            - {statusLabel(resourceUse.line.status)}
                          </span>
                          <span className="text-xs text-zinc-600">
                            {elapsedLineLabel(resourceUse.line)}
                          </span>
                          <span className="text-xs text-zinc-600">
                            {estimatedLine
                              ? `Estimate ${formatPaise(estimatedLine.totalAmount)}`
                              : selectedTabId === resourceUse.tab.id
                                ? "Estimate calculating"
                                : "Open bill to see estimate"}
                          </span>
                        </div>
                        <div className="grid gap-2">
                          <Button
                            className="min-h-11"
                            disabled={actionPending}
                            onClick={() => handleTabSelect(resourceUse.tab.id)}
                            variant="secondary"
                          >
                            <UserRound className="h-4 w-4" />
                            Open bill
                          </Button>
                          <div className="grid grid-cols-2 gap-2">
                            {resourceUse.line.status === "PAUSED" ? (
                              <Button
                                className="min-h-11"
                                disabled={actionPending}
                                onClick={() => void resumeTimedLine(resourceUse.line)}
                                variant="secondary"
                              >
                                <CirclePlay className="h-4 w-4" />
                                Resume
                              </Button>
                            ) : (
                              <Button
                                className="min-h-11"
                                disabled={actionPending}
                                onClick={() => void pauseTimedLine(resourceUse.line)}
                                variant="secondary"
                              >
                                <CirclePause className="h-4 w-4" />
                                Pause
                              </Button>
                            )}
                            <Button
                              className={
                                stopConfirmLineId === resourceUse.line.id
                                  ? "min-h-11"
                                  : "min-h-11 border-red-200 text-red-700 hover:bg-red-50"
                              }
                              disabled={actionPending}
                              onClick={() => void stopTimedLine(resourceUse.line)}
                              variant={
                                stopConfirmLineId === resourceUse.line.id
                                  ? "danger"
                                  : "secondary"
                              }
                            >
                              <Square className="h-4 w-4" />
                              {stopConfirmLineId === resourceUse.line.id
                                ? "Confirm stop"
                                : "Stop"}
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <span className="rounded-md bg-white/80 px-3 py-2 text-sm font-medium text-amber-950">
                        Not available
                      </span>
                    )}
                  </div>
                );
              })}
              {!loading && branchResources.length === 0 ? (
                <p className="col-span-full text-sm text-zinc-600">
                  No resources configured for this branch.
                </p>
              ) : null}
            </div>
          </div>

          <section
            aria-label="Snack quick add"
            className="rounded-lg border border-zinc-200 bg-white p-4"
          >
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <ShoppingBasket className="h-4 w-4 text-emerald-700" />
                  Snacks & drinks
                </h2>
                <p className="text-sm text-zinc-600">
                  Adds to the selected current bill.
                </p>
              </div>
              <Badge tone={selectedTab ? "success" : "warning"}>
                {selectedTab ? currentBillLabel : "No bill selected"}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {(bootstrap?.products ?? []).slice(0, 4).map((product) => (
                <button
                  key={product.id}
                  className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-left transition hover:border-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={actionPending}
                  onClick={() => addRetailLine(product.id)}
                >
                  <span className="block text-sm font-semibold">
                    {product.name}
                  </span>
                  <span className="mt-1 block text-sm text-zinc-600">
                    {formatPaise(product.unitPrice)}
                  </span>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-800">
                    <Plus className="h-3.5 w-3.5" />
                    Add 1
                  </span>
                </button>
              ))}
              {!loading && (bootstrap?.products ?? []).length === 0 ? (
                <p className="col-span-full text-sm text-zinc-600">
                  No snacks or drinks configured.
                </p>
              ) : null}
            </div>
            <div className="mt-3 grid gap-1">
              <label
                className="text-xs font-medium text-zinc-600"
                htmlFor="product-select"
              >
                More snacks & drinks
              </label>
              <div className="flex items-center gap-2">
                <select
                  id="product-select"
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
                  aria-label="Add selected snack or drink"
                  disabled={actionPending}
                  variant="secondary"
                  onClick={() => addRetailLine()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </section>

          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Open bills</h2>
              <div className="flex flex-wrap items-end gap-2">
                <label className="grid gap-1 text-xs font-medium text-zinc-600">
                  Customer / table
                  <Input
                    className="w-48"
                    placeholder="Walk-in, Table 2"
                    value={customerLabel}
                    onChange={(event) => setCustomerLabel(event.target.value)}
                  />
                </label>
                <Button
                  className="min-h-11 px-5"
                  onClick={createTab}
                  disabled={
                    !bootstrap?.activeShift || !currentBranchId || actionPending
                  }
                >
                  <Plus className="h-4 w-4" />
                  New bill
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
                        {selectedTabId === tab.id ? (
                          <Badge tone="success">Selected</Badge>
                        ) : null}
                        {liveTimedCount > 0 ? (
                          <Badge tone="warning">{liveTimedCount} active</Badge>
                        ) : null}
                        <Badge>{tab.status}</Badge>
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-600">
                      {tab.timedLines.length}{" "}
                      {tab.timedLines.length === 1 ? "game" : "games"} -{" "}
                      {tab.retailLines.length}{" "}
                      {tab.retailLines.length === 1
                        ? "snack/drink"
                        : "snacks/drinks"}
                    </p>
                  </button>
                );
              })}
              {!loading && tabs.length === 0 ? (
                <p className="text-sm text-zinc-600">No open bills.</p>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="min-h-0 lg:sticky lg:top-4">
          <div className="flex min-h-0 flex-col rounded-lg border border-zinc-200 bg-white p-3">
            <h2 className="text-lg font-semibold">Current bill</h2>
            {selectedTab ? (
              <div className="mt-3 flex min-h-0 flex-1 flex-col">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="flex min-w-0 items-center gap-2 text-base font-semibold text-emerald-950">
                          <UserRound className="h-4 w-4 shrink-0" />
                          <span className="truncate">{currentBillLabel}</span>
                        </p>
                        <Badge tone="success">Selected bill</Badge>
                      </div>
                      <p className="mt-1 text-xs text-emerald-800">
                        {activeTimedLines.length > 0
                          ? "Stop running games before checkout."
                          : "New games and snacks add here."}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-emerald-800">
                        {quoteLoading ? "Calculating" : billDueLabel}
                      </p>
                      <p className="text-2xl font-semibold">
                        {quote ? formatPaise(quote.totalAmount) : "--"}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-medium text-emerald-900">
                    {currentBillStats}
                  </p>
                  {timedLines.length > 0 ? (
                    <div className="mt-2 grid gap-2 border-t border-emerald-200 pt-2">
                      <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase text-emerald-900">
                        <span>Game timing</span>
                        <span>
                          {timedLines.length} game
                          {timedLines.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      {timedLines.slice(0, 2).map((line) => {
                        const lineTiming = timedLineTiming(line, timingNowMs);

                        return (
                          <div
                            key={line.id}
                            className="grid gap-1 rounded-md bg-white/70 px-3 py-2 text-xs text-emerald-950"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="min-w-0 truncate font-semibold">
                                {line.resource?.name ??
                                  staffServiceName(line.descriptionSnapshot)}
                              </span>
                              <Badge tone={timedLineBadgeTone(line.status)}>
                                {statusLabel(line.status)}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <BillTimingStat
                                label="Start"
                                value={formatSessionTime(lineTiming.startAt)}
                              />
                              <BillTimingStat
                                label="Stop"
                                value={formatSessionTime(lineTiming.stopAt)}
                              />
                              <BillTimingStat
                                label="Duration"
                                value={formatDuration(lineTiming.durationMs)}
                              />
                            </div>
                          </div>
                        );
                      })}
                      {timedLines.length > 2 ? (
                        <p className="text-xs font-medium text-emerald-800">
                          +{timedLines.length - 2} more in bill details
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {quote?.lines.length ? (
                    <div className="mt-2 grid gap-1 border-t border-emerald-200 pt-2">
                      {quote.lines.slice(0, 3).map((line, index) => (
                        <div
                          key={
                            line.id ??
                            line.sourceLineId ??
                            `${line.description}-${index}`
                          }
                          className="flex items-center justify-between gap-3 text-xs font-medium text-emerald-950"
                        >
                          <span className="min-w-0 truncate">
                            {billHeaderLineLabel(line, timedLines)}
                          </span>
                          <span className="shrink-0">
                            {formatPaise(line.totalAmount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="mt-3 min-h-0 flex-1 pr-1">
                  <div className="grid gap-3">
                {activeTimedLines.length > 0 || timedLines.length === 0 ? (
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <Gamepad2 className="h-4 w-4 text-emerald-700" />
                      Games
                    </p>
                    {activeTimedLines.length > 0 ? (
                      <Badge tone="warning">{activeTimedLines.length} active</Badge>
                    ) : (
                      <Badge>No active games</Badge>
                    )}
                  </div>
                  {activeTimedLines.map((line) => {
                    const isMoving = movingTimedLineId === line.id;
                    const lineTiming = timedLineTiming(line, timingNowMs);
                    const hasGameControls =
                      line.status === "RUNNING" || line.status === "PAUSED";
                    const isStoppedLine = !hasGameControls;
                    const isStoppedExpanded = expandedStoppedLineId === line.id;
                    const quoteLine =
                      quote?.lines.find(
                        (invoiceLine) => invoiceLine.sourceLineId === line.id,
                      ) ?? null;
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
                        {isStoppedLine ? (
                          <button
                            className="grid w-full gap-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                            onClick={() =>
                              setExpandedStoppedLineId((current) =>
                                current === line.id ? "" : line.id,
                              )
                            }
                            type="button"
                          >
                            <span className="flex items-center justify-between gap-3">
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-zinc-950">
                                  {line.resource?.name ??
                                    staffServiceName(line.descriptionSnapshot)}
                                </span>
                                <span className="mt-0.5 block truncate text-xs text-zinc-600">
                                  {staffServiceName(line.descriptionSnapshot)}
                                  {quoteLine?.billableMinutes
                                    ? ` - ${quoteLine.billableMinutes} min`
                                    : ""}
                                </span>
                              </span>
                              <span className="flex shrink-0 items-center gap-2">
                                {quoteLine ? (
                                  <span className="text-sm font-semibold text-zinc-950">
                                    {formatPaise(quoteLine.totalAmount)}
                                  </span>
                                ) : null}
                                <Badge tone={timedLineBadgeTone(line.status)}>
                                  {statusLabel(line.status)}
                                </Badge>
                                <ChevronDown
                                  className={`h-4 w-4 text-zinc-500 transition ${
                                    isStoppedExpanded ? "rotate-180" : ""
                                  }`}
                                />
                              </span>
                            </span>
                          </button>
                        ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-medium">
                                {staffServiceName(line.descriptionSnapshot)}
                              </span>
                              <Badge tone={timedLineBadgeTone(line.status)}>
                                {statusLabel(line.status)}
                              </Badge>
                            </span>
                            <span className="mt-1 block text-xs text-zinc-600">
                              {line.resource?.name ?? "No resource"}
                              {" - "}
                              {elapsedLineLabel(line)}
                            </span>
                            {quoteLine ? (
                              <span className="mt-1 block truncate text-xs font-medium text-emerald-800">
                                Est. {formatPaise(quoteLine.totalAmount)}
                                {quoteLine.billableMinutes
                                  ? ` - ${quoteLine.billableMinutes} min`
                                  : ""}
                              </span>
                            ) : null}
                          </div>
                          {hasGameControls ? (
                            <div className="flex flex-wrap justify-end gap-1">
                              {line.status === "RUNNING" ? (
                                <Button
                                  aria-label={`Pause ${line.descriptionSnapshot} on ${
                                    line.resource?.name ?? "no resource"
                                  }`}
                                  className="min-h-11 px-3"
                                  variant="secondary"
                                  onClick={() => {
                                    void pauseTimedLine(line);
                                  }}
                                  disabled={actionPending}
                                >
                                  <CirclePause className="h-4 w-4" />
                                  Pause
                                </Button>
                              ) : null}
                              {line.status === "PAUSED" ? (
                                <Button
                                  aria-label={`Resume ${line.descriptionSnapshot} on ${
                                    line.resource?.name ?? "no resource"
                                  }`}
                                  className="min-h-11 px-3"
                                  variant="secondary"
                                  onClick={() => {
                                    void resumeTimedLine(line);
                                  }}
                                  disabled={actionPending}
                                >
                                  <CirclePlay className="h-4 w-4" />
                                  Resume
                                </Button>
                              ) : null}
                              <Button
                                aria-label={`Stop ${line.descriptionSnapshot} on ${
                                  line.resource?.name ?? "no resource"
                                }`}
                                className={
                                  stopConfirmLineId === line.id
                                    ? "min-h-11 px-3"
                                    : "min-h-11 border-red-200 px-3 text-red-700 hover:bg-red-50"
                                }
                                variant={
                                  stopConfirmLineId === line.id
                                    ? "danger"
                                    : "secondary"
                                }
                                onClick={() => {
                                  void stopTimedLine(line);
                                }}
                                disabled={actionPending}
                              >
                                <Square className="h-4 w-4" />
                                {stopConfirmLineId === line.id ? "Confirm stop" : "Stop"}
                              </Button>
                              {line.status === "RUNNING" ? (
                                <Button
                                  aria-label={`Move game from ${
                                    line.resource?.name ?? "no resource"
                                  }`}
                                  className="min-h-11 px-3"
                                  variant="ghost"
                                  onClick={() => {
                                    setStopConfirmLineId("");
                                    setMovingTimedLineId((current) =>
                                      current === line.id ? "" : line.id,
                                    );
                                  }}
                                  disabled={actionPending}
                                >
                                  <MoveRight className="h-4 w-4" />
                                  Move game
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        )}
                        {!isStoppedLine || isStoppedExpanded ? (
                        <div className="mt-3 grid grid-cols-3 gap-2 rounded-md bg-zinc-50 p-2">
                          <TimingStat
                            label="Start"
                            value={formatSessionTime(lineTiming.startAt)}
                          />
                          <TimingStat
                            label="Stop"
                            value={formatSessionTime(lineTiming.stopAt)}
                          />
                          <TimingStat
                            label="Duration"
                            value={formatDuration(lineTiming.durationMs)}
                          />
                        </div>
                        ) : null}
                        {isMoving ? (
                          <div className="mt-3 rounded-md bg-zinc-50 p-3">
                            <p className="mb-2 text-xs font-medium text-zinc-700">
                              Move this game to:
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
                      No games on this bill.
                    </p>
                  ) : null}
                </div>
                ) : null}

                <div className="grid gap-2">
                  {quote ? (
                    <div className="grid gap-3 rounded-md bg-zinc-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-zinc-950">
                          Items on bill
                        </p>
                        <Badge>{quote.lines.length} line{quote.lines.length === 1 ? "" : "s"}</Badge>
                      </div>
                      <div className="grid gap-1.5">
                        {quote.lines.map((line, index) => {
                          const sourceTimedLine = line.sourceLineId
                            ? timedLines.find(
                                (timedLine) => timedLine.id === line.sourceLineId,
                              ) ?? null
                            : null;
                          const sourceTiming = sourceTimedLine
                            ? timedLineTiming(sourceTimedLine, timingNowMs)
                            : null;
                          const sourceExpanded = sourceTimedLine
                            ? expandedStoppedLineId === sourceTimedLine.id
                            : false;
                          const lineLabel =
                            sourceTimedLine?.resource?.name && line.billableMinutes
                              ? `${sourceTimedLine.resource.name} - ${line.billableMinutes} min`
                              : staffInvoiceLineLabel(line);

                          return (
                            <div
                              key={
                                line.id ??
                                line.sourceLineId ??
                                `${line.description}-${index}`
                              }
                              className="rounded-md bg-white px-3 py-2 text-sm"
                            >
                              {sourceTimedLine &&
                              !isLiveTimedLine(sourceTimedLine) ? (
                                <>
                                  <button
                                    className="flex w-full items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                                    onClick={() =>
                                      setExpandedStoppedLineId((current) =>
                                        current === sourceTimedLine.id
                                          ? ""
                                          : sourceTimedLine.id,
                                      )
                                    }
                                    type="button"
                                  >
                                    <span className="min-w-0">
                                      <span className="block truncate font-semibold text-zinc-950">
                                        {lineLabel}
                                      </span>
                                      <span className="mt-0.5 block truncate text-xs text-zinc-600">
                                        {staffServiceName(
                                          sourceTimedLine.descriptionSnapshot,
                                        )}
                                      </span>
                                    </span>
                                    <span className="flex shrink-0 items-center gap-2">
                                      <span className="font-semibold">
                                        {formatPaise(line.totalAmount)}
                                      </span>
                                      <Badge
                                        tone={timedLineBadgeTone(
                                          sourceTimedLine.status,
                                        )}
                                      >
                                        {statusLabel(sourceTimedLine.status)}
                                      </Badge>
                                      <ChevronDown
                                        className={`h-4 w-4 text-zinc-500 transition ${
                                          sourceExpanded ? "rotate-180" : ""
                                        }`}
                                      />
                                    </span>
                                  </button>
                                  {sourceTiming ? (
                                    <div className="mt-2 grid grid-cols-3 gap-2 rounded-md bg-zinc-50 p-2">
                                      <TimingStat
                                        label="Start"
                                        value={formatSessionTime(
                                          sourceTiming.startAt,
                                        )}
                                      />
                                      <TimingStat
                                        label="Stop"
                                        value={formatSessionTime(
                                          sourceTiming.stopAt,
                                        )}
                                      />
                                      <TimingStat
                                        label="Duration"
                                        value={formatDuration(
                                          sourceTiming.durationMs,
                                        )}
                                      />
                                    </div>
                                  ) : null}
                                </>
                              ) : (
                                <div className="flex items-center justify-between gap-3">
                                  <span className="min-w-0 truncate">
                                    {lineLabel}
                                  </span>
                                  <span className="shrink-0 font-medium">
                                    {formatPaise(line.totalAmount)}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="rounded-md border border-zinc-200 bg-white p-2">
                        <button
                          className="flex min-h-10 w-full items-center gap-2 text-left"
                          onClick={() =>
                            setBillDetailsOpen((current) => !current)
                          }
                          type="button"
                        >
                          <span className="text-sm font-semibold">
                            Bill details
                          </span>
                          <ChevronDown
                            className={`h-4 w-4 text-zinc-500 transition ${
                              billDetailsOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                        {quote.discountAmount > 0 ? (
                          <div className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-2 text-sm">
                            <span className="text-zinc-600">Discount</span>
                            <span className="font-medium text-emerald-800">
                              -{formatPaise(quote.discountAmount)}
                            </span>
                          </div>
                        ) : null}
                        {billDetailsOpen ? (
                          <div className="mt-2 grid gap-1.5 border-t border-zinc-100 pt-2 text-sm">
                            <BreakdownRow
                              label="Gross amount"
                              value={quote.grossAmount}
                            />
                            <BreakdownRow
                              label="Discount"
                              value={quote.discountAmount}
                              tone="discount"
                            />
                            <BreakdownRow
                              label="Taxable value"
                              value={quote.taxableValue}
                            />
                            <BreakdownRow
                              label="GST"
                              value={
                                quote.cgstAmount +
                                quote.sgstAmount +
                                quote.igstAmount
                              }
                            />
                            <BreakdownRow
                              label="Amount due"
                              value={quote.totalAmount}
                              strong
                            />
                          </div>
                        ) : null}
                      </div>

                      {quote.hasActiveTimedLines ? (
                        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
                          <AlertTriangle className="h-4 w-4" />
                          Stop running games before checkout.
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-600">
                      {quoteLoading ? "Calculating bill..." : "Select a bill to see items."}
                    </div>
                  )}
                  </div>
                </div>
                </div>
                <div className="mt-3 grid shrink-0 gap-2 border-t border-zinc-200 bg-white pt-2">
                  <div className="grid gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">
                          {totalDiscountSummary
                            ? `Discount -${totalDiscountSummary}`
                            : "No discount"}
                        </p>
                        {automaticDiscountSummary ? (
                          <p className="text-xs text-emerald-800">
                            Automatic -{automaticDiscountSummary}
                          </p>
                        ) : null}
                        {discountSummary ? (
                          <p className="text-xs text-zinc-600">
                            Manual -{discountSummary} -{" "}
                            {discountReason.trim() || "Reason required before checkout"}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {discountSummary ? (
                          <Button
                            className="px-3"
                            disabled={actionPending}
                            onClick={removeDiscountDraft}
                            variant="ghost"
                          >
                            Remove
                          </Button>
                        ) : null}
                        <Button
                          variant="secondary"
                          onClick={() => setDiscountOpen((current) => !current)}
                          disabled={!quote || actionPending}
                        >
                          {discountOpen
                            ? "Done"
                            : discountSummary
                              ? "Edit"
                              : "Add discount"}
                        </Button>
                      </div>
                    </div>
                    {discountOpen ? (
                      <div className="grid gap-3">
                        <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
                          <label className="grid gap-1 text-xs font-medium text-zinc-600">
                            Discount type
                            <select
                              className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950"
                              disabled={actionPending}
                              value={discountType}
                              onChange={(event) => {
                                setDiscountType(event.target.value as DiscountType);
                                setManagerOverrideId(null);
                              }}
                            >
                              <option value="AMOUNT">Amount</option>
                              <option value="PERCENT">Percent</option>
                            </select>
                          </label>
                          <label className="grid gap-1 text-xs font-medium text-zinc-600">
                            Value
                            <Input
                              className="min-h-11"
                              disabled={actionPending}
                              inputMode="decimal"
                              placeholder={discountType === "AMOUNT" ? "50" : "10"}
                              value={discountValue}
                              onChange={(event) => {
                                setDiscountValue(event.target.value);
                                setManagerOverrideId(null);
                              }}
                            />
                          </label>
                        </div>
                        <label className="grid gap-1 text-xs font-medium text-zinc-600">
                          Discount reason
                          <Input
                            disabled={actionPending}
                            placeholder="Reason for discount"
                            value={discountReason}
                            onChange={(event) => {
                              setDiscountReason(event.target.value);
                              setManagerOverrideId(null);
                            }}
                          />
                        </label>
                        <div className="grid grid-cols-2 gap-2 rounded-md bg-zinc-50 p-3 text-sm">
                          <span className="text-zinc-600">Discount</span>
                          <span className="text-right font-semibold">
                            {formatPaise(requestedDiscountAmount)}
                          </span>
                          <span className="text-zinc-600">Staff limit</span>
                          <span className="text-right font-semibold">
                            {discountLimitPercent}%
                          </span>
                        </div>
                        {discountReasonMissing ? (
                          <p className="text-xs font-medium text-amber-900">
                            Enter a discount reason before checkout.
                          </p>
                        ) : null}
                        {discountRequiresManagerApproval ? (
                          <div className="grid gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                            <p className="text-sm font-semibold text-amber-950">
                              Manager approval required
                            </p>
                            <label className="grid gap-1 text-xs font-medium text-amber-950">
                              Manager email
                              <Input
                                autoComplete="username"
                                disabled={actionPending}
                                inputMode="email"
                                value={managerEmailOrCode}
                                onChange={(event) =>
                                  setManagerEmailOrCode(event.target.value)
                                }
                              />
                            </label>
                            <label className="grid gap-1 text-xs font-medium text-amber-950">
                              Manager password
                              <Input
                                autoComplete="current-password"
                                disabled={actionPending}
                                type="password"
                                value={managerPassword}
                                onChange={(event) =>
                                  setManagerPassword(event.target.value)
                                }
                              />
                            </label>
                            <Button
                              disabled={actionPending}
                              onClick={approveDiscountOverride}
                              variant="secondary"
                            >
                              Approve discount
                            </Button>
                          </div>
                        ) : null}
                        {managerOverrideId ? (
                          <Badge tone="success">Manager approved</Badge>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="grid gap-2 rounded-md border border-zinc-200 bg-white p-2">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <Wallet className="h-4 w-4 text-emerald-700" />
                      Collect payment
                    </p>
                    {paymentDrafts.map((paymentDraft, index) => (
                      <div
                        key={paymentDraft.id}
                        className="grid gap-2"
                      >
                        <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
                          <label className="grid gap-1 text-xs font-medium text-zinc-600">
                            Tender
                            <select
                              aria-label={`Tender ${index + 1}`}
                              className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950"
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
                          </label>
                          <label className="grid gap-1 text-xs font-medium text-zinc-600">
                            Amount
                            <Input
                              aria-label={`Tender ${index + 1} amount`}
                              className="min-h-11"
                              disabled={actionPending}
                              inputMode="decimal"
                              value={paymentDraft.amount}
                              onChange={(event) =>
                                updatePaymentDraft(paymentDraft.id, {
                                  amount: event.target.value,
                                })
                              }
                            />
                          </label>
                        </div>
                        {paymentDrafts.length > 1 ? (
                          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                            <Button
                              className="px-3"
                              disabled={!quote || actionPending}
                              onClick={() =>
                                fillPaymentRemainder(paymentDraft.id)
                              }
                              variant="secondary"
                            >
                              Fill rest
                            </Button>
                            <Button
                              aria-label={`Remove tender ${index + 1}`}
                              className="px-3"
                              disabled={
                                paymentDrafts.length === 1 || actionPending
                              }
                              onClick={() => removePaymentDraft(paymentDraft.id)}
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
                        onClick={addPaymentDraft}
                        disabled={paymentDrafts.length >= 5 || actionPending}
                      >
                        <Plus className="h-4 w-4" />
                        Add payment
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={useTotalPayment}
                        disabled={
                          !quote ||
                          quote.totalAmount <= 0 ||
                          quoteLoading ||
                          actionPending
                        }
                      >
                        Use bill total
                      </Button>
                    </div>
                    <div
                      className={`rounded-md px-3 py-2 text-sm font-semibold ${paymentStatusTone}`}
                    >
                      {paymentStatusLabel}
                    </div>
                  </div>
                  <Button
                    className="min-h-12 text-base"
                    onClick={checkout}
                    disabled={!canPostCheckout}
                    variant={canPostCheckout ? "primary" : "secondary"}
                  >
                    <CreditCard className="h-4 w-4" />
                    {checkoutButtonLabel}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-600">
                Create or select a customer bill to start selling.
              </p>
            )}
          </div>

        </aside>
      </section>
    </main>
  );
}

function TimingStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase text-zinc-500">{label}</p>
      <p className="truncate text-xs font-semibold text-zinc-900">{value}</p>
    </div>
  );
}

function BillTimingStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase text-emerald-700">
        {label}
      </p>
      <p className="truncate text-xs font-semibold text-emerald-950">{value}</p>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  strong = false,
  tone,
}: {
  label: string;
  value: number;
  strong?: boolean;
  tone?: "discount";
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 ${
        strong ? "border-t border-zinc-200 pt-2 text-base font-semibold" : ""
      }`}
    >
      <span className="text-zinc-600">{label}</span>
      <span className={strong ? "font-semibold" : "font-medium"}>
        {tone === "discount" && value > 0 ? "-" : ""}
        {formatPaise(value)}
      </span>
    </div>
  );
}

function ResourceCardHeader({
  resource,
  liveLine,
}: {
  resource: Resource;
  liveLine: TimedLine | null;
}) {
  return (
    <span className="grid gap-2">
      <span>
        <span className="block text-lg font-semibold">{resource.name}</span>
        <span className="mt-1 flex items-center gap-1.5 text-sm text-zinc-600">
          {resource.kind === "POOL_TABLE" ? (
            <CircleDot className="h-4 w-4" />
          ) : (
            <Monitor className="h-4 w-4" />
          )}
          {resourceLabel(resource.kind)}
        </span>
      </span>
      <ResourceStatusBadge resource={resource} liveLine={liveLine} />
    </span>
  );
}

function ResourceStatusBadge({
  resource,
  liveLine,
}: {
  resource: Resource;
  liveLine: TimedLine | null;
}) {
  if (resource.status === "AVAILABLE") {
    return (
      <Badge tone="success" className="w-fit text-sm">
        <Check className="h-4 w-4" />
        Available
      </Badge>
    );
  }

  if (resource.status === "MAINTENANCE") {
    return (
      <Badge tone="danger" className="w-fit text-sm">
        <AlertTriangle className="h-4 w-4" />
        Maintenance
      </Badge>
    );
  }

  if (liveLine?.status === "PAUSED" || resource.status === "PAUSED") {
    return (
      <Badge tone="warning" className="w-fit text-sm">
        <CirclePause className="h-4 w-4" />
        Paused
      </Badge>
    );
  }

  return (
    <Badge tone="warning" className="w-fit text-sm">
      <Clock className="h-4 w-4" />
      Occupied
    </Badge>
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

function billLabel(tab: Tab): string {
  return tab.customerLabel || tab.customerName || "Walk-in bill";
}

function branchName(branchId: string, branches: readonly Branch[]): string {
  return branches.find((branch) => branch.id === branchId)?.name ?? "";
}

function cashierServiceName(service: Service): string {
  return staffServiceName(`${service.name} ${service.description}`);
}

function billHeaderLineLabel(
  line: InvoiceLine,
  timedLines: readonly TimedLine[],
): string {
  const sourceTimedLine = line.sourceLineId
    ? timedLines.find((timedLine) => timedLine.id === line.sourceLineId) ?? null
    : null;

  if (sourceTimedLine?.resource?.name && line.billableMinutes) {
    return `${sourceTimedLine.resource.name} - ${line.billableMinutes} min`;
  }

  return staffInvoiceLineLabel(line);
}

function elapsedLineLabel(line: TimedLine): string {
  if (line.status === "STOPPED" || line.status === "CLOSED") {
    return "Stopped";
  }

  const latestLiveEvent = [...(line.sessionEvents ?? [])]
    .reverse()
    .find((event) => event.eventType === "STARTED" || event.eventType === "RESUMED");

  if (!latestLiveEvent) {
    return line.status === "PAUSED" ? "Paused" : "Just started";
  }

  const occurredAt = new Date(latestLiveEvent.occurredAt).getTime();
  if (!Number.isFinite(occurredAt)) {
    return line.status === "PAUSED" ? "Paused" : "Running";
  }

  const minutes = Math.max(
    0,
    Math.floor((Date.now() - occurredAt) / 60_000),
  );

  if (line.status === "PAUSED") {
    return minutes <= 0 ? "Paused just now" : `Paused after ${minutes} min`;
  }

  return minutes <= 0 ? "Started just now" : `${minutes} min running`;
}

function timedLineTiming(
  line: TimedLine,
  nowMs: number | null,
): TimedLineTiming {
  const events = (line.sessionEvents ?? [])
    .map((event) => ({
      eventType: event.eventType,
      occurredAtMs: Date.parse(event.occurredAt),
    }))
    .filter((event) => Number.isFinite(event.occurredAtMs))
    .sort((left, right) => left.occurredAtMs - right.occurredAtMs);

  let startAtMs: number | null = null;
  let stopAtMs: number | null = null;
  let activeSinceMs: number | null = null;
  let durationMs = 0;
  let canMeasureDuration = true;

  for (const event of events) {
    if (event.eventType === "STARTED" || event.eventType === "RESUMED") {
      startAtMs ??= event.occurredAtMs;
      activeSinceMs = event.occurredAtMs;
      stopAtMs = null;
      continue;
    }

    if (event.eventType === "PAUSED") {
      if (activeSinceMs !== null) {
        durationMs += Math.max(0, event.occurredAtMs - activeSinceMs);
        activeSinceMs = null;
      }
      continue;
    }

    if (event.eventType === "STOPPED" || event.eventType === "CLOSED") {
      if (activeSinceMs !== null) {
        durationMs += Math.max(0, event.occurredAtMs - activeSinceMs);
        activeSinceMs = null;
      }
      stopAtMs = event.occurredAtMs;
    }
  }

  if (activeSinceMs !== null) {
    if (nowMs === null) {
      canMeasureDuration = false;
    } else {
      durationMs += Math.max(0, nowMs - activeSinceMs);
    }
  }

  return {
    startAt: startAtMs === null ? null : new Date(startAtMs),
    stopAt: stopAtMs === null ? null : new Date(stopAtMs),
    durationMs:
      startAtMs === null || !canMeasureDuration ? null : Math.max(0, durationMs),
  };
}

function formatSessionTime(value: Date | null): string {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

function formatDuration(durationMs: number | null): string {
  if (durationMs === null) {
    return "--";
  }

  const totalMinutes = Math.floor(durationMs / 60_000);
  if (totalMinutes < 1) {
    return "Under 1 min";
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) {
    return `${totalMinutes} min`;
  }

  return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

function createPaymentDraft(
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

function calculateDiscountAmount({
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

function statusLabel(status: TimedLine["status"]): string {
  if (status === "RUNNING") {
    return "Running";
  }
  if (status === "PAUSED") {
    return "Paused";
  }
  if (status === "STOPPED") {
    return "Stopped";
  }
  if (status === "CLOSED") {
    return "Closed";
  }
  return "Voided";
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
  hasService,
  actionPending,
  currentBillLabel,
}: {
  hasShift: boolean;
  hasService: boolean;
  actionPending: boolean;
  currentBillLabel: string | null;
}): string {
  if (actionPending) {
    return "Posting";
  }
  if (!hasShift) {
    return "Open shift first";
  }
  if (!hasService) {
    return "Service missing";
  }
  return currentBillLabel ? "Add to selected bill" : "Tap to start";
}
