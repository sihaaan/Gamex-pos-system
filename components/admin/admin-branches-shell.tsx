"use client";

import { Building2, MapPin, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Role = "OWNER" | "MANAGER" | "STAFF";

type CurrentUser = {
  role: Role;
};

type BranchRow = {
  id: string;
  name: string;
  code: string;
  address: string;
  stateCode: string;
  timezone: string;
  isActive: boolean;
  activeResourceCount: number;
  createdAt: string;
  updatedAt: string;
};

type BranchDraft = {
  name: string;
  code: string;
  address: string;
  stateCode: string;
  timezone: string;
  isActive: boolean;
  reason: string;
};

const emptyDraft: BranchDraft = {
  name: "",
  code: "",
  address: "",
  stateCode: "29",
  timezone: "Asia/Kolkata",
  isActive: true,
  reason: "",
};

export function AdminBranchesShell() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BranchDraft>(emptyDraft);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === selectedBranchId) ?? null,
    [branches, selectedBranchId],
  );
  const owner = currentUser?.role === "OWNER";

  const load = useCallback(async () => {
    setError(null);
    const [meResponse, branchesResponse] = await Promise.all([
      fetch("/api/auth/me", { cache: "no-store" }),
      fetch("/api/admin/branches", { cache: "no-store" }),
    ]);
    if (!meResponse.ok || !branchesResponse.ok) {
      throw new Error("Unable to load branches.");
    }

    const mePayload = (await meResponse.json()) as { user: CurrentUser };
    const branchesPayload = (await branchesResponse.json()) as {
      branches: BranchRow[];
    };
    setCurrentUser(mePayload.user);
    setBranches(branchesPayload.branches);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      load().catch((caught: unknown) =>
        setError(
          caught instanceof Error ? caught.message : "Unable to load branches.",
        ),
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  function startCreate() {
    setSelectedBranchId(null);
    setMessage(null);
    setDraft(emptyDraft);
  }

  function startEdit(branch: BranchRow) {
    setSelectedBranchId(branch.id);
    setMessage(null);
    setDraft({
      name: branch.name,
      code: branch.code,
      address: branch.address,
      stateCode: branch.stateCode,
      timezone: branch.timezone,
      isActive: branch.isActive,
      reason: `Update ${branch.name}`,
    });
  }

  async function saveBranch() {
    if (!owner && !selectedBranch) {
      setError("Only owners can create new branches.");
      return;
    }

    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const editing = Boolean(selectedBranchId);
      const response = await fetch(
        editing ? `/api/admin/branches/${selectedBranchId}` : "/api/admin/branches",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: draft.name,
            code: draft.code,
            address: draft.address,
            stateCode: draft.stateCode,
            timezone: draft.timezone,
            isActive: draft.isActive,
            reason: draft.reason || undefined,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(await responseMessage(response, "Unable to save branch."));
      }
      await load();
      setMessage(editing ? "Branch updated." : "Branch created.");
      if (!editing) {
        setSelectedBranchId(null);
        setDraft(emptyDraft);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save branch.");
    } finally {
      setPending(false);
    }
  }

  async function toggleBranchActive(branch: BranchRow) {
    const action = branch.isActive ? "deactivate" : "reactivate";
    const confirmed = window.confirm(
      branch.isActive
        ? `Deactivate ${branch.name}? Active shifts and open bills must be closed first.`
        : `Reactivate ${branch.name}?`,
    );
    if (!confirmed) {
      return;
    }

    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/branches/${branch.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: branch.isActive
            ? `Deactivate ${branch.name}`
            : `Reactivate ${branch.name}`,
        }),
      });
      if (!response.ok) {
        throw new Error(
          await responseMessage(response, `Unable to ${action} branch.`),
        );
      }
      await load();
      setMessage(branch.isActive ? "Branch deactivated." : "Branch reactivated.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : `Unable to ${action} branch.`,
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-success" />
            <h1 className="text-xl font-semibold tracking-normal">Branches</h1>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Maintain GST branch details and activation status for the current legal entity.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/admin">Back to admin</Link>
        </Button>
      </section>

      {message ? (
        <div className="rounded-md border border-success-line bg-success-soft p-3 text-sm font-medium text-success-ink">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-danger-line bg-danger-soft p-3 text-sm font-medium text-danger-ink">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.9fr]">
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">
              {owner ? "Legal entity branches" : "Assigned branch"}
            </h2>
            {owner ? (
              <Button onClick={startCreate} variant="secondary">
                <Plus className="h-4 w-4" />
                New branch
              </Button>
            ) : null}
          </div>
          <div className="grid gap-2">
            {branches.map((branch) => (
              <button
                key={branch.id}
                className={cn(
                  "grid gap-2 rounded-md border p-3 text-left text-sm transition hover:bg-surface-muted",
                  selectedBranchId === branch.id
                    ? "border-brand bg-success-soft"
                    : "border-line bg-surface",
                )}
                onClick={() => startEdit(branch)}
                type="button"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{branch.name}</p>
                    <p className="text-xs text-ink-muted">
                      {branch.code} - State {branch.stateCode}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{branch.activeResourceCount} resources</Badge>
                    <Badge tone={branch.isActive ? "success" : "danger"}>
                      {branch.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-xs text-ink-muted">
                  <MapPin className="mt-0.5 h-3.5 w-3.5" />
                  <span>{branch.address}</span>
                </div>
                <dl className="grid gap-2 text-xs text-ink-muted sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-ink-subtle">Timezone</dt>
                    <dd>{branch.timezone}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-ink-subtle">Updated</dt>
                    <dd>{formatDate(branch.updatedAt)}</dd>
                  </div>
                </dl>
              </button>
            ))}
            {branches.length === 0 ? (
              <p className="rounded-md border border-line p-4 text-sm text-ink-muted">
                No branches found for your scope.
              </p>
            ) : null}
          </div>
        </div>

        <aside className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <Pencil className="h-4 w-4 text-success" />
            <h2 className="text-base font-semibold">
              {selectedBranch ? "Edit branch" : "Create branch"}
            </h2>
          </div>
          {!owner && !selectedBranch ? (
            <p className="text-sm text-ink-muted">
              Managers can edit their assigned branch. Owners can create new branches.
            </p>
          ) : (
            <div className="grid gap-3">
              <label className="grid gap-1 text-xs font-medium text-ink-muted">
                Name
                <Input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-ink-muted">
                Branch code
                <Input
                  disabled={!owner && Boolean(selectedBranch)}
                  value={draft.code}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      code: event.target.value.toUpperCase(),
                    }))
                  }
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-ink-muted">
                Address
                <Input
                  value={draft.address}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      address: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-medium text-ink-muted">
                  GST state code
                  <Input
                    inputMode="numeric"
                    value={draft.stateCode}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        stateCode: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-ink-muted">
                  Timezone
                  <Input
                    value={draft.timezone}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        timezone: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              {selectedBranch ? (
                <label className="grid gap-1 text-xs font-medium text-ink-muted">
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
              <label className="flex items-center gap-2 text-sm font-medium text-ink-muted">
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
              <Button disabled={pending} onClick={saveBranch}>
                {selectedBranch ? "Save branch" : "Create branch"}
              </Button>
              {selectedBranch ? (
                <Button
                  disabled={pending}
                  onClick={() => toggleBranchActive(selectedBranch)}
                  variant={selectedBranch.isActive ? "danger" : "primary"}
                >
                  {selectedBranch.isActive ? "Deactivate branch" : "Reactivate branch"}
                </Button>
              ) : null}
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

async function responseMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return payload?.error?.message ?? fallback;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
