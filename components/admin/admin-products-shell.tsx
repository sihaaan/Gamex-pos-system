"use client";

import { Package } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminPageHeader,
  StatusMessages,
  paiseToRupeeInput,
  responseMessage,
  rupeeInputToPaise,
  type BranchOption,
  type CurrentUser,
  type TaxRateOption,
} from "@/components/admin/shared";
import { catalogBranchFilterMatches } from "@/lib/admin/catalog-filter";
import { ProductForm } from "./products/product-form";
import { ProductList } from "./products/product-list";
import { StockAdjustmentForm } from "./products/stock-adjustment-form";
import {
  emptyProductDraft,
  emptyStockDraft,
  type ProductDraft,
  type ProductRow,
  type StockDraft,
} from "./products/types";

export function AdminProductsShell() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [draft, setDraft] = useState<ProductDraft>(emptyProductDraft);
  const [stockDraft, setStockDraft] = useState<StockDraft>(emptyStockDraft);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );
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
    if (
      !branchFilter &&
      mePayload.user.role === "MANAGER" &&
      mePayload.user.branchId
    ) {
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
      ...emptyProductDraft,
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
        editing
          ? `/api/admin/products/${selectedProductId}`
          : "/api/admin/products",
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
        throw new Error(
          await responseMessage(response, "Unable to save product."),
        );
      }
      await load();
      setMessage(editing ? "Product updated." : "Product created.");
      if (!editing) {
        setSelectedProductId(null);
        setDraft({
          ...emptyProductDraft,
          branchId: draft.branchId,
          taxRateId: draft.taxRateId,
        });
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save product.",
      );
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
      const response = await fetch(
        `/api/admin/products/${product.id}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: product.isActive
              ? `Deactivate ${product.name}`
              : `Reactivate ${product.name}`,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(
          await responseMessage(response, `Unable to ${action} product.`),
        );
      }
      await load();
      setMessage(
        product.isActive ? "Product deactivated." : "Product reactivated.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : `Unable to ${action} product.`,
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
        throw new Error(
          await responseMessage(response, "Unable to adjust stock."),
        );
      }
      await load();
      setStockDraft(emptyStockDraft);
      setMessage("Stock adjusted.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to adjust stock.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <AdminPageHeader
        icon={Package}
        title="Products"
        description="Manage snacks, drinks, GST codes, prices, and stock adjustments."
      />

      <StatusMessages error={error} message={message} />

      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.9fr]">
        <ProductList
          products={filteredProducts}
          branches={branches}
          owner={owner}
          search={search}
          branchFilter={branchFilter}
          selectedProductId={selectedProductId}
          onSearchChange={setSearch}
          onBranchFilterChange={setBranchFilter}
          onCreate={startCreate}
          onEdit={startEdit}
        />

        <aside className="grid gap-4">
          <ProductForm
            draft={draft}
            branches={branches}
            hsnRates={activeHsnRates}
            owner={owner}
            pending={pending}
            selectedProduct={selectedProduct}
            onDraftChange={(patch) =>
              setDraft((current) => ({ ...current, ...patch }))
            }
            onSave={() => void saveProduct()}
            onToggleActive={(product) => void toggleProduct(product)}
          />

          {selectedProduct ? (
            <StockAdjustmentForm
              product={selectedProduct}
              stockDraft={stockDraft}
              pending={pending}
              onStockDraftChange={(patch) =>
                setStockDraft((current) => ({ ...current, ...patch }))
              }
              onAdjust={() => void adjustStock()}
            />
          ) : null}
        </aside>
      </section>
    </main>
  );
}
