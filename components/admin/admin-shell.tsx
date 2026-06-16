"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Building2,
  BadgePercent,
  FileText,
  Gamepad2,
  IndianRupee,
  LayoutDashboard,
  Map as MapIcon,
  Package,
  Timer,
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
    <main className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <section className="flex items-center gap-3.5 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <span className="brand-gradient grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-sm ring-1 ring-white/15">
          <LayoutDashboard className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Admin</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Catalog, GST, pricing, stock, and resources. Sensitive changes are
            audited.
          </p>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <AdminCard
          description="Create staff, reset passwords, deactivate access."
          href="/admin/users"
          icon={<Users className="h-5 w-5" />}
          title="Users"
        />
        <AdminCard
          description="Legal entity GSTIN, address, and state code."
          href="/admin/business"
          icon={<FileText className="h-5 w-5" />}
          title="Business profile"
        />
        <AdminCard
          description="GST branch details, status, and resource counts."
          href="/admin/branches"
          icon={<Building2 className="h-5 w-5" />}
          title="Branches"
        />
        <AdminCard
          description="Pool tables and PS5 consoles."
          href="/admin/resources"
          icon={<Gamepad2 className="h-5 w-5" />}
          title="Resources"
        />
        <AdminCard
          description="Food, drinks, services, and stock."
          href="/admin/products"
          icon={<Package className="h-5 w-5" />}
          title="Products"
        />
        <AdminCard
          description="Pool and PS5 rates and billing rules."
          href="/admin/pricing"
          icon={<Timer className="h-5 w-5" />}
          title="Pricing"
        />
        <AdminCard
          description="HSN/SAC rates with effective dates."
          href="/admin/gst-rates"
          icon={<IndianRupee className="h-5 w-5" />}
          title="GST rates"
        />
        <AdminCard
          description="Arrange tables and consoles for the POS floor view."
          href="/admin/floor-map"
          icon={<MapIcon className="h-5 w-5" />}
          title="Floor Map"
        />
        <AdminCard
          description="Happy hour and timed play discounts."
          icon={<BadgePercent className="h-5 w-5" />}
          title="Discounts"
        />
      </section>
      {error ? (
        <div className="rounded-md border border-warning-line bg-warning-soft p-3 text-sm text-warning-ink">
          {error}
        </div>
      ) : null}
      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Discount rules">
          <div className="grid gap-3 rounded-md border border-success-line bg-success-soft p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-medium text-ink-muted">
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
              <label className="grid gap-1 text-xs font-medium text-ink-muted">
                Branch
                <select
                  className="min-h-10 rounded-md border border-line-strong bg-surface px-3 text-sm text-ink"
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
              <label className="grid gap-1 text-xs font-medium text-ink-muted">
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
              <label className="grid gap-1 text-xs font-medium text-ink-muted">
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
              <label className="grid gap-1 text-xs font-medium text-ink-muted">
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
              <label className="grid gap-1 text-xs font-medium text-ink-muted">
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
              <span className="text-xs font-medium text-ink-muted">Days</span>
              <div className="flex flex-wrap gap-2">
                {weekdays.map((day) => (
                  <button
                    key={day.value}
                    className={`min-h-9 rounded-lg border px-3 text-sm font-semibold transition ${
                      discountDraft.daysOfWeek.includes(day.value)
                        ? "border-brand bg-brand text-white dark:text-zinc-950"
                        : "border-line-strong bg-surface text-ink-muted hover:border-brand hover:text-ink"
                    }`}
                    onClick={() => toggleWeekday(day.value)}
                    type="button"
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-ink-muted">
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
            <label className="grid gap-1 text-xs font-medium text-ink-muted">
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
                <span className="text-sm font-medium text-ink-muted">
                  {discountMessage}
                </span>
              ) : null}
            </div>
          </div>
          {catalog?.discountRules.map((rule) => (
            <Row key={rule.id}>
              <div>
                <p className="font-medium">{rule.name}</p>
                <p className="text-xs text-ink-muted">
                  {rule.discountPercent}% after {rule.minimumBillableMinutes} min
                  {" - "}
                  {formatWeekdays(rule.daysOfWeek)} {minuteOfDayToTime(rule.startMinuteOfDay)}
                  -{minuteOfDayToTime(rule.endMinuteOfDay)}
                  {" - "}
                  {rule.branch?.name ?? "All branches"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={rule.isActive ? "success" : "warning"} dot>
                  {rule.isActive ? "Active" : "Off"}
                </Badge>
                <Button onClick={() => editDiscountRule(rule)} variant="secondary">
                  Edit
                </Button>
              </div>
            </Row>
          ))}
          {!catalog || catalog.discountRules.length > 0 ? null : (
            <p className="text-sm text-ink-muted">No discount rules configured.</p>
          )}
        </Panel>
        <Panel title="Timed services">
          {catalog?.services.map((service) => (
            <Row key={service.id}>
              <div>
                <p className="font-medium">{service.name}</p>
                <p className="text-xs text-ink-muted">
                  SAC {service.sacCode} - GST {service.taxRate.gstRate}% - min{" "}
                  {service.pricingRule.minimumBillableMinutes} min
                </p>
              </div>
              <Badge>{formatPaise(service.pricingRule.ratePerMinute * 60)}/hr</Badge>
            </Row>
          ))}
        </Panel>
        <Panel title="Food and drinks">
          {catalog?.products.map((product) => (
            <Row key={product.id}>
              <div>
                <p className="font-medium">{product.name}</p>
                <p className="text-xs text-ink-muted">
                  SKU {product.sku} - HSN {product.hsnCode}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatPaise(product.unitPrice)}</p>
                <p className="text-xs text-ink-muted">
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
                <p className="text-xs text-ink-muted">{taxRate.description}</p>
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
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand-strong ring-1 ring-inset ring-brand/20">
          {icon}
        </span>
        {href ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand transition-all group-hover:gap-1.5">
            Open
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        ) : (
          <Badge>Later</Badge>
        )}
      </div>
      <div>
        <h2 className="text-base font-bold tracking-tight text-ink">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-ink-muted">{description}</p>
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        className="group grid min-h-36 gap-4 rounded-2xl border border-line bg-surface p-5 text-sm shadow-card transition-all hover:-translate-y-0.5 hover:border-brand hover:shadow-float"
        href={href}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="grid min-h-36 gap-4 rounded-2xl border border-line bg-surface p-5 text-sm opacity-70 shadow-card">
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
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <h2 className="mb-3 text-base font-bold tracking-tight text-ink">
        {title}
      </h2>
      <div className="grid gap-2">{children}</div>
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-line bg-surface-muted px-3 py-2 text-sm">
      {children}
    </div>
  );
}
