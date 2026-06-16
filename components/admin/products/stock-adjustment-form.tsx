"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ProductRow, StockDraft } from "./types";

export function StockAdjustmentForm({
  product,
  stockDraft,
  pending,
  onStockDraftChange,
  onAdjust,
}: {
  product: ProductRow;
  stockDraft: StockDraft;
  pending: boolean;
  onStockDraftChange: (patch: Partial<StockDraft>) => void;
  onAdjust: () => void;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-brand" />
        <h2 className="text-base font-semibold text-ink">Stock adjustment</h2>
      </div>
      {product.trackStock && product.branchId ? (
        <div className="grid gap-3">
          <p className="text-sm text-ink-muted">
            Current stock:{" "}
            <span className="font-semibold text-ink">
              {product.stockQuantity}
            </span>
          </p>
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            Adjustment type
            <Select
              value={stockDraft.adjustmentType}
              onChange={(event) =>
                onStockDraftChange({
                  adjustmentType: event.target
                    .value as StockDraft["adjustmentType"],
                })
              }
            >
              <option value="INCREASE">Increase</option>
              <option value="DECREASE">Decrease</option>
              <option value="SET_COUNT">Set count</option>
            </Select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            Quantity
            <Input
              inputMode="numeric"
              value={stockDraft.quantity}
              onChange={(event) =>
                onStockDraftChange({ quantity: event.target.value })
              }
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            Reason
            <Input
              value={stockDraft.reason}
              onChange={(event) =>
                onStockDraftChange({ reason: event.target.value })
              }
            />
          </label>
          <Button
            disabled={
              pending ||
              !stockDraft.reason.trim() ||
              Number(stockDraft.quantity) < 0
            }
            onClick={onAdjust}
            variant="secondary"
          >
            Adjust stock
          </Button>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">
          Stock adjustment is available for stock-tracked branch products.
        </p>
      )}
    </section>
  );
}
