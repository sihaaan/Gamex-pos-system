"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { saveDraftAction } from "@/lib/offline/draft-queue";
import {
  nextWalkInBillLabel,
  resourceStartBillLabel,
} from "@/lib/pos/bill-labels";
import {
  compactBillStats,
  staffBillStatus,
  staffPaymentStatusLabel,
} from "@/lib/pos/display";
import { findServiceForResource } from "@/lib/pos/service-selection";
import { formatPaise } from "@/lib/utils";
import {
  calculateDiscountAmount,
  createPaymentDraft,
  makePaymentDraftId,
  paiseToRupeeInput,
  parseRupeeInputToPaise,
  summarizePaymentDrafts,
} from "./money";
import { initialPosState, posReducer } from "./store";
import type { PosAction, PosState } from "./store";
import {
  billLabel,
  isLiveTimedLine,
  resourceLabel,
  toStringArray,
} from "./timing";
import type {
  Bootstrap,
  CheckoutQuote,
  PostedInvoice,
  Resource,
  ShiftCloseSummary,
  Tab,
  TimedLine,
} from "./types";

type RefreshOptions = {
  branchId?: string;
  preferredTabId?: string;
  clearSelection?: boolean;
};

export type PosDerived = {
  selectedTab: Tab | null;
  isStaff: boolean;
  currentBranchId: string;
  timedLines: TimedLine[];
  activeTimedLines: TimedLine[];
  currentBillLabel: string;
  billDueLabel: string;
  timingNowMs: number | null;
  canUseResourceBoard: boolean;
  branchResources: Resource[];
  resourceUseById: Map<string, { tab: Tab; line: TimedLine }>;
  paymentSummary: ReturnType<typeof summarizePaymentDrafts>;
  paymentBalance: number;
  discountLimitPercent: number;
  requestedDiscountAmount: number;
  requestedDiscountPercent: number;
  currentBillStats: string;
  discountSummary: string | null;
  automaticDiscountSummary: string | null;
  totalDiscountSummary: string | null;
  paymentStatusLabel: string;
  paymentStatusTone: "success" | "warning";
  discountReasonMissing: boolean;
  discountRequiresManagerApproval: boolean;
  canPostCheckout: boolean;
  checkoutButtonLabel: string;
  shiftWarnings: string[];
  unusualActions: string[];
};

export type PosActions = {
  refresh: (options?: RefreshOptions) => Promise<void>;
  retryConnection: () => void;
  openShift: () => Promise<void>;
  closeShift: () => Promise<void>;
  createTab: () => Promise<void>;
  openStartPrompt: (resource: Resource) => void;
  confirmStartPrompt: () => Promise<void>;
  closeStartPrompt: () => void;
  startSession: (resource: Resource) => Promise<void>;
  moveTimedSession: (line: TimedLine, resourceId: string) => Promise<void>;
  pauseTimedLine: (line: TimedLine) => Promise<void>;
  resumeTimedLine: (line: TimedLine) => Promise<void>;
  stopTimedLine: (line: TimedLine) => Promise<void>;
  addRetailLine: (productId?: string) => Promise<void>;
  approveDiscountOverride: () => Promise<void>;
  checkout: () => Promise<void>;
  selectTab: (tabId: string) => void;
  changeBranch: (branchId: string) => void;
  useTotalPayment: () => void;
  fillPaymentRemainder: (paymentDraftId: string) => void;
  addPaymentDraft: () => void;
  dispatch: (action: PosAction) => void;
};

export type PosController = {
  state: PosState;
  derived: PosDerived;
  actions: PosActions;
};

