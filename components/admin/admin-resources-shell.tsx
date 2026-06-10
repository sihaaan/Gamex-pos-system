"use client";

import { Gamepad2, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Role = "OWNER" | "MANAGER" | "STAFF";
type ResourceKind = "POOL_TABLE" | "CONSOLE";

type CurrentUser = {
  role: Role;
  branchId: string | null;
};

type BranchOption = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
};

type ResourceRow = {
  id: string;
  branchId: string;
  name: string;
  kind: ResourceKind;
  status: "AVAILABLE" | "OCCUPIED" | "PAUSED" | "MAINTENANCE";
  isActive: boolean;
  branch: { id: string; name: string; code: string };
};

type ResourceDraft = {
  branchId: string;
  name: string;
  kind: ResourceKind;
  isActive: boolean;
  reason: string;
};

const emptyDraft: ResourceDraft = {
  branchId: "",
  name: "",
  kind: "POOL_TABLE",
  isActive: true,
  reason: "",
};

export function AdminResourcesShell() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [draft, setDraft] = useState<ResourceDraft>(emptyDraft);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selectedResource = useMemo(
    () => resources.find((resource) => resource.id === selectedResourceId) ?? null,
    [resources, selectedResourceId],
  );
  const owner = currentUser?.role === "OWNER";

  const filteredResources = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return resources.filter((resource) => {
      const branchMatch = !branchFilter || resource.branchId === branchFilter;
      const searchMatch =
        !normalizedSearch ||
        resource.name.toLowerCase().includes(normalizedSearch) ||
        resource.branch.name.toLowerCase().includes(normalizedSearch);
      return branchMatch && searchMatch;
    });
  }, [branchFilter, resources, search]);

  const load = useCallback(async () => {
    setError(null);
    const [meResponse, branchesResponse, resourcesResponse] = await Promise.all([
      fetch("/api/auth/me", { cache: "no-store" }),
      fetch("/api/admin/branches", { cache: "no-store" }),
      fetch("/api/admin/resources", { cache: "no-store" }),
    ]);
    if (!meResponse.ok || !branchesResponse.ok || !resourcesResponse.ok) {
      throw new Error("Unable to load resources.");
    }

    const mePayload = (await meResponse.json()) as { user: CurrentUser };
    const branchesPayload = (await branchesResponse.json()) as {
      branches: BranchOption[];
    };
    const resourcesPayload = (await resourcesResponse.json()) as {
      resources: ResourceRow[];
    };
    setCurrentUser(mePayload.user);
    setBranches(branchesPayload.branches);
    setResources(resourcesPayload.resources);
    if (!branchFilter && mePayload.user.role === "MANAGER" && mePayload.user.branchId) {
      setBranchFilter(mePayload.user.branchId);
    }
  }, [branchFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      load().catch((caught: unknown) =>
        setError(
          caught instanceof Error ? caught.message : "Unable to load resources.",
        ),
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  function startCreate() {
    setSelectedResourceId(null);
    setMessage(null);
    setDraft({
      ...emptyDraft,
      branchId: currentUser?.role === "MANAGER"
        ? (currentUser.branchId ?? "")
        : (branches[0]?.id ?? ""),
    });
  }

  function startEdit(resource: ResourceRow) {
    setSelectedResourceId(resource.id);
    setMessage(null);
    setDraft({
      branchId: resource.branchId,
      name: resource.name,
      kind: resource.kind,
      isActive: resource.isActive,
      reason: `Update ${resource.name}`,
    });
  }

  async function saveResource() {
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const editing = Boolean(selectedResourceId);
      const response = await fetch(
        editing
          ? `/api/admin/resources/${selectedResourceId}`
          : "/api/admin/resources",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branchId: draft.branchId,
            name: draft.name,
            kind: draft.kind,
            isActive: draft.isActive,
            reason: draft.reason || undefined,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(await responseMessage(response, "Unable to save resource."));
      }
      await load();
      setMessage(editing ? "Resource updated." : "Resource created.");
      if (!editing) {
        setSelectedResourceId(null);
        setDraft({ ...emptyDraft, branchId: draft.branchId });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save resource.");
    } finally {
      setPending(false);
    }
  }

  async function toggleResource(resource: ResourceRow) {
    const action = resource.isActive ? "deactivate" : "reactivate";
    const confirmed = window.confirm(
      resource.isActive
        ? `Deactivate ${resource.name}? Running games must be stopped first.`
        : `Reactivate ${resource.name}?`,
    );
    if (!confirmed) {
      return;
    }

    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/resources/${resource.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: resource.isActive
            ? `Deactivate ${resource.name}`
            : `Reactivate ${resource.name}`,
        }),
      });
      if (!response.ok) {
        throw new Error(await responseMessage(response, `Unable to ${action} resource.`));
      }
      await load();
      setMessage(resource.isActive ? "Resource deactivated." : "Resource reactivated.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : `Unable to ${action} resource.`,
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
            <Gamepad2 className="h-5 w-5 text-emerald-700" />
            <h1 className="text-xl font-semibold tracking-normal">Resources</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-600">
            Manage pool tables and PS5 consoles available to the selling screen.
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
            <h2 className="text-base font-semibold">Branch resources</h2>
            <Button onClick={startCreate} variant="secondary">
              <Plus className="h-4 w-4" />
              New resource
            </Button>
          </div>
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Search
              <Input
                placeholder="Pool 1, PS5 1"
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
                {owner ? <option value="">All branches</option> : null}
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-2">
            {filteredResources.map((resource) => (
              <button
                key={resource.id}
                className={cn(
                  "grid gap-2 rounded-md border p-3 text-left text-sm transition hover:bg-zinc-50",
                  selectedResourceId === resource.id
                    ? "border-emerald-600 bg-emerald-50"
                    : "border-zinc-200 bg-white",
                )}
                onClick={() => startEdit(resource)}
                type="button"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{resource.name}</p>
                    <p className="text-xs text-zinc-600">
                      {kindLabel(resource.kind)} - {resource.branch.name}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={statusTone(resource.status)}>
                      {statusLabel(resource.status)}
                    </Badge>
                    <Badge tone={resource.isActive ? "success" : "danger"}>
                      {resource.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </button>
            ))}
            {filteredResources.length === 0 ? (
              <p className="rounded-md border border-zinc-200 p-4 text-sm text-zinc-600">
                No resources found.
              </p>
            ) : null}
          </div>
        </div>

        <aside className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <Pencil className="h-4 w-4 text-emerald-700" />
            <h2 className="text-base font-semibold">
              {selectedResource ? "Edit resource" : "Create resource"}
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
                  setDraft((current) => ({ ...current, branchId: event.target.value }))
                }
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Resource name
              <Input
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Type
              <select
                className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950"
                value={draft.kind}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    kind: event.target.value as ResourceKind,
                  }))
                }
              >
                <option value="POOL_TABLE">Pool table</option>
                <option value="CONSOLE">PS5 console</option>
              </select>
            </label>
            {selectedResource ? (
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
                  setDraft((current) => ({ ...current, isActive: event.target.checked }))
                }
                type="checkbox"
              />
              Active
            </label>
            <Button disabled={pending || !draft.branchId} onClick={saveResource}>
              {selectedResource ? "Save resource" : "Create resource"}
            </Button>
            {selectedResource ? (
              <Button
                disabled={pending}
                onClick={() => toggleResource(selectedResource)}
                variant={selectedResource.isActive ? "danger" : "primary"}
              >
                {selectedResource.isActive
                  ? "Deactivate resource"
                  : "Reactivate resource"}
              </Button>
            ) : null}
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

function kindLabel(kind: ResourceKind): string {
  return kind === "POOL_TABLE" ? "Pool table" : "PS5 console";
}

function statusLabel(status: ResourceRow["status"]): string {
  if (status === "AVAILABLE") {
    return "Available";
  }
  if (status === "OCCUPIED") {
    return "Occupied";
  }
  if (status === "PAUSED") {
    return "Paused";
  }
  return "Maintenance";
}

function statusTone(status: ResourceRow["status"]): "neutral" | "success" | "warning" | "danger" {
  if (status === "AVAILABLE") {
    return "success";
  }
  if (status === "MAINTENANCE") {
    return "danger";
  }
  return "warning";
}
