"use client";

import { Clock3, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { catalogBranchFilterMatches } from "@/lib/admin/catalog-filter";
import {
  activeBranchOverrideForService,
  activeGlobalDefaultForService,
  effectiveServiceForBranch,
  pricingEditActionLabel,
  pricingServiceFamilyKey,
  pricingScopeLabel,
} from "@/lib/admin/pricing-display";
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

type ServiceRow = {
  id: string;
  branchId: string | null;
  taxRateId: string;
  name: string;
  sacCode: string;
  description: string;
  isActive: boolean;
  branch: { id: string; name: string; code: string } | null;
  taxRate: TaxRateOption;
  pricingRule: {
    ratePerMinute: number;
    minimumBillableMinutes: number;
    roundUpToMinutes: number;
    managerDiscountLimitPercent: number;
  };
};

type ServiceDraft = {
  branchId: string;
  taxRateId: string;
  name: string;
  sacCode: string;
  description: string;
  ratePerMinute: string;
  minimumBillableMinutes: string;
  roundUpToMinutes: string;
  managerDiscountLimitPercent: string;
  isActive: boolean;
  reason: string;
};

const emptyDraft: ServiceDraft = {
  branchId: "",
  taxRateId: "",
  name: "",
  sacCode: "9996",
  description: "",
  ratePerMinute: "",
  minimumBillableMinutes: "10",
  roundUpToMinutes: "5",
  managerDiscountLimitPercent: "10",
  isActive: true,
  reason: "",
};

export function AdminPricingShell() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [draft, setDraft] = useState<ServiceDraft>(emptyDraft);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId) ?? null,
    [selectedServiceId, services],
  );
  const activeSacRates = taxRates.filter(
    (taxRate) => taxRate.kind === "SAC" && !taxRate.effectiveTo,
  );
  const owner = currentUser?.role === "OWNER";
  const managerBranch =
    currentUser?.role === "MANAGER"
      ? branches.find((branch) => branch.id === currentUser.branchId)
      : null;
  const effectiveBranch = useMemo(() => {
    if (branchFilter && branchFilter !== "GLOBAL") {
      return branches.find((branch) => branch.id === branchFilter) ?? null;
    }
    if (currentUser?.role === "MANAGER" && currentUser.branchId) {
      return managerBranch;
    }
    return null;
  }, [branchFilter, branches, currentUser?.branchId, currentUser?.role, managerBranch]);
  const effectiveBranchId = effectiveBranch?.id ?? null;
  const currentRole = currentUser?.role ?? "STAFF";

  const filteredServices = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return services
      .filter((service) => {
        const branchMatch = catalogBranchFilterMatches(service, branchFilter);
        const searchMatch =
          !normalizedSearch ||
          service.name.toLowerCase().includes(normalizedSearch) ||
          service.description.toLowerCase().includes(normalizedSearch) ||
          service.sacCode.toLowerCase().includes(normalizedSearch);
        return branchMatch && searchMatch;
      })
      .sort((left, right) =>
        serviceBranchSort(left, right, branchFilter) ||
        left.name.localeCompare(right.name),
      );
  }, [branchFilter, search, services]);

  const load = useCallback(async () => {
    setError(null);
    const [meResponse, branchesResponse, servicesResponse, taxRatesResponse] =
      await Promise.all([
        fetch("/api/auth/me", { cache: "no-store" }),
        fetch("/api/admin/branches", { cache: "no-store" }),
        fetch("/api/admin/services", { cache: "no-store" }),
        fetch("/api/admin/gst-rates", { cache: "no-store" }),
      ]);
    if (
      !meResponse.ok ||
      !branchesResponse.ok ||
      !servicesResponse.ok ||
      !taxRatesResponse.ok
    ) {
      throw new Error("Unable to load timed services.");
    }

    const mePayload = (await meResponse.json()) as { user: CurrentUser };
    const branchesPayload = (await branchesResponse.json()) as {
      branches: BranchOption[];
    };
    const servicesPayload = (await servicesResponse.json()) as {
      services: ServiceRow[];
    };
    const taxRatesPayload = (await taxRatesResponse.json()) as {
      taxRates: TaxRateOption[];
    };
    setCurrentUser(mePayload.user);
    setBranches(branchesPayload.branches);
    setServices(servicesPayload.services);
    setTaxRates(taxRatesPayload.taxRates);
    if (!branchFilter && mePayload.user.role === "MANAGER" && mePayload.user.branchId) {
      setBranchFilter(mePayload.user.branchId);
    }
  }, [branchFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      load().catch((caught: unknown) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load timed services.",
        ),
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  function startCreate() {
    setSelectedServiceId(null);
    setMessage(null);
    setDraft({
      ...emptyDraft,
      branchId:
        currentUser?.role === "MANAGER"
          ? (currentUser.branchId ?? "")
          : (branches[0]?.id ?? ""),
      taxRateId: activeSacRates[0]?.id ?? "",
    });
  }

  function startEdit(service: ServiceRow) {
    if (currentUser?.role === "MANAGER" && service.branchId === null) {
      const existingBranchOverride = services.find(
        (candidate) =>
          candidate.branchId === currentUser.branchId &&
          !candidate.isActive &&
          pricingServiceFamilyKey(candidate) === pricingServiceFamilyKey(service),
      );
      setSelectedServiceId(existingBranchOverride?.id ?? null);
      setMessage(
        `${service.name} is set for all branches. Saving will create a ${
          managerBranch?.name ?? "branch"
        } price for this branch.`,
      );
      setDraft({
        branchId: currentUser.branchId ?? "",
        taxRateId: service.taxRateId,
        name: service.name,
        sacCode: service.sacCode,
        description: service.description,
        ratePerMinute: paiseToRupeeInput(service.pricingRule.ratePerMinute),
        minimumBillableMinutes: String(service.pricingRule.minimumBillableMinutes),
        roundUpToMinutes: String(service.pricingRule.roundUpToMinutes),
        managerDiscountLimitPercent: String(
          service.pricingRule.managerDiscountLimitPercent,
        ),
        isActive: service.isActive,
        reason: "",
      });
      return;
    }

    setSelectedServiceId(service.id);
    setMessage(null);
    setDraft({
      branchId: service.branchId ?? "",
      taxRateId: service.taxRateId,
      name: service.name,
      sacCode: service.sacCode,
      description: service.description,
      ratePerMinute: paiseToRupeeInput(service.pricingRule.ratePerMinute),
      minimumBillableMinutes: String(service.pricingRule.minimumBillableMinutes),
      roundUpToMinutes: String(service.pricingRule.roundUpToMinutes),
      managerDiscountLimitPercent: String(
        service.pricingRule.managerDiscountLimitPercent,
      ),
      isActive: service.isActive,
      reason: `Update ${service.name}`,
    });
  }

  async function saveService() {
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const editing = Boolean(selectedServiceId);
      const response = await fetch(
        editing ? `/api/admin/services/${selectedServiceId}` : "/api/admin/services",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branchId: draft.branchId || null,
            taxRateId: draft.taxRateId,
            name: draft.name,
            sacCode: draft.sacCode,
            description: draft.description,
            ratePerMinute: rupeeInputToPaise(draft.ratePerMinute),
            minimumBillableMinutes: Number(draft.minimumBillableMinutes),
            roundUpToMinutes: Number(draft.roundUpToMinutes),
            managerDiscountLimitPercent: Number(
              draft.managerDiscountLimitPercent,
            ),
            isActive: draft.isActive,
            reason: draft.reason || undefined,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(
          await responseMessage(response, "Unable to save timed service."),
        );
      }
      await load();
      setMessage(editing ? "Timed service updated." : "Timed service created.");
      if (!editing) {
        setSelectedServiceId(null);
        setDraft({
          ...emptyDraft,
          branchId: draft.branchId,
          taxRateId: draft.taxRateId,
        });
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save timed service.",
      );
    } finally {
      setPending(false);
    }
  }

  async function handleUseGlobalDefault(service: ServiceRow) {
    if (!service.branchId) {
      return;
    }

    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/services/${service.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive: false,
          reason: "Use global default",
        }),
      });
      if (!response.ok) {
        throw new Error(
          await responseMessage(response, "Unable to use global default."),
        );
      }
      await load();
      if (selectedServiceId === service.id) {
        setSelectedServiceId(null);
      }
      setMessage("Branch override deactivated. POS will use the global default.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to use global default.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <div>
          <div className="flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-emerald-700" />
            <h1 className="text-xl font-semibold tracking-normal">
              Timed services & pricing
            </h1>
          </div>
          <p className="mt-1 text-sm text-zinc-600">
            Configure Pool and PS5 pricing for future sessions.
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
            <h2 className="text-base font-semibold">Timed service catalog</h2>
            <Button onClick={startCreate} variant="secondary">
              <Plus className="h-4 w-4" />
              New service
            </Button>
          </div>
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Search
              <Input
                placeholder="Pool, PS5"
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
            {filteredServices.map((service) => {
              const globalDefault = activeGlobalDefaultForService(service, services);
              const branchOverride = activeBranchOverrideForService(
                service,
                services,
                effectiveBranchId,
              );
              const effectiveService = effectiveServiceForBranch(
                service,
                services,
                effectiveBranchId,
              );
              const scopeLabel = pricingScopeLabel(service, effectiveBranchId);
              const editLabel = pricingEditActionLabel({
                service,
                role: currentRole,
                effectiveBranchId,
              });
              const canUseGlobalDefault =
                Boolean(effectiveBranchId) &&
                service.branchId === effectiveBranchId &&
                service.isActive;

              return (
                <div
                  key={service.id}
                  className={cn(
                    "grid gap-3 rounded-md border p-3 text-sm",
                    selectedServiceId === service.id
                      ? "border-emerald-600 bg-emerald-50"
                      : "border-zinc-200 bg-white",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{service.name}</p>
                        <Badge tone={scopeBadgeTone(scopeLabel)}>
                          {scopeLabel}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-zinc-600">
                        SAC {service.sacCode} -{" "}
                        {service.branch?.name ?? "All branches"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{service.taxRate.gstRate}% GST</Badge>
                      <Badge tone={service.isActive ? "success" : "danger"}>
                        {service.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid gap-2 rounded-md bg-zinc-50 p-3 text-xs text-zinc-700 sm:grid-cols-3">
                    <p>
                      <span className="font-semibold text-zinc-900">
                        Global default:
                      </span>{" "}
                      {rateLabel(globalDefault)}
                    </p>
                    {effectiveBranch ? (
                      <p>
                        <span className="font-semibold text-zinc-900">
                          Branch override:
                        </span>{" "}
                        {rateLabel(branchOverride)}
                      </p>
                    ) : null}
                    <p>
                      <span className="font-semibold text-zinc-900">
                        {effectiveBranch
                          ? `Effective for ${effectiveBranch.name}:`
                          : "Effective POS rate:"}
                      </span>{" "}
                      {rateLabel(effectiveService)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-zinc-600">
                      Minimum {service.pricingRule.minimumBillableMinutes} min,
                      round to {service.pricingRule.roundUpToMinutes} min
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {canUseGlobalDefault ? (
                        <Button
                          disabled={pending}
                          onClick={() => handleUseGlobalDefault(service)}
                          variant="secondary"
                        >
                          Use global default
                        </Button>
                      ) : null}
                      <Button
                        disabled={pending}
                        onClick={() => startEdit(service)}
                        variant="secondary"
                      >
                        {editLabel}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredServices.length === 0 ? (
              <p className="rounded-md border border-zinc-200 p-4 text-sm text-zinc-600">
                No timed services found.
              </p>
            ) : null}
          </div>
        </div>

        <aside className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <Pencil className="h-4 w-4 text-emerald-700" />
            <h2 className="text-base font-semibold">
              {selectedService ? "Edit timed service" : "Create timed service"}
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
                Service name
                <Input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-zinc-600">
                SAC code
                <Input
                  value={draft.sacCode}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      sacCode: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Description
              <Input
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
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
                {activeSacRates.map((taxRate) => (
                  <option key={taxRate.id} value={taxRate.id}>
                    {taxRate.code} - {taxRate.gstRate}% - {taxRate.description}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1 text-xs font-medium text-zinc-600">
                Rate per minute
                <Input
                  inputMode="decimal"
                  value={draft.ratePerMinute}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      ratePerMinute: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-zinc-600">
                Minimum minutes
                <Input
                  inputMode="numeric"
                  value={draft.minimumBillableMinutes}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      minimumBillableMinutes: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-zinc-600">
                Round to minutes
                <Input
                  inputMode="numeric"
                  value={draft.roundUpToMinutes}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      roundUpToMinutes: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Manager discount limit %
              <Input
                inputMode="numeric"
                value={draft.managerDiscountLimitPercent}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    managerDiscountLimitPercent: event.target.value,
                  }))
                }
              />
            </label>
            {selectedService ? (
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
            <Button disabled={pending || !draft.taxRateId} onClick={saveService}>
              {selectedService ? "Save service" : "Create service"}
            </Button>
          </div>
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

function scopeBadgeTone(
  scopeLabel: ReturnType<typeof pricingScopeLabel>,
): "neutral" | "success" | "warning" | "danger" {
  if (scopeLabel === "Branch override") {
    return "success";
  }
  if (scopeLabel === "Inherited from global default") {
    return "warning";
  }
  return "neutral";
}

function rateLabel(service: Pick<ServiceRow, "pricingRule"> | null): string {
  return service ? `${formatPaise(service.pricingRule.ratePerMinute)}/min` : "Not set";
}

function serviceBranchSort(
  left: ServiceRow,
  right: ServiceRow,
  branchFilter: string,
): number {
  if (!branchFilter || branchFilter === "GLOBAL") {
    return 0;
  }

  const leftWeight = left.branchId === branchFilter ? 0 : 1;
  const rightWeight = right.branchId === branchFilter ? 0 : 1;
  return leftWeight - rightWeight;
}
