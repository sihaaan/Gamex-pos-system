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
import { timedPricingLabel } from "@/lib/timed-pricing-label";
import { cn } from "@/lib/utils";
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
  onCreateDefaults,
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
  onCreateDefaults: () => void;
  onEdit: (service: ServiceRow) => void;
  onUseGlobalDefault: (service: ServiceRow) => void;
}) {
  const effectiveBranchId = effectiveBranch?.id ?? null;

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-ink">
            Game prices
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            Resources are the actual tables/consoles. Prices are game types like
            Pool play or PS5 play.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} onClick={onCreateDefaults} variant="secondary">
            Set up Pool/PS5 defaults
          </Button>
          <Button onClick={onCreate} variant="secondary">
            <Plus className="h-4 w-4" />
            New price
          </Button>
        </div>
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
          Price scope
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
                  <span className="font-semibold text-ink">Default price:</span>{" "}
                  {rateLabel(globalDefault)}
                </p>
                {effectiveBranch ? (
                  <p>
                    <span className="font-semibold text-ink">This branch:</span>{" "}
                    {rateLabel(branchOverride)}
                  </p>
                ) : null}
                <p>
                  <span className="font-semibold text-ink">
                    {effectiveBranch
                      ? `Charged at ${effectiveBranch.name}:`
                      : "Price at checkout:"}
                  </span>{" "}
                  {rateLabel(effectiveService)}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-ink-muted">
                  {pricingNote(service)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {canUseGlobalDefault ? (
                    <Button
                      disabled={pending}
                      onClick={() => onUseGlobalDefault(service)}
                      variant="secondary"
                    >
                      Use default price
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
          <div className="rounded-md border border-line p-4 text-sm text-ink-muted">
            <p className="font-medium text-ink">No game prices yet.</p>
            <p className="mt-1">
              Click Set up Pool/PS5 defaults to create Pool play and PS5 play.
              Those prices will be used by matching resources like Pool 1 and
              PS5 1.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function scopeBadgeTone(
  scopeLabel: ReturnType<typeof pricingScopeLabel>,
): "neutral" | "success" | "warning" | "danger" {
  if (scopeLabel === "Branch price") {
    return "success";
  }
  return "neutral";
}

function rateLabel(service: Pick<ServiceRow, "pricingRule"> | null): string {
  if (!service) {
    return "Not set";
  }

  return timedPricingLabel(service.pricingRule);
}

function pricingNote(service: Pick<ServiceRow, "pricingRule">): string {
  if (service.pricingRule.controllerPricingEnabled) {
    return "1 controller uses normal price; 2-4 use multiplayer price per controller";
  }

  if (service.pricingRule.pricingMode === "HALF_HOUR_BLOCKS") {
    return "Charged in 30-minute blocks";
  }

  return `Bills a minimum of ${service.pricingRule.minimumBillableMinutes} min, rounded up to ${service.pricingRule.roundUpToMinutes} min`;
}
