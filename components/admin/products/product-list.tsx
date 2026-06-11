"use client";

import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BranchScopeSelect,
  type BranchOption,
} from "@/components/admin/shared";
import { cn, formatPaise } from "@/lib/utils";
import type { ProductRow } from "./types";

export function ProductList({
  products,
  branches,
  owner,
  search,
  branchFilter,
  selectedProductId,
  onSearchChange,
  onBranchFilterChange,
  onCreate,
  onEdit,
}: {
  products: readonly ProductRow[];
  branches: readonly BranchOption[];
  owner: boolean;
  search: string;
  branchFilter: string;
  selectedProductId: string | null;
  onSearchChange: (value: string) => void;
  onBranchFilterChange: (value: string) => void;
  onCreate: () => void;
  onEdit: (product: ProductRow) => void;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">Retail catalog</h2>
        <Button onClick={onCreate} variant="secondary">
          <Plus className="h-4 w-4" />
          New product
        </Button>
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-medium text-ink-muted">
          Search
          <Input
            placeholder="Cold drink, CHIPS-60"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-ink-muted">
          Branch
          <BranchScopeSelect
            owner={owner}
            branches={branches}
            value={branchFilter}
            onChange={onBranchFilterChange}
          />
        </label>
      </div>
      <div className="grid gap-2">
        {products.map((product) => (
          <button
            key={product.id}
            className={cn(
              "grid cursor-pointer gap-2 rounded-lg border p-3 text-left text-sm transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
              selectedProductId === product.id
                ? "border-brand bg-success-soft"
                : "border-line bg-surface",
            )}
            onClick={() => onEdit(product)}
            type="button"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-ink">{product.name}</p>
                <p className="text-xs text-ink-muted">
                  SKU {product.sku} - HSN {product.hsnCode} -{" "}
                  {product.branch?.name ?? "All branches"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>{formatPaise(product.unitPrice)}</Badge>
                <Badge>{product.taxRate.gstRate}% GST</Badge>
                <Badge tone={product.isActive ? "success" : "danger"}>
                  {product.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-ink-muted">
              <span>
                {product.trackStock ? "Stock tracked" : "Stock not tracked"}
              </span>
              {product.trackStock ? (
                <span>
                  Stock {product.stockQuantity}, low at{" "}
                  {product.lowStockThreshold}
                </span>
              ) : null}
            </div>
          </button>
        ))}
        {products.length === 0 ? (
          <p className="rounded-md border border-line p-4 text-sm text-ink-muted">
            No products found.
          </p>
        ) : null}
      </div>
    </div>
  );
}
