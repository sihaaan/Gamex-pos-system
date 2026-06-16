"use client";

import { CheckCircle2, CirclePlay, Lock, Store } from "lucide-react";
import { OfflineStatus } from "@/components/pwa/offline-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { branchName } from "./timing";
import type { PosController } from "./use-pos-controller";

export function PosHeader({ controller }: { controller: PosController }) {
  const { state, derived, actions } = controller;

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center gap-3.5">
        <span className="brand-gradient hidden h-12 w-12 place-items-center rounded-2xl text-white shadow-sm ring-1 ring-white/15 sm:grid">
          <Store className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Selling counter
          </h1>
          <p className="text-sm font-medium text-ink-muted">
            {state.bootstrap?.user.name ?? "Operator"}
            <span className="text-ink-faint"> · </span>
            {state.bootstrap?.user.role ?? ""}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <OfflineStatus />
        {derived.isStaff ? (
          <div className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line-strong bg-surface-muted px-3 text-sm font-medium text-ink-muted">
            <Lock className="h-4 w-4" />
            <span className="grid leading-tight">
              <span className="text-ink">
                {branchName(
                  derived.currentBranchId,
                  state.bootstrap?.branches ?? [],
                ) || "Assigned branch"}
              </span>
              <span className="text-xs font-normal text-ink-subtle">
                Branch locked
              </span>
            </span>
          </div>
        ) : (
          <label className="flex items-center gap-2 text-xs font-medium text-ink-muted">
            Branch
            <Select
              aria-label="Branch"
              className="min-h-11 w-40"
              value={derived.currentBranchId}
              onChange={(event) => actions.changeBranch(event.target.value)}
            >
              {state.bootstrap?.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </label>
        )}
        {state.loading && !state.bootstrap ? (
          <Badge>Loading</Badge>
        ) : state.bootstrap?.activeShift ? (
          <>
            <Badge tone="success" dot>
              Shift open
            </Badge>
            {state.actionPending ? (
              <Badge tone="warning" dot>
                Posting
              </Badge>
            ) : null}
            <Button
              aria-label="Close operator shift"
              className="ml-1 min-h-11"
              variant="secondary"
              onClick={() => void actions.closeShift()}
              disabled={state.actionPending}
            >
              <CheckCircle2 className="h-4 w-4" />
              Close shift
            </Button>
          </>
        ) : (
          <Button
            className="min-h-11 px-5"
            onClick={() => void actions.openShift()}
            disabled={!derived.currentBranchId || state.actionPending}
          >
            <CirclePlay className="h-4 w-4" />
            Open shift
          </Button>
        )}
      </div>
    </section>
  );
}
