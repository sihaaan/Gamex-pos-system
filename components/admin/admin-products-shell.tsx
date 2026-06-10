"use client";

import { Package, Pencil, Plus, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { catalogBranchFilterMatches } from "@/lib/admin/catalog-filter";
import { cn, formatPaise } from "@/lib/utils";

type Role = "OWNER" | "MANAGER" | "STAFF";

type CurrentUser = {
  role: Role;
  branchId: string | null;
};

type BranchOption = {
  id: string;
  name: string;
  code: string;
};

type TaxRateOption = {
  id: string;
  code: string;
  kind: "HSN" | "SAC";
  description: string;
  gstRate: string;
  effectiveTo: string | null;
};

type ProductRow = {
  id: string;
  branchId: string | null;
  taxRateId: string;
  sku: string;
  name: string;
  hsnCode: string;
  unitPrice: number;
  trackStock: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  isActive: boolean;
  branch: { id: string; name: string; code: string } | null;
  taxRate: TaxRateOption;
};

type ProductDraft = {
  branchId: string;
  taxRateId: string;
  sku: string;
  name: string;
  hsnCode: string;
  unitPrice: string;
  trackStock: boolean;
  stockQuantity: string;
  lowStockThreshold: string;
  isActive: boolean;
  reason: string;
};

type StockDraft = {
  adjustmentType: "INCREASE" | "DECREASE" | "SET_COUNT";
  quantity: string;
  reason: string;
};

const emptyDraft: ProductDraft = {
  branchId: "",
  taxRateId: "",
  sku: "",
  name: "",
  hsnCode: "",
  unitPrice: "",
  trackStock: true,
  stockQuantity: "0",
  lowStockThreshold: "0",
  isActive: true,
  reason: "",
};

const emptyStockDraft: StockDraft = {
  adjustmentType: "INCREASE",
  quantity: "",
  reason: "",
};

export function AdminProductsShell() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [stockDraft, setStockDraft] = useState<StockDraft>(emptyStockDraft);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );
  const activeHsnRates = taxRates.filter(
    (taxRate) => taxRate.kind === "HSN" && !taxRate.effectiveTo,
  );
  const owner = currentUser?.role === "OWNER";

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return products.filter((product) => {
      const branchMatch = catalogBranchFilterMatches(product, branchFilter);
      const searchMatch =
        !normalizedSearch ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.sku.toLowerCase().includes(normalizedSearch) ||
        product.hsnCode.toLowerCase().includes(normalizedSearch);
      return branchMatch && searchMatch;
    });
  }, [branchFilter, products, search]);

  const load = useCallback(async () => {
    setError(null);
    const [meResponse, branchesResponse, productsResponse, taxRatesResponse] =
      await Promise.all([
        fetch("/api/auth/me", { cache: "no-store" }),
        fetch("/api/admin/branches", { cache: "no-store" }),
        fetch("/api/admin/products", { cache: "no-store" }),
        fetch("/api/admin/gst-rates", { cache: "no-store" }),
      ]);
    if (
      !meResponse.ok ||
      !branchesResponse.ok ||
      !productsResponse.ok ||
      !taxRatesResponse.ok
    ) {
      throw new Error("Unable to load products.");
    }

    const mePayload = (await meResponse.json()) as { user: CurrentUser };
    const branchesPayload = (await branchesResponse.json()) as {
      branches: BranchOption[];
    };
    const productsPayload = (await productsResponse.json()) as {
      products: ProductRow[];
    };
    const taxRatesPayload = (await taxRatesResponse.json()) as {
      taxRates: TaxRateOption[];
    };

    setCurrentUser(mePayload.user);
    setBranches(branchesPayload.branches);
    setProducts(productsPayload.products);
    setTaxRates(taxRatesPayload.taxRates);
    if (!branchFilter && mePayload.user.role === "MANAGER" && mePayload.user.branchId) {
      setBranchFilter(mePayload.user.branchId);
    }
  }, [branchFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      load().catch((caught: unknown) =>
        setError(
          caught instanceof Error ? caught.message : "Unable to load products.",
        ),
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  function startCreate() {
    setSelectedProductId(null);
    setMessage(null);
    setStockDraft(emptyStockDraft);
    setDraft({
      ...emptyDraft,
      branchId:
        currentUser?.role === "MANAGER"
          ? (currentUser.branchId ?? "")
          : (branches[0]?.id ?? ""),
      taxRateId: activeHsnRates[0]?.id ?? "",
    });
  }

  function startEdit(product: ProductRow) {
    setSelectedProductId(product.id);
    setMessage(null);
    setStockDraft(emptyStockDraft);
    setDraft({
      branchId: product.branchId ?? "",
      taxRateId: product.taxRateId,
      sku: product.sku,
      name: product.name,
      hsnCode: product.hsnCode,
      unitPrice: paiseToRupeeInput(product.unitPrice),
      trackStock: product.trackStock,
      stockQuantity: String(product.stockQuantity),
      lowStockThreshold: String(product.lowStockThreshold),
      isActive: product.isActive,
      reason: `Update ${product.name}`,
    });
  }

  async function saveProduct() {
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const editing = Boolean(selectedProductId);
      const response = await fetch(
        editing ? `/api/admin/products/${selectedProductId}` : "/api/admin/products",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branchId: draft.branchId || null,
            taxRateId: draft.taxRateId,
            sku: draft.sku,
            name: draft.name,
            hsnCode: draft.hsnCode,
            unitPrice: rupeeInputToPaise(draft.unitPrice),
            trackStock: draft.trackStock,
            stockQuantity: Number(draft.stockQuantity),
            lowStockThreshold: Number(draft.lowStockThreshold),
            isActive: draft.isActive,
            reason: draft.reason || undefined,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(await responseMessage(response, "Unable to save product."));
      }
      await load();
      setMessage(editing ? "Product updated." : "Product created.");
      if (!editing) {
        setSelectedProductId(null);
        setDraft({
          ...emptyDraft,
          branchId: draft.branchId,
          taxRateId: draft.taxRateId,
        });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save product.");
    } finally {
      setPending(false);
    }
  }

  async function toggleProduct(product: ProductRow) {
    const action = product.isActive ? "deactivate" : "reactivate";
    const confirmed = window.confirm(
      product.isActive
        ? `Deactivate ${product.name}? It will disappear from POS selling options.`
        : `Reactivate ${product.name}?`,
    );
    if (!confirmed) {
      return;
    }

    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/products/${product.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: product.isActive
            ? `Deactivate ${product.name}`
            : `Reactivate ${product.name}`,
        }),
      });
      if (!response.ok) {
        throw new Error(await responseMessage(response, `Unable to ${action} product.`));
      }
      await load();
      setMessage(product.isActive ? "Product deactivated." : "Product reactivated.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : `Unable to ${action} product.`,
      );
    } finally {
      setPending(false);
    }
  }

  async function adjustStock() {
    if (!selectedProduct) {
      return;
    }
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/products/${selectedProduct.id}/stock-adjustment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            adjustmentType: stockDraft.adjustmentType,
            quantity: Number(stockDraft.quantity),
            reason: stockDraft.reason,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(await responseMessage(response, "Unable to adjust stock."));
      }
      await load();
      setStockDraft(emptyStockDraft);
      setMessage("Stock adjusted.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to adjust stock.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <div>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-700" />
            <h1 className="text-xl font-semibold tracking-normal">Products</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-600">
            Manage snacks, drinks, GST codes, prices, and stock adjustments.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/admin">Back to admin</Link>
        </Button>
      </section>

      <StatusMessages error={error} message={message} />

      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.9fr]">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Retail catalog</h2>
            <Button onClick={startCreate} variant="secondary">
              <Plus className="h-4 w-4" />
              New product
            </Button>
          </div>
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Search
              <Input
                placeholder="Cold drink, CHIPS-60"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Branch
              <select
                className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 disabled:bg-zinc-100"
                disabled={!owner}
                value={branchFilter}
                onChange={(event) => setBranchFilter(event.target.value)}
              >
                {owner ? (
                  <>
                    <option value="">All scopes</option>
                    <option value="GLOBAL">Legal entity global</option>
                  </>
                ) : null}
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-2">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                className={cn(
                  "grid gap-2 rounded-md border p-3 text-left text-sm transition hover:bg-zinc-50",
                  selectedProductId === product.id
                    ? "border-emerald-600 bg-emerald-50"
                    : "border-zinc-200 bg-white",
                )}
                onClick={() => startEdit(product)}
                type="button"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{product.name}</p>
                    <p className="text-xs text-zinc-600">
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
                <div className="flex flex-wrap gap-3 text-xs text-zinc-600">
                  <span>{product.trackStock ? "Stock tracked" : "Stock not tracked"}</span>
                  {product.trackStock ? (
                    <span>
                      Stock {product.stockQuantity}, low at{" "}
                      {product.lowStockThreshold}
                    </span>
                  ) : null}
                </div>
              </button>
            ))}
            {filteredProducts.length === 0 ? (
              <p className="rounded-md border border-zinc-200 p-4 text-sm text-zinc-600">
                No products found.
              </p>
            ) : null}
          </div>
        </div>

        <aside className="grid gap-4">
          <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <Pencil className="h-4 w-4 text-emerald-700" />
              <h2 className="text-base font-semibold">
                {selectedProduct ? "Edit product" : "Create product"}
              </h2>
            </div>
            <div className="grid gap-3">
              <label className="grid gap-1 text-xs font-medium text-zinc-600">
                Branch
                <select
                  className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 disabled:bg-zinc-100"
                  disabled={!owner}
                  value={draft.branchId}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      branchId: event.target.value,
                    }))
                  }
                >
                  {owner ? <option value="">All branches</option> : null}
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} ({branch.code})
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-medium text-zinc-600">
                  Product name
                  <Input
                    value={draft.name}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-zinc-600">
                  SKU
                  <Input
                    value={draft.sku}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        sku: event.target.value.toUpperCase(),
                      }))
                    }
                  />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-medium text-zinc-600">
                  HSN code
                  <Input
                    value={draft.hsnCode}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        hsnCode: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-zinc-600">
                  Price including GST
                  <Input
                    inputMode="decimal"
                    value={draft.unitPrice}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        unitPrice: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <label className="grid gap-1 text-xs font-medium text-zinc-600">
                GST rate
                <select
                  className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950"
                  value={draft.taxRateId}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      taxRateId: event.target.value,
                    }))
                  }
                >
                  <option value="">Select GST rate</option>
                  {activeHsnRates.map((taxRate) => (
                    <option key={taxRate.id} value={taxRate.id}>
                      {taxRate.code} - {taxRate.gstRate}% - {taxRate.description}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-medium text-zinc-600">
                  Current stock
                  <Input
                    disabled={Boolean(selectedProduct)}
                    inputMode="numeric"
                    value={draft.stockQuantity}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        stockQuantity: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-zinc-600">
                  Low stock threshold
                  <Input
                    inputMode="numeric"
                    value={draft.lowStockThreshold}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        lowStockThreshold: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              {selectedProduct ? (
                <label className="grid gap-1 text-xs font-medium text-zinc-600">
                  Audit reason
                  <Input
                    value={draft.reason}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        reason: event.target.value,
                      }))
                    }
                  />
                </label>
              ) : null}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                  <input
                    checked={draft.trackStock}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        trackStock: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  Track stock
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                  <input
                    checked={draft.isActive}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        isActive: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  Active
                </label>
              </div>
              <Button disabled={pending || !draft.taxRateId} onClick={saveProduct}>
                {selectedProduct ? "Save product" : "Create product"}
              </Button>
              {selectedProduct ? (
                <Button
                  disabled={pending}
                  onClick={() => toggleProduct(selectedProduct)}
                  variant={selectedProduct.isActive ? "danger" : "primary"}
                >
                  {selectedProduct.isActive
                    ? "Deactivate product"
                    : "Reactivate product"}
                </Button>
              ) : null}
            </div>
          </section>

          {selectedProduct ? (
            <section className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-emerald-700" />
                <h2 className="text-base font-semibold">Stock adjustment</h2>
              </div>
              {selectedProduct.trackStock && selectedProduct.branchId ? (
                <div className="grid gap-3">
                  <p className="text-sm text-zinc-600">
                    Current stock:{" "}
                    <span className="font-semibold text-zinc-950">
                      {selectedProduct.stockQuantity}
                    </span>
                  </p>
                  <label className="grid gap-1 text-xs font-medium text-zinc-600">
                    Adjustment type
                    <select
                      className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950"
                      value={stockDraft.adjustmentType}
                      onChange={(event) =>
                        setStockDraft((current) => ({
                          ...current,
                          adjustmentType: event.target.value as StockDraft["adjustmentType"],
                        }))
                      }
                    >
                      <option value="INCREASE">Increase</option>
                      <option value="DECREASE">Decrease</option>
                      <option value="SET_COUNT">Set count</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-zinc-600">
                    Quantity
                    <Input
                      inputMode="numeric"
                      value={stockDraft.quantity}
                      onChange={(event) =>
                        setStockDraft((current) => ({
                          ...current,
                          quantity: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-zinc-600">
                    Reason
                    <Input
                      value={stockDraft.reason}
                      onChange={(event) =>
                        setStockDraft((current) => ({
                          ...current,
                          reason: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <Button
                    disabled={
                      pending ||
                      !stockDraft.reason.trim() ||
                      Number(stockDraft.quantity) < 0
                    }
                    onClick={adjustStock}
                    variant="secondary"
                  >
                    Adjust stock
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-zinc-600">
                  Stock adjustment is available for stock-tracked branch products.
                </p>
              )}
            </section>
          ) : null}
        </aside>
      </section>
    </main>
  );
}

function StatusMessages({
  error,
  message,
}: {
  error: string | null;
  message: string | null;
}) {
  return (
    <>
      {message ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-900">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-900">
          {error}
        </div>
      ) : null}
    </>
  );
}

async function responseMessage(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return payload?.error?.message ?? fallback;
}

function rupeeInputToPaise(value: string): number {
  return Math.round(Number(value || "0") * 100);
}

function paiseToRupeeInput(value: number): string {
  return (value / 100).toFixed(2);
}
