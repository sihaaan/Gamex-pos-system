"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Building2,
  Gamepad2,
  IndianRupee,
  Package,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPaise } from "@/lib/utils";

type Catalog = {
  branches: Array<{
    id: string;
    name: string;
    code: string;
  }>;
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
  discountRules: DiscountRule[];
};

type DiscountRule = {
  id: string;
  branchId: string | null;
  name: string;
  discountPercent: number;
  minimumBillableMinutes: number;
  daysOfWeek: number[];
  startMinuteOfDay: number;
  endMinuteOfDay: number;
  isActive: boolean;
  branch?: { name: string; code: string } | null;
};

type DiscountRuleDraft = {
  id?: string;
  branchId: string;
  name: string;
  discountPercent: string;
  minimumBillableMinutes: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  isActive: boolean;
  reason: string;
};

const defaultDiscountRuleDraft: DiscountRuleDraft = {
  branchId: "",
  name: "Happy Hour",
  discountPercent: "30",
  minimumBillableMinutes: "60",
  daysOfWeek: [1, 2],
  startTime: "10:00",
  endTime: "17:00",
  isActive: true,
  reason: "Configure Happy Hour timed play discount",
};

const weekdays = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

export function AdminShell() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [discountDraft, setDiscountDraft] = useState<DiscountRuleDraft>(
    defaultDiscountRuleDraft,
  );
  const [discountMessage, setDiscountMessage] = useState<string | null>(null);
  const [savingDiscount, setSavingDiscount] = useState(false);

  const loadCatalog = useCallback(async () => {
    return fetch("/api/admin/catalog", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Admin catalog requires manager or owner access.");
        }
        return (await response.json()) as Catalog;
      })
      .then(setCatalog);
  }, []);

  useEffect(() => {
    loadCatalog()
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Unable to load admin."),
      );
  }, [loadCatalog]);

  function editDiscountRule(rule: DiscountRule) {
    setDiscountMessage(null);
    setDiscountDraft({
      id: rule.id,
      branchId: rule.branchId ?? "",
      name: rule.name,
      discountPercent: String(rule.discountPercent),
      minimumBillableMinutes: String(rule.minimumBillableMinutes),
      daysOfWeek: rule.daysOfWeek,
      startTime: minuteOfDayToTime(rule.startMinuteOfDay),
      endTime: minuteOfDayToTime(rule.endMinuteOfDay),
      isActive: rule.isActive,
      reason: `Update ${rule.name}`,
    });
  }

  function toggleWeekday(day: number) {
    setDiscountDraft((current) => {
      const nextDays = current.daysOfWeek.includes(day)
        ? current.daysOfWeek.filter((value) => value !== day)
        : [...current.daysOfWeek, day].sort((left, right) => left - right);
      return { ...current, daysOfWeek: nextDays };
    });
  }

  async function saveDiscountRule() {
    setSavingDiscount(true);
    setDiscountMessage(null);
    try {
      const response = await fetch("/api/admin/discount-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: discountDraft.id,
          branchId: discountDraft.branchId || null,
          name: discountDraft.name,
          discountPercent: Number(discountDraft.discountPercent),
          minimumBillableMinutes: Number(discountDraft.minimumBillableMinutes),
          daysOfWeek: discountDraft.daysOfWeek,
          startMinuteOfDay: timeToMinuteOfDay(discountDraft.startTime),
          endMinuteOfDay: timeToMinuteOfDay(discountDraft.endTime),
          isActive: discountDraft.isActive,
          reason: discountDraft.reason,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(
          payload?.error?.message ?? "Unable to save discount rule.",
        );
      }

      await loadCatalog();
      setDiscountDraft(defaultDiscountRuleDraft);
      setDiscountMessage("Discount rule saved.");
    } catch (caught) {
      setDiscountMessage(
        caught instanceof Error ? caught.message : "Unable to save discount rule.",
      );
    } finally {
      setSavingDiscount(false);
    }
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h1 className="text-xl font-semibold tracking-normal">Admin</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Catalog, GST, pricing, stock, and resources. Sensitive changes are audited.
        </p>
      </section>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <AdminCard
          description="Create staff, reset passwords, deactivate access."
          href="/admin/users"
          icon={<Users className="h-5 w-5" />}
          title="Users"
        />
        <AdminCard
          description="GST branch details, status, and resource counts."
          href="/admin/branches"
          icon={<Building2 className="h-5 w-5" />}
          title="Branches"
        />
        <AdminCard
          description="Pool tables and PS5 consoles."
          icon={<Gamepad2 className="h-5 w-5" />}
          title="Resources"
        />
        <AdminCard
          description="Food, drinks, services, and stock."
          icon={<Package className="h-5 w-5" />}
          title="Products/services"
        />
        <AdminCard
          description="GST rates, pricing rules, and discounts."
          icon={<IndianRupee className="h-5 w-5" />}
          title="GST/pricing"
        />
      </section>
      {error ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          {error}
        </div>
      ) : null}
      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Discount rules">
          <div className="grid gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-medium text-zinc-600">
                Name
                <Input
                  value={discountDraft.name}
                  onChange={(event) =>
                    setDiscountDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-zinc-600">
                Branch
                <select
                  className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950"
                  value={discountDraft.branchId}
                  onChange={(event) =>
                    setDiscountDraft((current) => ({
                      ...current,
                      branchId: event.target.value,
                    }))
                  }
                >
                  <option value="">All branches</option>
                  {catalog?.branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-zinc-600">
                Discount %
                <Input
                  inputMode="numeric"
                  value={discountDraft.discountPercent}
                  onChange={(event) =>
                    setDiscountDraft((current) => ({
                      ...current,
                      discountPercent: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-zinc-600">
                Minimum minutes
                <Input
                  inputMode="numeric"
                  value={discountDraft.minimumBillableMinutes}
                  onChange={(event) =>
                    setDiscountDraft((current) => ({
                      ...current,
                      minimumBillableMinutes: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-zinc-600">
                Start time
                <Input
                  type="time"
                  value={discountDraft.startTime}
                  onChange={(event) =>
                    setDiscountDraft((current) => ({
                      ...current,
                      startTime: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-zinc-600">
                End time
                <Input
                  type="time"
                  value={discountDraft.endTime}
                  onChange={(event) =>
                    setDiscountDraft((current) => ({
                      ...current,
                      endTime: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="grid gap-1">
              <span className="text-xs font-medium text-zinc-600">Days</span>
              <div className="flex flex-wrap gap-2">
                {weekdays.map((day) => (
                  <button
                    key={day.value}
                    className={`min-h-9 rounded-md border px-3 text-sm font-medium ${
                      discountDraft.daysOfWeek.includes(day.value)
                        ? "border-emerald-700 bg-emerald-700 text-white"
                        : "border-zinc-300 bg-white text-zinc-700"
                    }`}
                    onClick={() => toggleWeekday(day.value)}
                    type="button"
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
              <input
                checked={discountDraft.isActive}
                onChange={(event) =>
                  setDiscountDraft((current) => ({
                    ...current,
                    isActive: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              Active
            </label>
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Audit reason
              <Input
                value={discountDraft.reason}
                onChange={(event) =>
                  setDiscountDraft((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                disabled={savingDiscount}
                onClick={saveDiscountRule}
              >
                {savingDiscount
                  ? "Saving"
                  : discountDraft.id
                    ? "Save changes"
                    : "Create rule"}
              </Button>
              {discountDraft.id ? (
                <Button
                  onClick={() => setDiscountDraft(defaultDiscountRuleDraft)}
                  variant="ghost"
                >
                  New rule
                </Button>
              ) : null}
              {discountMessage ? (
                <span className="text-sm font-medium text-zinc-700">
                  {discountMessage}
                </span>
              ) : null}
            </div>
          </div>
          {catalog?.discountRules.map((rule) => (
            <Row key={rule.id}>
              <div>
                <p className="font-medium">{rule.name}</p>
                <p className="text-xs text-zinc-600">
                  {rule.discountPercent}% after {rule.minimumBillableMinutes} min
                  {" - "}
                  {formatWeekdays(rule.daysOfWeek)} {minuteOfDayToTime(rule.startMinuteOfDay)}
                  -{minuteOfDayToTime(rule.endMinuteOfDay)}
                  {" - "}
                  {rule.branch?.name ?? "All branches"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={rule.isActive ? "success" : "warning"}>
                  {rule.isActive ? "Active" : "Off"}
                </Badge>
                <Button onClick={() => editDiscountRule(rule)} variant="secondary">
                  Edit
                </Button>
              </div>
            </Row>
          ))}
          {!catalog || catalog.discountRules.length > 0 ? null : (
            <p className="text-sm text-zinc-600">No discount rules configured.</p>
          )}
        </Panel>
        <Panel title="Timed services">
          {catalog?.services.map((service) => (
            <Row key={service.id}>
              <div>
                <p className="font-medium">{service.name}</p>
                <p className="text-xs text-zinc-600">
                  SAC {service.sacCode} - GST {service.taxRate.gstRate}% - min{" "}
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
                  SKU {product.sku} - HSN {product.hsnCode}
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

function AdminCard({
  title,
  description,
  icon,
  href,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-emerald-50 text-emerald-800">
          {icon}
        </span>
        {href ? (
          <span className="text-xs font-semibold text-emerald-800">Open</span>
        ) : (
          <span className="text-xs font-semibold text-zinc-500">Later</span>
        )}
      </div>
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-zinc-600">{description}</p>
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        className="grid min-h-36 gap-3 rounded-lg border border-zinc-200 bg-white p-4 text-sm transition hover:border-emerald-500 hover:bg-emerald-50"
        href={href}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="grid min-h-36 gap-3 rounded-lg border border-zinc-200 bg-white p-4 text-sm opacity-80">
      {content}
    </div>
  );
}

function timeToMinuteOfDay(value: string): number {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}

function minuteOfDayToTime(value: number): string {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatWeekdays(days: readonly number[]): string {
  const labelByDay = new Map(weekdays.map((day) => [day.value, day.label]));
  return days.map((day) => labelByDay.get(day) ?? String(day)).join(", ");
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