export function usePosController(): PosController {
  const [state, dispatch] = useReducer(posReducer, undefined, initialPosState);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const refresh = useCallback(
    async (options?: RefreshOptions) => {
      dispatch({ type: "REFRESH_STARTED" });
      try {
        const bootstrapResponse = await fetch("/api/pos/bootstrap", {
          cache: "no-store",
        });
        if (bootstrapResponse.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (!bootstrapResponse.ok) {
          throw new Error("Unable to load POS data.");
        }
        const bootstrapData = (await bootstrapResponse.json()) as Bootstrap;
        const current = stateRef.current;
        const branchId =
          options?.branchId ||
          current.selectedBranchId ||
          bootstrapData.activeShift?.branchId ||
          bootstrapData.branches[0]?.id ||
          "";

        const tabsResponse = await fetch(
          branchId ? `/api/tabs?branchId=${branchId}` : "/api/tabs",
          { cache: "no-store" },
        );
        if (!tabsResponse.ok) {
          throw new Error("Unable to load open bills.");
        }
        const tabsData = (await tabsResponse.json()) as { tabs: Tab[] };
        const nextTabs = tabsData.tabs ?? [];
        const preferredTabId = options?.preferredTabId;
        const nextSelectedTabId = options?.clearSelection
          ? ""
          : preferredTabId
            ? (nextTabs.find((tab) => tab.id === preferredTabId)?.id ?? "")
            : (nextTabs.find((tab) => tab.id === current.selectedTabId)?.id ??
              "");

        dispatch({
          type: "REFRESH_SUCCEEDED",
          bootstrap: bootstrapData,
          branchId,
          tabs: nextTabs,
          selectedTabId: nextSelectedTabId,
        });
      } catch (error) {
        dispatch({
          type: "REFRESH_FAILED",
          error:
            error instanceof Error
              ? error.message
              : "Connection error. Check the network and retry.",
        });
      }
    },
    [],
  );

  const refreshQuote = useCallback(
    async (tabId: string, discountAmount = 0) => {
      dispatch({ type: "QUOTE_LOADING", loading: true });
      try {
        const query = new URLSearchParams({ tabId });
        if (discountAmount > 0) {
          query.set("discountAmount", String(discountAmount));
        }
        const response = await fetch(
          `/api/checkout/quote?${query.toString()}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          dispatch({ type: "QUOTE_RECEIVED", quote: null });
          return;
        }

        const payload = (await response.json()) as { quote: CheckoutQuote };
        dispatch({ type: "QUOTE_RECEIVED", quote: payload.quote });
      } catch {
        dispatch({ type: "QUOTE_RECEIVED", quote: null });
      } finally {
        dispatch({ type: "QUOTE_LOADING", loading: false });
      }
    },
    [],
  );

  const postJson = useCallback(
    async <TPayload,>(
      path: string,
      body: Record<string, unknown>,
      options?: { offlineDraft?: boolean; successMessage?: string },
    ): Promise<TPayload | null> => {
      dispatch({ type: "POST_RESULTS_CLEARED" });

      if (!navigator.onLine) {
        if (options?.offlineDraft) {
          await saveDraftAction({
            id: crypto.randomUUID(),
            actionType: "TAB_DRAFT",
            payload: { path, body },
            createdAt: new Date().toISOString(),
            status: "DRAFT_NOT_POSTED",
          });
          dispatch({
            type: "MESSAGE_SET",
            message: "Saved as Draft / Not Posted. Reconnect before posting.",
          });
          return null;
        }

        dispatch({
          type: "MESSAGE_SET",
          message: "You are offline. Reconnect before posting this action.",
        });
        return null;
      }

      dispatch({ type: "ACTION_PENDING", pending: true });
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
          dispatch({
            type: "MESSAGE_SET",
            message: payload.error?.message ?? "Action failed.",
          });
          return null;
        }
        dispatch({
          type: "MESSAGE_SET",
          message: options?.successMessage ?? "Posted.",
        });
        await refresh();
        return payload;
      } catch {
        dispatch({
          type: "MESSAGE_SET",
          message: "Connection error. The action was not posted - retry.",
        });
        return null;
      } finally {
        dispatch({ type: "ACTION_PENDING", pending: false });
      }
    },
    [refresh],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(
      () => dispatch({ type: "CLOCK_TICKED", now: Date.now() }),
      15_000,
    );
    return () => window.clearInterval(interval);
  }, []);

  const quoteGrossAmount = state.quote?.grossAmount ?? 0;
  const requestedDiscountAmount = useMemo(
    () =>
      calculateDiscountAmount({
        discountType: state.discount.type,
        discountValue: state.discount.value,
        grossAmount: quoteGrossAmount,
      }),
    [state.discount.type, state.discount.value, quoteGrossAmount],
  );

  const selectedTabId = state.selectedTabId;
  const tabs = state.tabs;
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!selectedTabId) {
        dispatch({ type: "QUOTE_RECEIVED", quote: null });
        return;
      }
      void refreshQuote(selectedTabId, requestedDiscountAmount);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [refreshQuote, requestedDiscountAmount, selectedTabId, tabs]);

  const selectedTab = tabs.find((tab) => tab.id === selectedTabId) ?? null;
  const isStaff = state.bootstrap?.user.role === "STAFF";
  const currentBranchId =
    state.selectedBranchId ||
    state.bootstrap?.activeShift?.branchId ||
    state.bootstrap?.branches[0]?.id ||
    "";
  const timedLines = selectedTab?.timedLines ?? [];
  const activeTimedLines = timedLines.filter(isLiveTimedLine);
  const currentBillLabel = selectedTab
    ? billLabel(selectedTab)
    : "No bill selected";
  const billDueLabel = state.quote?.hasActiveTimedLines
    ? "Running estimate"
    : "Amount due";
  const quoteServerNowMs = state.quote
    ? Date.parse(state.quote.serverNow)
    : Number.NaN;
  const timingNowMs = Number.isFinite(state.clockNow)
    ? state.clockNow
    : Number.isFinite(quoteServerNowMs)
      ? quoteServerNowMs
      : null;
  const canUseResourceBoard = Boolean(
    state.bootstrap?.activeShift && !state.actionPending,
  );
  const branchResources = useMemo(
    () =>
      state.bootstrap?.resources.filter(
        (resource) => resource.branchId === currentBranchId,
      ) ?? [],
    [state.bootstrap?.resources, currentBranchId],
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
    () => summarizePaymentDrafts(state.paymentDrafts),
    [state.paymentDrafts],
  );
  const paymentBalance = state.quote
    ? state.quote.totalAmount - paymentSummary.totalAmount
    : 0;
  const discountLimitPercent =
    state.quote?.managerDiscountLimitPercent ??
    state.bootstrap?.managerDiscountLimitPercent ??
    10;
  const requestedDiscountPercent =
    quoteGrossAmount > 0
      ? (requestedDiscountAmount / quoteGrossAmount) * 100
      : 0;
  const currentBillStatus = staffBillStatus({
    activeTimedLineCount: activeTimedLines.length,
    timedLineCount: timedLines.length,
    paymentBalance,
    totalAmount: state.quote?.totalAmount ?? 0,
  });
  const currentBillStats = compactBillStats({
    gameCount: timedLines.length,
    snackCount: selectedTab?.retailLines.length ?? 0,
    status: currentBillStatus,
  });
  const discountSummary =
    requestedDiscountAmount > 0 ? formatPaise(requestedDiscountAmount) : null;
  const automaticDiscountAmount = state.quote?.automaticDiscountAmount ?? 0;
  const automaticDiscountSummary =
    automaticDiscountAmount > 0 ? formatPaise(automaticDiscountAmount) : null;
  const totalDiscountSummary =
    state.quote && state.quote.discountAmount > 0
      ? formatPaise(state.quote.discountAmount)
      : null;
  const paymentStatusLabel = state.quote
    ? staffPaymentStatusLabel({
        paymentTotal: paymentSummary.totalAmount,
        paymentBalance,
        hasActiveTimedLines: state.quote.hasActiveTimedLines,
        formatAmount: formatPaise,
      })
    : "Payment not ready";
  const paymentStatusTone: "success" | "warning" =
    !state.quote?.hasActiveTimedLines && paymentBalance === 0
      ? "success"
      : "warning";
  const discountReasonMissing =
    requestedDiscountAmount > 0 && state.discount.reason.trim().length === 0;
  const discountRequiresManagerApproval = Boolean(
    isStaff &&
      requestedDiscountAmount > 0 &&
      requestedDiscountPercent > discountLimitPercent &&
      !state.managerApproval.overrideId,
  );
  const canPostCheckout = Boolean(
    state.quote &&
      state.quote.totalAmount > 0 &&
      !state.quote.hasActiveTimedLines &&
      !discountReasonMissing &&
      !discountRequiresManagerApproval &&
      paymentSummary.payments.length > 0 &&
      !paymentSummary.hasInvalidAmount &&
      !paymentSummary.hasShortCashTender &&
      paymentBalance === 0 &&
      !state.actionPending,
  );
  const checkoutButtonLabel = state.quote?.hasActiveTimedLines
    ? "Stop games to checkout"
    : "Post checkout";
  const shiftWarnings = state.lastShiftSummary
    ? toStringArray(state.lastShiftSummary.warnings)
    : [];
  const unusualActions = state.lastShiftSummary
    ? toStringArray(state.lastShiftSummary.unusualActions)
    : [];

  const setMessage = useCallback((message: string | null) => {
    dispatch({ type: "MESSAGE_SET", message });
  }, []);

  const startSessionForTab = useCallback(
    async (
      resource: Resource,
      tabId: string,
      targetBillLabel: string,
      controllerCount = 1,
    ) => {
      const current = stateRef.current;
      const service = findServiceForResource(
        resource,
        current.bootstrap?.services ?? [],
      );
      if (!service) {
        setMessage(
          `No timed service is configured for ${resourceLabel(resource.kind)}.`,
        );
        return;
      }

      const payload = await postJson<{ timedLine: TimedLine }>(
        "/api/service-sessions/start",
        {
          tabId,
          serviceCatalogId: service.id,
          resourceId: resource.id,
          controllerCount:
            resource.kind === "CONSOLE" ? controllerCount : undefined,
        },
        { successMessage: `${resource.name} added to ${targetBillLabel}.` },
      );
      if (payload?.timedLine) {
        dispatch({ type: "SESSION_TARGET_SELECTED", tabId });
        await refresh({ branchId: currentBranchId, preferredTabId: tabId });
      }
    },
    [currentBranchId, postJson, refresh, setMessage],
  );

  const openStartPrompt = useCallback(
    (resource: Resource) => {
      const current = stateRef.current;
      if (!current.bootstrap?.activeShift) {
        setMessage("Open your shift to start selling.");
        return;
      }

      const service = findServiceForResource(
        resource,
        current.bootstrap.services,
      );
      if (!service) {
        setMessage(
          `No timed service is configured for ${resourceLabel(resource.kind)}.`,
        );
        return;
      }

      const suggestedLabel = resourceStartBillLabel(
        resource.name,
        current.tabs,
      );
      dispatch({
        type: "START_PROMPT_OPENED",
        prompt: {
          resource,
          suggestedLabel,
          controllerPricingEnabled:
            resource.kind === "CONSOLE" &&
            service.pricingRule.controllerPricingEnabled,
          maxControllers: service.pricingRule.maxControllers,
        },
      });
    },
    [setMessage],
  );

  const actions: PosActions = useMemo(
    () => ({
      refresh,
      dispatch,
      retryConnection: () => {
        dispatch({ type: "CONNECTION_ERROR_CLEARED" });
        void refresh();
      },
      openShift: async () => {
        if (!currentBranchId) {
          setMessage("Select a branch first.");
          return;
        }
        await postJson(
          "/api/shifts/open",
          { branchId: currentBranchId },
          { successMessage: "Shift opened." },
        );
      },
      closeShift: async () => {
        const current = stateRef.current;
        if (!current.bootstrap?.activeShift) {
          setMessage("No active shift is open.");
          return;
        }
        if (current.tabs.length > 0) {
          setMessage(
            `Close blocked: finish checkout or void ${current.tabs.length} open bill${current.tabs.length === 1 ? "" : "s"} before closing shift.`,
          );
          return;
        }
        const payload = await postJson<{ summary: ShiftCloseSummary }>(
          "/api/shifts/close",
          { operatorShiftId: current.bootstrap.activeShift.id },
          { successMessage: "Shift closed." },
        );
        if (payload?.summary) {
          dispatch({ type: "SHIFT_SUMMARY_RECEIVED", summary: payload.summary });
        }
      },
      createTab: async () => {
        const current = stateRef.current;
        const label =
          current.customerLabel.trim() || nextWalkInBillLabel(current.tabs);
        const payload = await postJson<{ tab: Tab }>(
          "/api/tabs",
          {
            branchId: currentBranchId,
            customerLabel: label,
          },
          { offlineDraft: true, successMessage: `${label} created.` },
        );
        dispatch({ type: "CUSTOMER_LABEL_CHANGED", label: "" });
        if (payload?.tab) {
          dispatch({ type: "SESSION_TARGET_SELECTED", tabId: payload.tab.id });
          await refresh({
            branchId: currentBranchId,
            preferredTabId: payload.tab.id,
          });
        }
      },
      openStartPrompt,
      closeStartPrompt: () => dispatch({ type: "START_PROMPT_CLOSED" }),
      confirmStartPrompt: async () => {
        const current = stateRef.current;
        if (!current.startPrompt) {
          return;
        }
        if (!navigator.onLine) {
          setMessage("Reconnect before starting play.");
          return;
        }

        const label =
          current.startBillLabel.trim() || current.startPrompt.suggestedLabel;
        const resource = current.startPrompt.resource;
        const controllerCount = parseControllerCount(
          current.startControllerCount,
          current.startPrompt.maxControllers ?? 4,
        );
        dispatch({ type: "START_PROMPT_CLOSED" });

        if (current.startPrompt.targetTabId) {
          await startSessionForTab(
            resource,
            current.startPrompt.targetTabId,
            current.startPrompt.targetBillLabel ?? label,
            controllerCount,
          );
          return;
        }

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

        dispatch({ type: "SESSION_TARGET_SELECTED", tabId: payload.tab.id });
        await startSessionForTab(resource, payload.tab.id, label, controllerCount);
      },
      startSession: async (resource: Resource) => {
        const current = stateRef.current;
        const tab =
          current.tabs.find((item) => item.id === current.selectedTabId) ??
          null;
        if (!current.selectedTabId || !tab) {
          openStartPrompt(resource);
          return;
        }

        const service = findServiceForResource(
          resource,
          current.bootstrap?.services ?? [],
        );
        if (
          resource.kind === "CONSOLE" &&
          service?.pricingRule.controllerPricingEnabled
        ) {
          const targetBillLabel = billLabel(tab);
          dispatch({
            type: "START_PROMPT_OPENED",
            prompt: {
              resource,
              suggestedLabel: targetBillLabel,
              targetTabId: current.selectedTabId,
              targetBillLabel,
              controllerPricingEnabled: true,
              maxControllers: service.pricingRule.maxControllers,
            },
          });
          return;
        }

        await startSessionForTab(resource, current.selectedTabId, billLabel(tab));
      },
      moveTimedSession: async (line: TimedLine, resourceId: string) => {
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
          dispatch({ type: "MOVE_AND_STOP_CLEARED" });
        }
      },
      pauseTimedLine: async (line: TimedLine) => {
        dispatch({ type: "MOVE_AND_STOP_CLEARED" });
        await postJson(
          "/api/service-sessions/pause",
          { tabTimedLineId: line.id },
          { successMessage: "Game paused." },
        );
      },
      resumeTimedLine: async (line: TimedLine) => {
        dispatch({ type: "MOVE_AND_STOP_CLEARED" });
        await postJson(
          "/api/service-sessions/resume",
          { tabTimedLineId: line.id },
          { successMessage: "Game resumed." },
        );
      },
      stopTimedLine: async (line: TimedLine) => {
        const current = stateRef.current;
        if (current.stopConfirmLineId !== line.id) {
          dispatch({ type: "STOP_CONFIRM_REQUESTED", lineId: line.id });
          setMessage(
            `Tap Confirm stop on ${line.resource?.name ?? "this game"} to end billing for that game.`,
          );
          return;
        }

        dispatch({ type: "MOVE_AND_STOP_CLEARED" });
        await postJson(
          "/api/service-sessions/stop",
          { tabTimedLineId: line.id },
          { successMessage: "Game stopped." },
        );
      },
      addRetailLine: async (productId?: string) => {
        const current = stateRef.current;
        const targetProductId = productId ?? current.selectedProductId;
        if (!current.selectedTabId) {
          setMessage("Select or create a bill before adding snacks.");
          return;
        }
        if (!targetProductId) {
          setMessage("Select a snack or drink first.");
          return;
        }
        const tabId = current.selectedTabId;
        const posted = await postJson(
          `/api/tabs/${tabId}/retail-lines`,
          {
            tabId,
            productCatalogId: targetProductId,
            quantity: 1,
          },
          { offlineDraft: true, successMessage: "Snack or drink added." },
        );
        if (posted) {
          await refreshQuote(tabId, requestedDiscountAmount);
        }
      },
      approveDiscountOverride: async () => {
        const current = stateRef.current;
        if (!current.selectedTabId || !current.quote) {
          setMessage("Select a bill before requesting approval.");
          return;
        }
        if (requestedDiscountAmount <= 0) {
          setMessage("Enter a discount before requesting approval.");
          return;
        }
        if (!current.discount.reason.trim()) {
          setMessage("Enter a discount reason before requesting approval.");
          return;
        }
        if (
          !current.managerApproval.emailOrCode.trim() ||
          !current.managerApproval.password
        ) {
          setMessage("Enter manager email and password.");
          return;
        }
        if (!navigator.onLine) {
          setMessage("Reconnect before requesting manager approval.");
          return;
        }

        dispatch({ type: "ACTION_PENDING", pending: true });
        try {
          const response = await fetch("/api/manager-overrides/approve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "HIGH_DISCOUNT",
              targetType: "tab",
              targetId: current.selectedTabId,
              branchId: currentBranchId,
              reason: current.discount.reason.trim(),
              managerEmailOrCode: current.managerApproval.emailOrCode,
              managerPassword: current.managerApproval.password,
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
          dispatch({
            type: "MANAGER_APPROVAL_CHANGED",
            patch: { overrideId: payload.managerOverrideId, password: "" },
          });
          setMessage("Manager approved this discount.");
        } catch {
          setMessage("Connection error. Manager approval was not posted.");
        } finally {
          dispatch({ type: "ACTION_PENDING", pending: false });
        }
      },
      checkout: async () => {
        const current = stateRef.current;
        const summary = summarizePaymentDrafts(current.paymentDrafts);
        if (!current.selectedTabId) {
          setMessage("Select a customer bill before checkout.");
          return;
        }
        if (current.quote?.hasActiveTimedLines) {
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
        if (!current.quote) {
          setMessage("Wait for the final bill before checkout.");
          return;
        }
        if (summary.hasInvalidAmount) {
          setMessage("Use payment amounts like 500 or 500.50.");
          return;
        }
        if (summary.hasShortCashTender) {
          setMessage("Cash tendered must cover the cash amount.");
          return;
        }
        if (summary.payments.length === 0) {
          setMessage("Enter at least one payment amount before checkout.");
          return;
        }
        if (summary.totalAmount !== current.quote.totalAmount) {
          setMessage(
            `Payment is ${formatPaise(summary.totalAmount)}. Amount due is ${formatPaise(current.quote.totalAmount)}.`,
          );
          return;
        }
        const payload = await postJson<{ invoice: PostedInvoice }>(
          "/api/checkout",
          {
            tabId: current.selectedTabId,
            payments: summary.payments,
            discountAmount: requestedDiscountAmount || undefined,
            discountReason:
              requestedDiscountAmount > 0
                ? current.discount.reason.trim()
                : undefined,
            managerOverrideId: current.managerApproval.overrideId ?? undefined,
          },
          { successMessage: "Checkout posted." },
        );
        if (payload?.invoice) {
          dispatch({ type: "INVOICE_POSTED", invoice: payload.invoice });
        }
      },
      selectTab: (tabId: string) => {
        if (tabId === stateRef.current.selectedTabId) {
          return;
        }
        dispatch({ type: "TAB_SELECTED", tabId });
      },
      changeBranch: (branchId: string) => {
        dispatch({ type: "BRANCH_CHANGED", branchId });
        void refresh({ branchId, clearSelection: true });
      },
      useTotalPayment: () => {
        const current = stateRef.current;
        if (!current.quote) {
          return;
        }
        const primary = current.paymentDrafts[0];
        dispatch({
          type: "PAYMENT_DRAFTS_SET",
          drafts: [
            createPaymentDraft(
              "payment-1",
              paiseToRupeeInput(current.quote.totalAmount),
              primary?.tenderType ?? "UPI_PHONEPE",
              primary?.reference ?? "",
            ),
          ],
          edited: true,
        });
        setMessage(
          `Payment updated to ${formatPaise(current.quote.totalAmount)}.`,
        );
      },
      fillPaymentRemainder: (paymentDraftId: string) => {
        const current = stateRef.current;
        if (!current.quote) {
          return;
        }
        const otherTotal = current.paymentDrafts.reduce((total, draft) => {
          if (draft.id === paymentDraftId) {
            return total;
          }
          return total + (parseRupeeInputToPaise(draft.amount) ?? 0);
        }, 0);
        const remainingAmount = Math.max(
          current.quote.totalAmount - otherTotal,
          0,
        );
        dispatch({
          type: "PAYMENT_DRAFT_UPDATED",
          paymentDraftId,
          patch: { amount: paiseToRupeeInput(remainingAmount) },
        });
      },
      addPaymentDraft: () => {
        dispatch({
          type: "PAYMENT_DRAFT_ADDED",
          draft: createPaymentDraft(makePaymentDraftId()),
        });
      },
    }),
    [
      currentBranchId,
      discountReasonMissing,
      discountRequiresManagerApproval,
      openStartPrompt,
      postJson,
      refresh,
      refreshQuote,
      requestedDiscountAmount,
      setMessage,
      startSessionForTab,
    ],
  );

  return {
    state,
    derived: {
      selectedTab,
      isStaff,
      currentBranchId,
      timedLines,
      activeTimedLines,
      currentBillLabel,
      billDueLabel,
      timingNowMs,
      canUseResourceBoard,
      branchResources,
      resourceUseById,
      paymentSummary,
      paymentBalance,
      discountLimitPercent,
      requestedDiscountAmount,
      requestedDiscountPercent,
      currentBillStats,
      discountSummary,
      automaticDiscountSummary,
      totalDiscountSummary,
      paymentStatusLabel,
      paymentStatusTone,
      discountReasonMissing,
      discountRequiresManagerApproval,
      canPostCheckout,
      checkoutButtonLabel,
      shiftWarnings,
      unusualActions,
    },
    actions,
  };
}

function parseControllerCount(value: string, maxControllers: number): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    return 1;
  }
  return Math.min(Math.max(parsed, 1), maxControllers);
}
