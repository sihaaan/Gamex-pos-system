"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { BranchOption, TaxRateOption } from "@/components/admin/shared";
import type { ServiceDraft, ServiceRow } from "./types";

const gameTypePresets = {
  POOL: {
    name: "Pool play",
    description: "Pool timed play",
    sacCode: "9996",
  },
  PS5: {
    name: "PS5 play",
    description: "PS5 console timed play",
    sacCode: "9996",
  },
} as const;

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
  const selectedGameType = gameTypeFromName(draft.name);

  function handleGameTypeChange(value: string) {
    if (value === "POOL" || value === "PS5") {
      onDraftChange({
        ...gameTypePresets[value],
        controllerPricingEnabled: value === "PS5",
      });
      return;
    }

    if (value === "CUSTOM") {
      onDraftChange({
        name: "Custom play",
        description: "",
        sacCode: draft.sacCode || "9996",
      });
      return;
    }

    onDraftChange({ name: "", description: "" });
  }

  const showControllerPricing =
    selectedGameType === "PS5" || draft.controllerPricingEnabled;

  return (
    <aside className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <Pencil className="h-4 w-4 text-brand" />
        <h2 className="text-base font-semibold text-ink">
          {selectedService ? "Edit game price" : "Create game price"}
        </h2>
      </div>
      <div className="grid gap-3">
        <label className="grid gap-1 text-xs font-medium text-ink-muted">
          Applies to
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
        <div className="grid items-start gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            Game type
            <Select
              value={selectedGameType}
              onChange={(event) => handleGameTypeChange(event.target.value)}
            >
              <option value="">Choose game</option>
              <option value="POOL">Pool</option>
              <option value="PS5">PS5</option>
              <option value="CUSTOM">Other</option>
            </Select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            GST service category
            <Input
              placeholder="Auto for pilot"
              value={draft.sacCode}
              onChange={(event) => onDraftChange({ sacCode: event.target.value })}
            />
            <span className="text-[11px] font-normal text-ink-muted">
              Optional for pilot. Confirm real SAC codes with the CA later.
            </span>
          </label>
        </div>
        {selectedGameType === "CUSTOM" ? (
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            Custom game name
            <Input
              placeholder="VR play"
              value={draft.name}
              onChange={(event) => onDraftChange({ name: event.target.value })}
            />
          </label>
        ) : null}
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
          GST on timed play
          <Select
            value={draft.taxRateId}
            onChange={(event) => onDraftChange({ taxRateId: event.target.value })}
          >
            <option value="">Use default timed-play GST</option>
            {sacRates.map((taxRate) => (
              <option key={taxRate.id} value={taxRate.id}>
                {taxRate.code} - {taxRate.gstRate}% - {taxRate.description}
              </option>
            ))}
          </Select>
          <span className="text-[11px] font-normal text-ink-muted">
            You can leave this as default while testing.
          </span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            30 min price (Rs)
            <Input
              inputMode="decimal"
              placeholder="80"
              value={draft.halfHourPrice}
              onChange={(event) =>
                onDraftChange({ halfHourPrice: event.target.value })
              }
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            1 hour price (Rs)
            <Input
              inputMode="decimal"
              placeholder="140"
              value={draft.hourPrice}
              onChange={(event) =>
                onDraftChange({ hourPrice: event.target.value })
              }
            />
          </label>
        </div>
        <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-ink-muted">
          Game time is charged in 30-minute blocks. Example: 90 min = 1 hour
          price + 30 min price.
        </p>
        {showControllerPricing ? (
          <div className="grid gap-3 rounded-lg border border-line bg-surface-muted p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-ink-muted">
              <input
                checked={draft.controllerPricingEnabled}
                onChange={(event) =>
                  onDraftChange({
                    controllerPricingEnabled: event.target.checked,
                  })
                }
                type="checkbox"
              />
              PS5 controller pricing
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1 text-xs font-medium text-ink-muted">
                Multiplayer 30 min/controller
                <Input
                  inputMode="decimal"
                  placeholder="60"
                  value={draft.multiplayerHalfHourPrice}
                  onChange={(event) =>
                    onDraftChange({
                      multiplayerHalfHourPrice: event.target.value,
                    })
                  }
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-ink-muted">
                Multiplayer 1 hour/controller
                <Input
                  inputMode="decimal"
                  placeholder="110"
                  value={draft.multiplayerHourPrice}
                  onChange={(event) =>
                    onDraftChange({
                      multiplayerHourPrice: event.target.value,
                    })
                  }
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-ink-muted">
                Max controllers
                <Input
                  inputMode="numeric"
                  value={draft.maxControllers}
                  onChange={(event) =>
                    onDraftChange({ maxControllers: event.target.value })
                  }
                />
              </label>
            </div>
            <p className="text-xs text-ink-muted">
              1 controller uses the normal price. 2-4 controllers use the
              multiplayer per-controller price.
            </p>
          </div>
        ) : null}
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
        <Button disabled={pending || !draft.name.trim()} onClick={onSave}>
          {selectedService ? "Save price" : "Create price"}
        </Button>
      </div>
    </aside>
  );
}

function gameTypeFromName(name: string): "" | "POOL" | "PS5" | "CUSTOM" {
  if (!name.trim()) {
    return "";
  }
  if (name === gameTypePresets.POOL.name) {
    return "POOL";
  }
  if (name === gameTypePresets.PS5.name) {
    return "PS5";
  }
  return "CUSTOM";
}
