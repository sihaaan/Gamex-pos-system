"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { BranchOption, TaxRateOption } from "@/components/admin/shared";
import type { ServiceDraft, ServiceRow } from "./types";

export function ServiceForm({
  draft,
  branches,
  sacRates,
  owner,
  pending,
  selectedService,
  onDraftChange,
  onSave,
}: {
  draft: ServiceDraft;
  branches: readonly BranchOption[];
  sacRates: readonly TaxRateOption[];
  owner: boolean;
  pending: boolean;
  selectedService: ServiceRow | null;
  onDraftChange: (patch: Partial<ServiceDraft>) => void;
  onSave: () => void;
}) {
  return (
    <aside className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Pencil className="h-4 w-4 text-brand" />
        <h2 className="text-base font-semibold text-ink">
          {selectedService ? "Edit timed service" : "Create timed service"}
        </h2>
      </div>
      <div className="grid gap-3">
        <label className="grid gap-1 text-xs font-medium text-ink-muted">
          Branch
          <Select
            disabled={!owner}
            value={draft.branchId}
            onChange={(event) => onDraftChange({ branchId: event.target.value })}
          >
            {owner ? <option value="">All branches</option> : null}
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} ({branch.code})
              </option>
            ))}
          </Select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            Service name
            <Input
              value={draft.name}
              onChange={(event) => onDraftChange({ name: event.target.value })}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            SAC code
            <Input
              value={draft.sacCode}
              onChange={(event) => onDraftChange({ sacCode: event.target.value })}
            />
          </label>
        </div>
        <label className="grid gap-1 text-xs font-medium text-ink-muted">
          Description
          <Input
            value={draft.description}
            onChange={(event) =>
              onDraftChange({ description: event.target.value })
            }
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-ink-muted">
          GST rate
          <Select
            value={draft.taxRateId}
            onChange={(event) => onDraftChange({ taxRateId: event.target.value })}
          >
            <option value="">Select GST rate</option>
            {sacRates.map((taxRate) => (
              <option key={taxRate.id} value={taxRate.id}>
                {taxRate.code} - {taxRate.gstRate}% - {taxRate.description}
              </option>
            ))}
          </Select>
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            Rate per minute
            <Input
              inputMode="decimal"
              value={draft.ratePerMinute}
              onChange={(event) =>
                onDraftChange({ ratePerMinute: event.target.value })
              }
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            Minimum minutes
            <Input
              inputMode="numeric"
              value={draft.minimumBillableMinutes}
              onChange={(event) =>
                onDraftChange({ minimumBillableMinutes: event.target.value })
              }
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            Round to minutes
            <Input
              inputMode="numeric"
              value={draft.roundUpToMinutes}
              onChange={(event) =>
                onDraftChange({ roundUpToMinutes: event.target.value })
              }
            />
          </label>
        </div>
        <label className="grid gap-1 text-xs font-medium text-ink-muted">
          Manager discount limit %
          <Input
            inputMode="numeric"
            value={draft.managerDiscountLimitPercent}
            onChange={(event) =>
              onDraftChange({ managerDiscountLimitPercent: event.target.value })
            }
          />
        </label>
        {selectedService ? (
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            Audit reason
            <Input
              value={draft.reason}
              onChange={(event) => onDraftChange({ reason: event.target.value })}
            />
          </label>
        ) : null}
        <label className="flex items-center gap-2 text-sm font-medium text-ink-muted">
          <input
            checked={draft.isActive}
            onChange={(event) =>
              onDraftChange({ isActive: event.target.checked })
            }
            type="checkbox"
          />
          Active
        </label>
        <Button disabled={pending || !draft.taxRateId} onClick={onSave}>
          {selectedService ? "Save service" : "Create service"}
        </Button>
      </div>
    </aside>
  );
}
