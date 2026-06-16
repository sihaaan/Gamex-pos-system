"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export type Role = "OWNER" | "MANAGER" | "STAFF";

export type CurrentUser = {
  role: Role;
  branchId: string | null;
};

export type BranchOption = {
  id: string;
  name: string;
  code: string;
};

export type TaxRateOption = {
  id: string;
  code: string;
  kind: "HSN" | "SAC";
  description: string;
  gstRate: string;
  effectiveTo: string | null;
};

export function AdminPageHeader({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center gap-3.5">
        <span className="brand-gradient grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white shadow-sm ring-1 ring-white/15">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
          <p className="mt-0.5 text-sm text-ink-muted">{description}</p>
        </div>
      </div>
      {actions ?? (
        <Button asChild variant="secondary">
          <Link href="/admin">Back to admin</Link>
        </Button>
      )}
    </section>
  );
}

export function StatusMessages({
  error,
  message,
}: {
  error: string | null;
  message: string | null;
}) {
  return (
    <>
      {message ? (
        <div
          className="rounded-lg border border-success-line bg-success-soft p-3 text-sm font-medium text-success-ink"
          role="status"
        >
          {message}
        </div>
      ) : null}
      {error ? (
        <div
          className="rounded-lg border border-danger-line bg-danger-soft p-3 text-sm font-medium text-danger-ink"
          role="alert"
        >
          {error}
        </div>
      ) : null}
    </>
  );
}

export function BranchScopeSelect({
  owner,
  branches,
  value,
  onChange,
  includeGlobalScopes = true,
}: {
  owner: boolean;
  branches: readonly BranchOption[];
  value: string;
  onChange: (value: string) => void;
  includeGlobalScopes?: boolean;
}) {
  return (
    <Select
      disabled={!owner}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {owner && includeGlobalScopes ? (
        <>
          <option value="">Show all</option>
          <option value="GLOBAL">Default for all branches</option>
        </>
      ) : null}
      {branches.map((branch) => (
        <option key={branch.id} value={branch.id}>
          {branch.name} ({branch.code})
        </option>
      ))}
    </Select>
  );
}

export async function responseMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return payload?.error?.message ?? fallback;
}

export function rupeeInputToPaise(value: string): number {
  return Math.round(Number(value || "0") * 100);
}

export function paiseToRupeeInput(value: number): string {
  return (value / 100).toFixed(2);
}
