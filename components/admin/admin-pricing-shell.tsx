"use client";

import { Clock3 } from "lucide-react";
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
import { pricingServiceFamilyKey } from "@/lib/admin/pricing-display";
import { ServiceForm } from "./pricing/service-form";
import { ServiceList } from "./pricing/service-list";
import {
  emptyServiceDraft,
  type ServiceDraft,
  type ServiceRow,
} from "./pricing/types";

export function AdminPricingShell() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [draft, setDraft] = useState<ServiceDraft>(emptyServiceDraft);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null,
  );
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
      return managerBranch ?? null;
    }
    return null;
  }, [
    branchFilter,
    branches,
    currentUser?.branchId,
    currentUser?.role,
    managerBranch,
  ]);
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
      .sort(
        (left, right) =>
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
      ...emptyServiceDraft,
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
          pricingServiceFamilyKey(candidate) ===
            pricingServiceFamilyKey(service),
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
        minimumBillableMinutes: String(
          service.pricingRule.minimumBillableMinutes,
        ),
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
      minimumBillableMinutes: String(
        service.pricingRule.minimumBillableMinutes,
      ),
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
        editing
          ? `/api/admin/services/${selectedServiceId}`
          : "/api/admin/services",
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
          ...emptyServiceDraft,
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
      setMessage(
        "Branch override deactivated. POS will use the global default.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to use global default.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <AdminPageHeader
        icon={Clock3}
        title="Timed services & pricing"
        description="Configure Pool and PS5 pricing for future sessions."
      />

      <StatusMessages error={error} message={message} />

      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.9fr]">
        <ServiceList
          services={filteredServices}
          allServices={services}
          branches={branches}
          owner={owner}
          role={currentRole}
          search={search}
          branchFilter={branchFilter}
          effectiveBranch={effectiveBranch}
          selectedServiceId={selectedServiceId}
          pending={pending}
          onSearchChange={setSearch}
          onBranchFilterChange={setBranchFilter}
          onCreate={startCreate}
          onEdit={startEdit}
          onUseGlobalDefault={(service) => void handleUseGlobalDefault(service)}
        />

        <ServiceForm
          draft={draft}
          branches={branches}
          sacRates={activeSacRates}
          owner={owner}
          pending={pending}
          selectedService={selectedService}
          onDraftChange={(patch) =>
            setDraft((current) => ({ ...current, ...patch }))
          }
          onSave={() => void saveService()}
        />
      </section>
    </main>
  );
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
