"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { BranchOption, TaxRateOption } from "@/components/admin/shared";
import type { ProductDraft, ProductRow } from "./types";

export function ProductForm({
  draft,
  branches,
  hsnRates,
  owner,
  pending,
  selectedProduct,
  onDraftChange,
  onSave,
  onToggleActive,
}: {
  draft: ProductDraft;
  branches: readonly BranchOption[];
  hsnRates: readonly TaxRateOption[];
  owner: boolean;
  pending: boolean;
  selectedProduct: ProductRow | null;
  onDraftChange: (patch: Partial<ProductDraft>) => void;
  onSave: () => void;
  onToggleActive: (product: ProductRow) => void;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Pencil className="h-4 w-4 text-brand" />
        <h2 className="text-base font-semibold text-ink">
          {selectedProduct ? "Edit product" : "Create product"}
        </h2>
      </div>
      <div className="grid gap-3">
        <label className="grid gap-1 text-xs font-medium text-ink-muted">
          Branch
          <Select
            disabled={!owner}
            value={draft.branchId}
            onChange={(event) => onDraftChange({ branchId: event.target.value })}
          >
            {owner ? <option value="">All branches</option> : null}
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} ({branch.code})
              </option>
            ))}
          </Select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            Product name
            <Input
              value={draft.name}
              onChange={(event) => onDraftChange({ name: event.target.value })}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            SKU
            <Input
              value={draft.sku}
              onChange={(event) =>
                onDraftChange({ sku: event.target.value.toUpperCase() })
              }
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            HSN code
            <Input
              value={draft.hsnCode}
              onChange={(event) => onDraftChange({ hsnCode: event.target.value })}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            Price including GST
            <Input
              inputMode="decimal"
              value={draft.unitPrice}
              onChange={(event) =>
                onDraftChange({ unitPrice: event.target.value })
              }
            />
          </label>
        </div>
        <label className="grid gap-1 text-xs font-medium text-ink-muted">
          GST rate
          <Select
            value={draft.taxRateId}
            onChange={(event) => onDraftChange({ taxRateId: event.target.value })}
          >
            <option value="">Select GST rate</option>
            {hsnRates.map((taxRate) => (
              <option key={taxRate.id} value={taxRate.id}>
                {taxRate.code} - {taxRate.gstRate}% - {taxRate.description}
              </option>
            ))}
          </Select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            Current stock
            <Input
              disabled={Boolean(selectedProduct)}
              inputMode="numeric"
              value={draft.stockQuantity}
              onChange={(event) =>
                onDraftChange({ stockQuantity: event.target.value })
              }
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            Low stock threshold
            <Input
              inputMode="numeric"
              value={draft.lowStockThreshold}
              onChange={(event) =>
                onDraftChange({ lowStockThreshold: event.target.value })
              }
            />
          </label>
        </div>
        {selectedProduct ? (
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            Audit reason
            <Input
              value={draft.reason}
              onChange={(event) => onDraftChange({ reason: event.target.value })}
            />
          </label>
        ) : null}
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm font-medium text-ink-muted">
            <input
              checked={draft.trackStock}
              onChange={(event) =>
                onDraftChange({ trackStock: event.target.checked })
              }
              type="checkbox"
            />
            Track stock
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-ink-muted">
            <input
              checked={draft.isActive}
              onChange={(event) =>
                onDraftChange({ isActive: event.target.checked })
              }
              type="checkbox"
            />
            Active
          </label>
        </div>
        <Button disabled={pending || !draft.taxRateId} onClick={onSave}>
          {selectedProduct ? "Save product" : "Create product"}
        </Button>
        {selectedProduct ? (
          <Button
            disabled={pending}
            onClick={() => onToggleActive(selectedProduct)}
            variant={selectedProduct.isActive ? "danger" : "primary"}
          >
            {selectedProduct.isActive
              ? "Deactivate product"
              : "Reactivate product"}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
