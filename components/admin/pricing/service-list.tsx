"use client";

import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BranchScopeSelect,
  type BranchOption,
  type Role,
} from "@/components/admin/shared";
import {
  activeBranchOverrideForService,
  activeGlobalDefaultForService,
  effectiveServiceForBranch,
  pricingEditActionLabel,
  pricingScopeLabel,
} from "@/lib/admin/pricing-display";
import { cn, formatPaise } from "@/lib/utils";
import type { ServiceRow } from "./types";

export function ServiceList({
  services,
  allServices,
  branches,
  owner,
  role,
  search,
  branchFilter,
  effectiveBranch,
  selectedServiceId,
  pending,
  onSearchChange,
  onBranchFilterChange,
  onCreate,
  onEdit,
  onUseGlobalDefault,
}: {
  services: readonly ServiceRow[];
  allServices: readonly ServiceRow[];
  branches: readonly BranchOption[];
  owner: boolean;
  role: Role;
  search: string;
  branchFilter: string;
  effectiveBranch: BranchOption | null;
  selectedServiceId: string | null;
  pending: boolean;
  onSearchChange: (value: string) => void;
  onBranchFilterChange: (value: string) => void;
  onCreate: () => void;
  onEdit: (service: ServiceRow) => void;
  onUseGlobalDefault: (service: ServiceRow) => void;
}) {
  const effectiveBranchId = effectiveBranch?.id ?? null;

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">
          Timed service catalog
        </h2>
        <Button onClick={onCreate} variant="secondary">
          <Plus className="h-4 w-4" />
          New service
        </Button>
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-medium text-ink-muted">
          Search
          <Input
            placeholder="Pool, PS5"
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
        {services.map((service) => {
          const globalDefault = activeGlobalDefaultForService(
            service,
            allServices,
          );
          const branchOverride = activeBranchOverrideForService(
            service,
            allServices,
            effectiveBranchId,
          );
          const effectiveService = effectiveServiceForBranch(
            service,
            allServices,
            effectiveBranchId,
          );
          const scopeLabel = pricingScopeLabel(service, effectiveBranchId);
          const editLabel = pricingEditActionLabel({
            service,
            role,
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
                "grid gap-3 rounded-lg border p-3 text-sm",
                selectedServiceId === service.id
                  ? "border-brand bg-success-soft"
                  : "border-line bg-surface",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">{service.name}</p>
                    <Badge tone={scopeBadgeTone(scopeLabel)}>{scopeLabel}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
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

              <div className="grid gap-2 rounded-md bg-surface-muted p-3 text-xs text-ink-muted sm:grid-cols-3">
                <p>
                  <span className="font-semibold text-ink">
                    Global default:
                  </span>{" "}
                  {rateLabel(globalDefault)}
                </p>
                {effectiveBranch ? (
                  <p>
                    <span className="font-semibold text-ink">
                      Branch override:
                    </span>{" "}
                    {rateLabel(branchOverride)}
                  </p>
                ) : null}
                <p>
                  <span className="font-semibold text-ink">
                    {effectiveBranch
                      ? `Effective for ${effectiveBranch.name}:`
                      : "Effective POS rate:"}
                  </span>{" "}
                  {rateLabel(effectiveService)}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-ink-muted">
                  Minimum {service.pricingRule.minimumBillableMinutes} min,
                  round to {service.pricingRule.roundUpToMinutes} min
                </p>
                <div className="flex flex-wrap gap-2">
                  {canUseGlobalDefault ? (
                    <Button
                      disabled={pending}
                      onClick={() => onUseGlobalDefault(service)}
                      variant="secondary"
                    >
                      Use global default
                    </Button>
                  ) : null}
                  <Button
                    disabled={pending}
                    onClick={() => onEdit(service)}
                    variant="secondary"
                  >
                    {editLabel}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        {services.length === 0 ? (
          <p className="rounded-md border border-line p-4 text-sm text-ink-muted">
            No timed services found.
          </p>
        ) : null}
      </div>
    </div>
  );
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
  return service
    ? `${formatPaise(service.pricingRule.ratePerMinute)}/min`
    : "Not set";
}
