import { createPaymentDraft, paiseToRupeeInput } from "./money";
import type {
  Bootstrap,
  CheckoutQuote,
  DiscountType,
  PaymentDraft,
  PostedInvoice,
  ShiftCloseSummary,
  StartPrompt,
  Tab,
} from "./types";

export type DiscountDraft = {
  open: boolean;
  type: DiscountType;
  value: string;
  reason: string;
};

export type ManagerApprovalDraft = {
  emailOrCode: string;
  password: string;
  overrideId: string | null;
};

export type PosState = {
  bootstrap: Bootstrap | null;
  tabs: Tab[];
  selectedBranchId: string;
  selectedTabId: string;
  movingTimedLineId: string;
  stopConfirmLineId: string;
  expandedStoppedLineId: string;
  selectedProductId: string;
  startPrompt: StartPrompt | null;
  startBillLabel: string;
  startControllerCount: string;
  billDetailsOpen: boolean;
  discount: DiscountDraft;
  managerApproval: ManagerApprovalDraft;
  clockNow: number;
  paymentDrafts: PaymentDraft[];
  paymentsEdited: boolean;
  quote: CheckoutQuote | null;
  quoteLoading: boolean;
  customerLabel: string;
  message: string | null;
  connectionError: string | null;
  lastPostedInvoice: PostedInvoice | null;
  lastShiftSummary: ShiftCloseSummary | null;
  actionPending: boolean;
  loading: boolean;
};

const emptyDiscount: DiscountDraft = {
  open: false,
  type: "AMOUNT",
  value: "",
  reason: "",
};

const emptyManagerApproval: ManagerApprovalDraft = {
  emailOrCode: "",
  password: "",
  overrideId: null,
};

export function initialPosState(): PosState {
  return {
    bootstrap: null,
    tabs: [],
    selectedBranchId: "",
    selectedTabId: "",
    movingTimedLineId: "",
    stopConfirmLineId: "",
    expandedStoppedLineId: "",
    selectedProductId: "",
    startPrompt: null,
    startBillLabel: "",
    startControllerCount: "1",
    billDetailsOpen: false,
    discount: emptyDiscount,
    managerApproval: emptyManagerApproval,
    clockNow: Date.now(),
    paymentDrafts: [createPaymentDraft("payment-1")],
    paymentsEdited: false,
    quote: null,
    quoteLoading: false,
    customerLabel: "",
    message: null,
    connectionError: null,
    lastPostedInvoice: null,
    lastShiftSummary: null,
    actionPending: false,
    loading: true,
  };
}

export type PosAction =
  | { type: "REFRESH_STARTED" }
  | {
      type: "REFRESH_SUCCEEDED";
      bootstrap: Bootstrap;
      branchId: string;
      tabs: Tab[];
      selectedTabId: string;
    }
  | { type: "REFRESH_FAILED"; error: string }
  | { type: "CONNECTION_ERROR_CLEARED" }
  | { type: "QUOTE_LOADING"; loading: boolean }
  | { type: "QUOTE_RECEIVED"; quote: CheckoutQuote | null }
  | { type: "TAB_SELECTED"; tabId: string }
  | { type: "BRANCH_CHANGED"; branchId: string }
  | { type: "PRODUCT_SELECTED"; productId: string }
  | { type: "START_PROMPT_OPENED"; prompt: StartPrompt }
  | { type: "START_PROMPT_CLOSED" }
  | { type: "START_BILL_LABEL_CHANGED"; label: string }
  | { type: "START_CONTROLLER_COUNT_CHANGED"; controllerCount: string }
  | { type: "CUSTOMER_LABEL_CHANGED"; label: string }
  | { type: "MESSAGE_SET"; message: string | null }
  | { type: "ACTION_PENDING"; pending: boolean }
  | { type: "CLOCK_TICKED"; now: number }
  | { type: "BILL_DETAILS_TOGGLED" }
  | { type: "STOPPED_LINE_TOGGLED"; lineId: string }
  | { type: "MOVE_TARGET_TOGGLED"; lineId: string }
  | { type: "MOVE_AND_STOP_CLEARED" }
  | { type: "STOP_CONFIRM_REQUESTED"; lineId: string }
  | { type: "DISCOUNT_TOGGLED" }
  | { type: "DISCOUNT_CHANGED"; patch: Partial<Omit<DiscountDraft, "open">> }
  | { type: "DISCOUNT_REMOVED" }
  | { type: "DISCOUNT_RESET" }
  | {
      type: "MANAGER_APPROVAL_CHANGED";
      patch: Partial<ManagerApprovalDraft>;
    }
  | { type: "PAYMENT_DRAFTS_SET"; drafts: PaymentDraft[]; edited: boolean }
  | {
      type: "PAYMENT_DRAFT_UPDATED";
      paymentDraftId: string;
      patch: Partial<Omit<PaymentDraft, "id">>;
    }
  | { type: "PAYMENT_DRAFT_ADDED"; draft: PaymentDraft }
  | { type: "PAYMENT_DRAFT_REMOVED"; paymentDraftId: string }
  | { type: "PAYMENTS_RESET"; amountPaise?: number }
  | { type: "INVOICE_POSTED"; invoice: PostedInvoice }
  | { type: "SHIFT_SUMMARY_RECEIVED"; summary: ShiftCloseSummary }
  | { type: "POST_RESULTS_CLEARED" }
  | { type: "SESSION_TARGET_SELECTED"; tabId: string };

