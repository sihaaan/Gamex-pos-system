"use client";

import {
  CirclePause,
  CirclePlay,
  CreditCard,
  LogOut,
  MoveRight,
  Plus,
  ReceiptText,
  Square,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
type TenderType =
  | "CASH"
  | "UPI_GOOGLE_PAY"
  | "UPI_PHONEPE"
  | "UPI_OTHER"
  | "CARD_RECORDED";
type CheckoutQuote = {
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  discountAmount: number;
  totalAmount: number;
  hasActiveTimedLines: boolean;
  serverNow: string;
};

export function PosShell() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedTabId, setSelectedTabId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedTender, setSelectedTender] =
    useState<TenderType>("UPI_PHONEPE");
  const [checkoutAmount, setCheckoutAmount] = useState("");
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [customerLabel, setCustomerLabel] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
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
      selectedBranchId ||
      bootstrapData.activeShift?.branchId ||
      bootstrapData.branches[0]?.id ||
      "";
    setSelectedBranchId(branchId);
    setSelectedServiceId((current) => current || bootstrapData.services[0]?.id || "");
    setSelectedProductId((current) => current || bootstrapData.products[0]?.id || "");

    const tabsResponse = await fetch(
      branchId ? `/api/tabs?branchId=${branchId}` : "/api/tabs",
      { cache: "no-store" },
    );
    const tabsData = (await tabsResponse.json()) as { tabs: Tab[] };
    setTabs(tabsData.tabs ?? []);
    setSelectedTabId((current) => current || tabsData.tabs?.[0]?.id || "");
    setLoading(false);
  }

  async function refreshQuote(tabId: string) {
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
  }

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
  }, [selectedTabId, tabs]);

  const selectedTab = tabs.find((tab) => tab.id === selectedTabId) ?? null;
  const branchResources = useMemo(
    () =>
      bootstrap?.resources.filter(
        (resource) => resource.branchId === selectedBranchId,
      ) ?? [],
    [bootstrap?.resources, selectedBranchId],
  );

  async function postJson(path: string, body: Record<string, unknown>) {
    if (!navigator.onLine) {
      await saveDraftAction({
        id: crypto.randomUUID(),
        actionType: "TAB_DRAFT",
        payload: { path, body },
        createdAt: new Date().toISOString(),
        status: "DRAFT_NOT_POSTED",
      });
      setMessage("Saved as Draft / Not Posted. Reconnect before posting.");
      return;
    }

    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as {
      error?: { message?: string };
    };
    if (!response.ok) {
      setMessage(payload.error?.message ?? "Action failed.");
      return;
    }
    setMessage("Posted.");
    await refresh();
  }

  async function openShift() {
    if (!selectedBranchId) {
      setMessage("Select a branch first.");
      return;
    }
    await postJson("/api/shifts/open", { branchId: selectedBranchId });
  }

  async function closeShift() {
    if (!bootstrap?.activeShift) {
      setMessage("No active shift is open.");
      return;
    }
    await postJson("/api/shifts/close", {
      operatorShiftId: bootstrap.activeShift.id,
    });
  }

  async function createTab() {
    await postJson("/api/tabs", {
      branchId: selectedBranchId,
      customerLabel: customerLabel || undefined,
    });
    setCustomerLabel("");
  }

  async function startSession(resourceId: string) {
    if (!selectedTabId || !selectedServiceId) {
      setMessage("Select a tab and service first.");
      return;
    }
    await postJson("/api/service-sessions/start", {
      tabId: selectedTabId,
      serviceCatalogId: selectedServiceId,
      resourceId,
    });
  }

  async function addRetailLine() {
    if (!selectedTabId || !selectedProductId) {
      setMessage("Select a tab and product first.");
      return;
    }
    await postJson(`/api/tabs/${selectedTabId}/retail-lines`, {
      tabId: selectedTabId,
      productCatalogId: selectedProductId,
      quantity: 1,
    });
  }

  async function checkout() {
    const fallbackAmount = quote ? (quote.totalAmount / 100).toFixed(2) : "";
    const amount = Math.round(Number(checkoutAmount || fallbackAmount) * 100);
    if (!Number.isInteger(amount) || amount <= 0) {
      setMessage("Enter the received amount before checkout.");
      return;
    }
    await postJson("/api/checkout", {
      tabId: selectedTabId,
      payments: [{ tenderType: selectedTender, amount }],
    });
    setCheckoutAmount("");
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <div>
          <h1 className="text-xl font-semibold tracking-normal">Counter POS</h1>
          <p className="text-sm text-zinc-600">
            {bootstrap?.user.name ?? "Operator"} · {bootstrap?.user.role ?? ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OfflineStatus />
          <select
            className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm"
            value={selectedBranchId}
            onChange={(event) => setSelectedBranchId(event.target.value)}
          >
            {bootstrap?.branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          {bootstrap?.activeShift ? (
            <>
              <Badge tone="success">Shift open</Badge>
              <Button variant="secondary" onClick={closeShift}>
                <LogOut className="h-4 w-4" />
                Close shift
              </Button>
            </>
          ) : (
            <Button onClick={openShift}>
              <CirclePlay className="h-4 w-4" />
              Open shift
            </Button>
          )}
        </div>
      </section>

      {message ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {message}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Resources</h2>
              <select
                className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm"
                value={selectedServiceId}
                onChange={(event) => setSelectedServiceId(event.target.value)}
              >
                {bootstrap?.services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} · {formatPaise(service.pricingRule.ratePerMinute)}/min
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {branchResources.map((resource) => (
                <button
                  key={resource.id}
                  className="grid min-h-28 gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left transition hover:border-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                  disabled={resource.status !== "AVAILABLE" || !bootstrap?.activeShift}
                  onClick={() => startSession(resource.id)}
                >
                  <span className="text-sm font-semibold">{resource.name}</span>
                  <span className="text-xs text-zinc-600">
                    {resource.kind === "POOL_TABLE" ? "Pool table" : "Console"}
                  </span>
                  <Badge
                    tone={
                      resource.status === "AVAILABLE"
                        ? "success"
                        : resource.status === "MAINTENANCE"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {resource.status.replace("_", " ")}
                  </Badge>
                </button>
              ))}
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
                <Button onClick={createTab} disabled={!bootstrap?.activeShift}>
                  <Plus className="h-4 w-4" />
                  New tab
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`rounded-md border p-3 text-left ${
                    selectedTabId === tab.id
                      ? "border-emerald-700 bg-emerald-50"
                      : "border-zinc-200 bg-white"
                  }`}
                  onClick={() => setSelectedTabId(tab.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">
                      {tab.customerLabel || tab.customerName || "Walk-in tab"}
                    </span>
                    <Badge>{tab.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">
                    {tab.timedLines.length} timed · {tab.retailLines.length} retail
                  </p>
                </button>
              ))}
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
                  {selectedTab.timedLines.map((line) => (
                    <div
                      key={line.id}
                      className="rounded-md border border-zinc-200 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">
                            {line.descriptionSnapshot}
                          </p>
                          <p className="text-xs text-zinc-600">
                            {line.resource?.name ?? "No resource"} · {line.status}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            className="h-9 px-2"
                            variant="secondary"
                            onClick={() =>
                              postJson("/api/service-sessions/pause", {
                                tabTimedLineId: line.id,
                              })
                            }
                            disabled={line.status !== "RUNNING"}
                          >
                            <CirclePause className="h-4 w-4" />
                          </Button>
                          <Button
                            className="h-9 px-2"
                            variant="secondary"
                            onClick={() =>
                              postJson("/api/service-sessions/resume", {
                                tabTimedLineId: line.id,
                              })
                            }
                            disabled={line.status !== "PAUSED"}
                          >
                            <CirclePlay className="h-4 w-4" />
                          </Button>
                          <Button
                            className="h-9 px-2"
                            variant="secondary"
                            onClick={() =>
                              postJson("/api/service-sessions/stop", {
                                tabTimedLineId: line.id,
                              })
                            }
                            disabled={
                              line.status !== "RUNNING" && line.status !== "PAUSED"
                            }
                          >
                            <Square className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
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
                          {product.name} · {formatPaise(product.unitPrice)}
                        </option>
                      ))}
                    </select>
                    <Button variant="secondary" onClick={addRetailLine}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {selectedTab.retailLines.map((line) => (
                    <p key={line.id} className="text-sm text-zinc-700">
                      {line.quantity} × {line.descriptionSnapshot} ·{" "}
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
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-zinc-600">
                        <span>CGST {formatPaise(quote.cgstAmount)}</span>
                        <span>SGST {formatPaise(quote.sgstAmount)}</span>
                        <span>IGST {formatPaise(quote.igstAmount)}</span>
                      </div>
                    ) : null}
                    {quote?.hasActiveTimedLines ? (
                      <p className="mt-2 text-xs font-medium text-amber-900">
                        Stop timed sessions before final checkout. This is a live estimate.
                      </p>
                    ) : null}
                  </div>
                  <select
                    className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm"
                    value={selectedTender}
                    onChange={(event) =>
                      setSelectedTender(event.target.value as TenderType)
                    }
                  >
                    <option value="UPI_GOOGLE_PAY">UPI - Google Pay</option>
                    <option value="UPI_PHONEPE">UPI - PhonePe</option>
                    <option value="UPI_OTHER">UPI - Other</option>
                    <option value="CARD_RECORDED">Card recorded</option>
                    <option value="CASH">Cash</option>
                  </select>
                  <Input
                    inputMode="decimal"
                    placeholder="Amount received"
                    value={checkoutAmount}
                    onChange={(event) => setCheckoutAmount(event.target.value)}
                  />
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (quote) {
                        setCheckoutAmount((quote.totalAmount / 100).toFixed(2));
                      }
                    }}
                    disabled={!quote}
                  >
                    Use total
                  </Button>
                  <Button onClick={checkout}>
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

          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="mb-3 text-base font-semibold">Transfer target</h2>
            <div className="grid gap-2">
              {branchResources
                .filter((resource) => resource.status === "AVAILABLE")
                .slice(0, 6)
                .map((resource) => (
                  <Button
                    key={resource.id}
                    variant="ghost"
                    disabled={!selectedTab?.timedLines.some(
                      (line) => line.status === "RUNNING",
                    )}
                    onClick={() => {
                      const runningLine = selectedTab?.timedLines.find(
                        (line) => line.status === "RUNNING",
                      );
                      if (runningLine) {
                        postJson("/api/service-sessions/transfer", {
                          tabTimedLineId: runningLine.id,
                          toResourceId: resource.id,
                        });
                      }
                    }}
                  >
                    <MoveRight className="h-4 w-4" />
                    {resource.name}
                  </Button>
                ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
