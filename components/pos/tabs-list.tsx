"use client";

import { Plus, ShoppingBasket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatPaise } from "@/lib/utils";
import { isLiveTimedLine } from "./timing";
import type { PosController } from "./use-pos-controller";

export function TabsList({ controller }: { controller: PosController }) {
  const { state, derived, actions } = controller;

  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Open bills</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            Customer / table
            <Input
              className="w-48"
              placeholder="Walk-in, Table 2"
              value={state.customerLabel}
              onChange={(event) =>
                actions.dispatch({
                  type: "CUSTOMER_LABEL_CHANGED",
                  label: event.target.value,
                })
              }
            />
          </label>
          <Button
            className="min-h-11 px-5"
            onClick={() => void actions.createTab()}
            disabled={
              !state.bootstrap?.activeShift ||
              !derived.currentBranchId ||
              state.actionPending
            }
          >
            <Plus className="h-4 w-4" />
            New bill
          </Button>
        </div>
      </div>
      <div className="grid gap-2">
        {state.tabs.map((tab) => {
          const liveTimedCount = tab.timedLines.filter(isLiveTimedLine).length;
          const selected = state.selectedTabId === tab.id;

          return (
            <button
              key={tab.id}
              className={`cursor-pointer rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                selected
                  ? "border-brand bg-success-soft"
                  : "border-line bg-surface hover:bg-surface-muted"
              }`}
              onClick={() => actions.selectTab(tab.id)}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-ink">
                  {tab.customerLabel || tab.customerName || "Walk-in tab"}
                </span>
                <span className="flex items-center gap-2">
                  {selected ? <Badge tone="success">Selected</Badge> : null}
                  {liveTimedCount > 0 ? (
                    <Badge tone="warning">{liveTimedCount} active</Badge>
                  ) : null}
                  <Badge>{tab.status}</Badge>
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                {tab.timedLines.length}{" "}
                {tab.timedLines.length === 1 ? "game" : "games"} -{" "}
                {tab.retailLines.length}{" "}
                {tab.retailLines.length === 1 ? "snack/drink" : "snacks/drinks"}
              </p>
            </button>
          );
        })}
        {!state.loading && state.tabs.length === 0 ? (
          <p className="text-sm text-ink-muted">No open bills.</p>
        ) : null}
      </div>
    </div>
  );
}

export function ProductQuickAdd({ controller }: { controller: PosController }) {
  const { state, derived, actions } = controller;
  const products = state.bootstrap?.products ?? [];

  return (
    <section
      aria-label="Snack quick add"
      className="rounded-xl border border-line bg-surface p-4 shadow-sm"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <ShoppingBasket className="h-4 w-4 text-success" />
            Snacks & drinks
          </h2>
          <p className="text-sm text-ink-muted">
            Adds to the selected current bill.
          </p>
        </div>
        <Badge tone={derived.selectedTab ? "success" : "warning"}>
          {derived.selectedTab ? derived.currentBillLabel : "No bill selected"}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {products.slice(0, 4).map((product) => (
          <button
            key={product.id}
            className="cursor-pointer rounded-lg border border-line bg-surface-muted p-3 text-left transition hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60"
            disabled={state.actionPending}
            onClick={() => void actions.addRetailLine(product.id)}
          >
            <span className="block text-sm font-semibold text-ink">
              {product.name}
            </span>
            <span className="mt-1 block text-sm tabular-nums text-ink-muted">
              {formatPaise(product.unitPrice)}
            </span>
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-success">
              <Plus className="h-3.5 w-3.5" />
              Add 1
            </span>
          </button>
        ))}
        {!state.loading && products.length === 0 ? (
          <p className="col-span-full text-sm text-ink-muted">
            No snacks or drinks configured.
          </p>
        ) : null}
      </div>
      <div className="mt-3 grid gap-1">
        <label
          className="text-xs font-medium text-ink-muted"
          htmlFor="product-select"
        >
          More snacks & drinks
        </label>
        <div className="flex items-center gap-2">
          <Select
            id="product-select"
            className="flex-1"
            value={state.selectedProductId}
            onChange={(event) =>
              actions.dispatch({
                type: "PRODUCT_SELECTED",
                productId: event.target.value,
              })
            }
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} - {formatPaise(product.unitPrice)}
              </option>
            ))}
          </Select>
          <Button
            aria-label="Add selected snack or drink"
            disabled={state.actionPending}
            variant="secondary"
            onClick={() => void actions.addRetailLine()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
