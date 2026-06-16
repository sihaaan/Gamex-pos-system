"use client";

import { KeyRound, Pencil, RotateCcw, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Role = "OWNER" | "MANAGER" | "STAFF";

type CurrentUser = {
  id: string;
  role: Role;
  branchId: string | null;
};

type UserRow = {
  id: string;
  branchId: string | null;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

type BranchOption = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
};

type UserDraft = {
  name: string;
  email: string;
  role: Role;
  branchId: string;
  temporaryPassword: string;
  isActive: boolean;
  reason: string;
};

const emptyDraft: UserDraft = {
  name: "",
  email: "",
  role: "STAFF",
  branchId: "",
  temporaryPassword: "",
  isActive: true,
  reason: "",
};

export function AdminUsersShell() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [draft, setDraft] = useState<UserDraft>(emptyDraft);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetReason, setResetReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users],
  );
  const branchById = useMemo(
    () => new Map(branches.map((branch) => [branch.id, branch])),
    [branches],
  );
  const roleOptions = currentUser?.role === "OWNER"
    ? (["STAFF", "MANAGER", "OWNER"] as const)
    : (["STAFF"] as const);

  const load = useCallback(async () => {
    setError(null);
    const [meResponse, usersResponse, branchesResponse] = await Promise.all([
      fetch("/api/auth/me", { cache: "no-store" }),
      fetch("/api/admin/users", { cache: "no-store" }),
      fetch("/api/admin/branches", { cache: "no-store" }),
    ]);

    if (!meResponse.ok || !usersResponse.ok || !branchesResponse.ok) {
      throw new Error("Unable to load user management.");
    }

    const mePayload = (await meResponse.json()) as { user: CurrentUser };
    const usersPayload = (await usersResponse.json()) as { users: UserRow[] };
    const branchesPayload = (await branchesResponse.json()) as {
      branches: BranchOption[];
    };
    setCurrentUser(mePayload.user);
    setUsers(usersPayload.users);
    setBranches(branchesPayload.branches);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      load().catch((caught: unknown) =>
        setError(
          caught instanceof Error ? caught.message : "Unable to load users.",
        ),
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!currentUser || draft.branchId || branches.length === 0) {
        return;
      }
      if (currentUser.role === "MANAGER" && currentUser.branchId) {
        setDraft((current) => ({
          ...current,
          branchId: currentUser.branchId ?? "",
        }));
        return;
      }
      if (draft.role !== "OWNER") {
        setDraft((current) => ({ ...current, branchId: branches[0]?.id ?? "" }));
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [branches, currentUser, draft.branchId, draft.role]);

  function startCreate() {
    setSelectedUserId(null);
    setResetPassword("");
    setResetReason("");
    setMessage(null);
    setDraft({
      ...emptyDraft,
      branchId:
        currentUser?.role === "MANAGER"
          ? (currentUser.branchId ?? "")
          : (branches[0]?.id ?? ""),
    });
  }

  function startEdit(user: UserRow) {
    setSelectedUserId(user.id);
    setResetPassword("");
    setResetReason("");
    setMessage(null);
    setDraft({
      name: user.name,
      email: user.email,
      role: user.role,
      branchId: user.branchId ?? "",
      temporaryPassword: "",
      isActive: user.isActive,
      reason: `Update ${user.name}`,
    });
  }

  async function saveUser() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const editing = Boolean(selectedUserId);
      const body = editing
        ? {
            name: draft.name,
            role: draft.role,
            branchId: draft.branchId || null,
            isActive: draft.isActive,
            reason: draft.reason || undefined,
          }
        : {
            name: draft.name,
            email: draft.email,
            role: draft.role,
            branchId: draft.branchId || null,
            temporaryPassword: draft.temporaryPassword,
            isActive: draft.isActive,
          };

      const response = await fetch(
        editing ? `/api/admin/users/${selectedUserId}` : "/api/admin/users",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        throw new Error(await responseMessage(response, "Unable to save user."));
      }
      await load();
      setMessage(editing ? "User updated." : "User created.");
      if (!editing) {
        setSelectedUserId(null);
        setResetPassword("");
        setResetReason("");
        setDraft({
          ...emptyDraft,
          branchId:
            currentUser?.role === "MANAGER"
              ? (currentUser.branchId ?? "")
              : (branches[0]?.id ?? ""),
        });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save user.");
    } finally {
      setPending(false);
    }
  }

  async function resetSelectedPassword() {
    if (!selectedUser) {
      return;
    }
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/users/${selectedUser.id}/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            temporaryPassword: resetPassword,
            reason: resetReason || undefined,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(await responseMessage(response, "Unable to reset password."));
      }
      setResetPassword("");
      setResetReason("");
      setMessage("Password reset. Existing sessions were signed out.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to reset password.",
      );
    } finally {
      setPending(false);
    }
  }

  async function toggleUserActive(user: UserRow) {
    const action = user.isActive ? "deactivate" : "reactivate";
    const confirmed = window.confirm(
      user.isActive
        ? `Deactivate ${user.name}? Existing sessions will be signed out.`
        : `Reactivate ${user.name}?`,
    );
    if (!confirmed) {
      return;
    }

    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: user.isActive
            ? `Deactivate ${user.name}`
            : `Reactivate ${user.name}`,
        }),
      });
      if (!response.ok) {
        throw new Error(await responseMessage(response, `Unable to ${action} user.`));
      }
      await load();
      setMessage(user.isActive ? "User deactivated." : "User reactivated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Unable to ${action} user.`);
    } finally {
      setPending(false);
    }
  }

  const branchLocked = currentUser?.role === "MANAGER";

  return (
    <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-success" />
            <h1 className="text-xl font-semibold tracking-normal">Users</h1>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Create staff logins, reset passwords, and deactivate access with audit logs.
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
            <h2 className="text-base font-semibold">Same legal entity users</h2>
            <Button onClick={startCreate} variant="secondary">
              <UserPlus className="h-4 w-4" />
              New user
            </Button>
          </div>
          <div className="grid gap-2">
            {users.map((user) => (
              <button
                key={user.id}
                className={cn(
                  "grid gap-2 rounded-md border p-3 text-left text-sm transition hover:bg-surface-muted",
                  selectedUserId === user.id
                    ? "border-brand bg-success-soft"
                    : "border-line bg-surface",
                )}
                onClick={() => startEdit(user)}
                type="button"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{user.name}</p>
                    <p className="text-xs text-ink-muted">{user.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{roleLabel(user.role)}</Badge>
                    <Badge tone={user.isActive ? "success" : "danger"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                <dl className="grid gap-2 text-xs text-ink-muted sm:grid-cols-3">
                  <div>
                    <dt className="font-medium text-ink-subtle">Branch</dt>
                    <dd>{formatBranch(user.branchId, branchById)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-ink-subtle">Last login</dt>
                    <dd>{formatDate(user.lastLoginAt)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-ink-subtle">Created</dt>
                    <dd>{formatDate(user.createdAt)}</dd>
                  </div>
                </dl>
              </button>
            ))}
            {users.length === 0 ? (
              <p className="rounded-md border border-line p-4 text-sm text-ink-muted">
                No users found for your scope.
              </p>
            ) : null}
          </div>
        </div>

        <aside className="grid gap-4">
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <div className="mb-3 flex items-center gap-2">
              <Pencil className="h-4 w-4 text-success" />
              <h2 className="text-base font-semibold">
                {selectedUser ? "Edit user" : "Create user"}
              </h2>
            </div>
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
                Email
                <Input
                  disabled={Boolean(selectedUser)}
                  type="email"
                  value={draft.email}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-ink-muted">
                Role
                <select
                  className="min-h-10 rounded-md border border-line-strong bg-surface px-3 text-sm text-ink"
                  value={draft.role}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      role: event.target.value as Role,
                      branchId:
                        event.target.value === "OWNER"
                          ? ""
                          : current.branchId || branches[0]?.id || "",
                    }))
                  }
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {roleLabel(role)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-ink-muted">
                Branch
                <select
                  className="min-h-10 rounded-md border border-line-strong bg-surface px-3 text-sm text-ink disabled:bg-surface-strong"
                  disabled={branchLocked || draft.role === "OWNER"}
                  value={draft.branchId}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      branchId: event.target.value,
                    }))
                  }
                >
                  {draft.role === "OWNER" ? (
                    <option value="">All branches</option>
                  ) : null}
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} ({branch.code})
                    </option>
                  ))}
                </select>
              </label>
              {!selectedUser ? (
                <label className="grid gap-1 text-xs font-medium text-ink-muted">
                  Temporary password
                  <Input
                    autoComplete="new-password"
                    type="password"
                    value={draft.temporaryPassword}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        temporaryPassword: event.target.value,
                      }))
                    }
                  />
                </label>
              ) : (
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
              )}
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
              <Button disabled={pending} onClick={saveUser}>
                {selectedUser ? "Save user" : "Create user"}
              </Button>
            </div>
          </section>

          {selectedUser ? (
            <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
              <div className="mb-3 flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-success" />
                <h2 className="text-base font-semibold">Access actions</h2>
              </div>
              <div className="grid gap-3">
                <label className="grid gap-1 text-xs font-medium text-ink-muted">
                  New temporary password
                  <Input
                    autoComplete="new-password"
                    type="password"
                    value={resetPassword}
                    onChange={(event) => setResetPassword(event.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-ink-muted">
                  Reset reason
                  <Input
                    value={resetReason}
                    onChange={(event) => setResetReason(event.target.value)}
                  />
                </label>
                <Button
                  disabled={pending || resetPassword.length < 8}
                  onClick={resetSelectedPassword}
                  variant="secondary"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset password
                </Button>
                <Button
                  disabled={pending}
                  onClick={() => toggleUserActive(selectedUser)}
                  variant={selectedUser.isActive ? "danger" : "primary"}
                >
                  {selectedUser.isActive ? "Deactivate user" : "Reactivate user"}
                </Button>
              </div>
            </section>
          ) : null}
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

function roleLabel(role: Role): string {
  if (role === "OWNER") {
    return "Owner";
  }
  if (role === "MANAGER") {
    return "Manager";
  }
  return "Staff";
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Never";
  }
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatBranch(
  branchId: string | null,
  branchById: ReadonlyMap<string, BranchOption>,
): string {
  if (!branchId) {
    return "All branches";
  }
  const branch = branchById.get(branchId);
  return branch ? `${branch.name} (${branch.code})` : "Branch unavailable";
}
