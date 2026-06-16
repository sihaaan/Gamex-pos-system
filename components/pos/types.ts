export type { FloorLayout, FloorLayoutItem } from "@/lib/floor-layout";

export type Branch = {
  id: string;
  name: string;
  code: string;
  /** Raw JSON from the API; parse with parseFloorLayout before use. */
  floorLayout?: unknown;
};

export type Resource = {
  id: string;
  branchId: string;
  name: string;
  kind: "POOL_TABLE" | "CONSOLE";
  status: "AVAILABLE" | "OCCUPIED" | "PAUSED" | "MAINTENANCE";
};

export type Service = {
  id: string;
  branchId: string | null;
  isActive: boolean;
  name: string;
  description: string;
  pricingRule: {
    pricingMode: string;
    ratePerMinute: number;
    halfHourPrice: number | null;
    hourPrice: number | null;
    controllerPricingEnabled: boolean;
    multiplayerHalfHourPrice: number | null;
    multiplayerHourPrice: number | null;
    maxControllers: number;
  };
};

export type Product = {
  id: string;
  name: string;
  unitPrice: number;
  stockQuantity: number;
};

export type OperatorShift = {
  id: string;
  branchId: string;
  openedAt: string;
  status: "OPEN" | "CLOSED" | "REOPENED";
};

export type Bootstrap = {
  user: { name: string; role: string; branchId: string | null };
  branches: Branch[];
  resources: Resource[];
  services: Service[];
  products: Product[];
  activeShift: OperatorShift | null;
  managerDiscountLimitPercent: number;
};

export type SessionEvent = {
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

export type TimedLine = {
  id: string;
  status: "RUNNING" | "PAUSED" | "STOPPED" | "CLOSED" | "VOIDED";
  descriptionSnapshot: string;
  resourceId: string | null;
  controllerCountSnapshot: number;
  resource?: { name: string } | null;
  sessionEvents?: SessionEvent[];
};

export type TimedLineTiming = {
  startAt: Date | null;
  stopAt: Date | null;
  durationMs: number | null;
};

export type RetailLine = {
  id: string;
  descriptionSnapshot: string;
  quantity: number;
  unitPriceSnapshot: number;
};

export type Tab = {
  id: string;
  branchId: string;
  customerLabel: string | null;
  customerName: string | null;
  status: string;
  timedLines: TimedLine[];
  retailLines: RetailLine[];
};

export type InvoiceLine = {
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

export type TenderType =
  | "CASH"
  | "UPI_GOOGLE_PAY"
  | "UPI_PHONEPE"
  | "UPI_OTHER"
  | "CARD_RECORDED";

export type PaymentDraft = {
  id: string;
  tenderType: TenderType;
  amount: string;
  reference: string;
  tendered: string;
};

export type NormalizedPaymentDraft = {
  tenderType: TenderType;
  amount: number;
  reference?: string;
  tenderedAmount?: number;
};

export type CheckoutQuote = {
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

export type PostedInvoice = {
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

export type ShiftCloseSummary = {
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

export type StartPrompt = {
  resource: Resource;
  suggestedLabel: string;
  targetTabId?: string;
  targetBillLabel?: string;
  controllerPricingEnabled?: boolean;
  maxControllers?: number;
};

export type DiscountType = "AMOUNT" | "PERCENT";
