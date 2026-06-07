"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { formatPaise } from "@/lib/utils";

type Catalog = {
  services: Array<{
    id: string;
    name: string;
    sacCode: string;
    isActive: boolean;
    pricingRule: { ratePerMinute: number; minimumBillableMinutes: number };
    taxRate: { gstRate: string; code: string };
  }>;
  products: Array<{
    id: string;
    name: string;
    sku: string;
    hsnCode: string;
    unitPrice: number;
    stockQuantity: number;
    lowStockThreshold: number;
    taxRate: { gstRate: string; code: string };
  }>;
  resources: Array<{
    id: string;
    name: string;
    kind: string;
    status: string;
  }>;
  taxRates: Array<{
    id: string;
    code: string;
    kind: string;
    description: string;
    gstRate: string;
  }>;
};

export function AdminShell() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/catalog", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Admin catalog requires manager or owner access.");
        }
        return (await response.json()) as Catalog;
      })
      .then(setCatalog)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Unable to load admin."),
      );
  }, []);

  return (
    <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h1 className="text-xl font-semibold tracking-normal">Admin</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Catalog, GST, pricing, stock, and resources. Sensitive changes are audited.
        </p>
      </section>
      {error ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          {error}
        </div>
      ) : null}
      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Timed services">
          {catalog?.services.map((service) => (
            <Row key={service.id}>
              <div>
                <p className="font-medium">{service.name}</p>
                <p className="text-xs text-zinc-600">
                  SAC {service.sacCode} · GST {service.taxRate.gstRate}% · min{" "}
                  {service.pricingRule.minimumBillableMinutes} min
                </p>
              </div>
              <Badge>{formatPaise(service.pricingRule.ratePerMinute)}/min</Badge>
            </Row>
          ))}
        </Panel>
        <Panel title="Food and drinks">
          {catalog?.products.map((product) => (
            <Row key={product.id}>
              <div>
                <p className="font-medium">{product.name}</p>
                <p className="text-xs text-zinc-600">
                  SKU {product.sku} · HSN {product.hsnCode}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatPaise(product.unitPrice)}</p>
                <p className="text-xs text-zinc-600">
                  Stock {product.stockQuantity}
                </p>
              </div>
            </Row>
          ))}
        </Panel>
        <Panel title="Resources">
          {catalog?.resources.map((resource) => (
            <Row key={resource.id}>
              <span className="font-medium">{resource.name}</span>
              <Badge>{resource.status}</Badge>
            </Row>
          ))}
        </Panel>
        <Panel title="GST rates">
          {catalog?.taxRates.map((taxRate) => (
            <Row key={taxRate.id}>
              <div>
                <p className="font-medium">
                  {taxRate.kind} {taxRate.code}
                </p>
                <p className="text-xs text-zinc-600">{taxRate.description}</p>
              </div>
              <Badge>{taxRate.gstRate}%</Badge>
            </Row>
          ))}
        </Panel>
      </section>
    </main>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      <div className="grid gap-2">{children}</div>
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2 text-sm">
      {children}
    </div>
  );
}