export function posReducer(state: PosState, action: PosAction): PosState {
  switch (action.type) {
    case "REFRESH_STARTED":
      return { ...state, loading: true };
    case "REFRESH_SUCCEEDED": {
      const keepQuote = action.selectedTabId !== "";
      return {
        ...state,
        loading: false,
        connectionError: null,
        bootstrap: action.bootstrap,
        selectedBranchId: action.branchId,
        selectedProductId:
          state.selectedProductId || action.bootstrap.products[0]?.id || "",
        tabs: action.tabs,
        selectedTabId: action.selectedTabId,
        movingTimedLineId: action.tabs.some((tab) =>
          tab.timedLines.some(
            (line) =>
              line.id === state.movingTimedLineId && line.status === "RUNNING",
          ),
        )
          ? state.movingTimedLineId
          : "",
        quote: keepQuote ? state.quote : null,
        paymentDrafts: keepQuote
          ? state.paymentDrafts
          : [createPaymentDraft("payment-1")],
        paymentsEdited: keepQuote ? state.paymentsEdited : false,
      };
    }
    case "REFRESH_FAILED":
      return { ...state, loading: false, connectionError: action.error };
    case "CONNECTION_ERROR_CLEARED":
      return { ...state, connectionError: null };
    case "QUOTE_LOADING":
      return { ...state, quoteLoading: action.loading };
    case "QUOTE_RECEIVED": {
      if (!action.quote) {
        return { ...state, quote: null };
      }
      return {
        ...state,
        quote: action.quote,
        paymentDrafts: state.paymentsEdited
          ? state.paymentDrafts
          : [
              createPaymentDraft(
                "payment-1",
                action.quote.totalAmount > 0
                  ? paiseToRupeeInput(action.quote.totalAmount)
                  : "",
              ),
            ],
      };
    }
    case "TAB_SELECTED":
      return {
        ...state,
        selectedTabId: action.tabId,
        movingTimedLineId: "",
        stopConfirmLineId: "",
        expandedStoppedLineId: "",
        startPrompt: null,
        startBillLabel: "",
        startControllerCount: "1",
        billDetailsOpen: false,
        discount: emptyDiscount,
        managerApproval: emptyManagerApproval,
        paymentDrafts: [createPaymentDraft("payment-1")],
        paymentsEdited: false,
        quote: null,
      };
    case "BRANCH_CHANGED":
      return {
        ...state,
        selectedBranchId: action.branchId,
        selectedTabId: "",
        movingTimedLineId: "",
        stopConfirmLineId: "",
        expandedStoppedLineId: "",
        startPrompt: null,
        startBillLabel: "",
        startControllerCount: "1",
        billDetailsOpen: false,
        discount: emptyDiscount,
        managerApproval: emptyManagerApproval,
        paymentDrafts: [createPaymentDraft("payment-1")],
        paymentsEdited: false,
        quote: null,
        message: null,
      };
    case "PRODUCT_SELECTED":
      return { ...state, selectedProductId: action.productId };
    case "START_PROMPT_OPENED":
      return {
        ...state,
        startPrompt: action.prompt,
        startBillLabel: action.prompt.suggestedLabel,
        startControllerCount: "1",
        message: null,
      };
    case "START_PROMPT_CLOSED":
      return {
        ...state,
        startPrompt: null,
        startBillLabel: "",
        startControllerCount: "1",
      };
    case "START_BILL_LABEL_CHANGED":
      return { ...state, startBillLabel: action.label };
    case "START_CONTROLLER_COUNT_CHANGED":
      return { ...state, startControllerCount: action.controllerCount };
    case "CUSTOMER_LABEL_CHANGED":
      return { ...state, customerLabel: action.label };
    case "MESSAGE_SET":
      return { ...state, message: action.message };
    case "ACTION_PENDING":
      return { ...state, actionPending: action.pending };
    case "CLOCK_TICKED":
      return { ...state, clockNow: action.now };
    case "BILL_DETAILS_TOGGLED":
      return { ...state, billDetailsOpen: !state.billDetailsOpen };
    case "STOPPED_LINE_TOGGLED":
      return {
        ...state,
        expandedStoppedLineId:
          state.expandedStoppedLineId === action.lineId ? "" : action.lineId,
      };
    case "MOVE_TARGET_TOGGLED":
      return {
        ...state,
        stopConfirmLineId: "",
        movingTimedLineId:
          state.movingTimedLineId === action.lineId ? "" : action.lineId,
      };
    case "MOVE_AND_STOP_CLEARED":
      return { ...state, movingTimedLineId: "", stopConfirmLineId: "" };
    case "STOP_CONFIRM_REQUESTED":
      return {
        ...state,
        movingTimedLineId: "",
        stopConfirmLineId: action.lineId,
      };
    case "DISCOUNT_TOGGLED":
      return {
        ...state,
        discount: { ...state.discount, open: !state.discount.open },
      };
    case "DISCOUNT_CHANGED":
      return {
        ...state,
        discount: { ...state.discount, ...action.patch },
        managerApproval: { ...state.managerApproval, overrideId: null },
      };
    case "DISCOUNT_REMOVED":
      return {
        ...state,
        discount: { ...emptyDiscount, type: state.discount.type },
        managerApproval: emptyManagerApproval,
      };
    case "DISCOUNT_RESET":
      return {
        ...state,
        discount: emptyDiscount,
        managerApproval: emptyManagerApproval,
      };
    case "MANAGER_APPROVAL_CHANGED":
      return {
        ...state,
        managerApproval: { ...state.managerApproval, ...action.patch },
      };
    case "PAYMENT_DRAFTS_SET":
      return {
        ...state,
        paymentDrafts: action.drafts,
        paymentsEdited: action.edited,
      };
    case "PAYMENT_DRAFT_UPDATED":
      return {
        ...state,
        paymentsEdited: true,
        paymentDrafts: state.paymentDrafts.map((draft) =>
          draft.id === action.paymentDraftId
            ? { ...draft, ...action.patch }
            : draft,
        ),
      };
    case "PAYMENT_DRAFT_ADDED":
      return state.paymentDrafts.length >= 5
        ? state
        : {
            ...state,
            paymentsEdited: true,
            paymentDrafts: [...state.paymentDrafts, action.draft],
          };
    case "PAYMENT_DRAFT_REMOVED":
      return state.paymentDrafts.length === 1
        ? state
        : {
            ...state,
            paymentsEdited: true,
            paymentDrafts: state.paymentDrafts.filter(
              (draft) => draft.id !== action.paymentDraftId,
            ),
          };
    case "PAYMENTS_RESET":
      return {
        ...state,
        paymentDrafts: [
          createPaymentDraft(
            "payment-1",
            typeof action.amountPaise === "number" && action.amountPaise > 0
              ? paiseToRupeeInput(action.amountPaise)
              : "",
          ),
        ],
        paymentsEdited: false,
      };
    case "INVOICE_POSTED":
      return {
        ...state,
        lastPostedInvoice: action.invoice,
        selectedTabId: "",
        tabs: state.tabs.filter((tab) => tab.id !== state.selectedTabId),
        paymentDrafts: [createPaymentDraft("payment-1")],
        paymentsEdited: false,
        discount: emptyDiscount,
        managerApproval: emptyManagerApproval,
        quote: null,
        movingTimedLineId: "",
        stopConfirmLineId: "",
        expandedStoppedLineId: "",
        billDetailsOpen: false,
      };
    case "SHIFT_SUMMARY_RECEIVED":
      return { ...state, lastShiftSummary: action.summary };
    case "POST_RESULTS_CLEARED":
      return { ...state, lastPostedInvoice: null, lastShiftSummary: null };
    case "SESSION_TARGET_SELECTED":
      return {
        ...state,
        selectedTabId: action.tabId,
        movingTimedLineId: "",
        stopConfirmLineId: "",
      };
    default:
      return state;
  }
}
