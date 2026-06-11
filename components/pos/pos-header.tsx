"use client";

import { CheckCircle2, CirclePlay, Lock } from "lucide-react";
import { OfflineStatus } from "@/components/pwa/offline-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { branchName } from "./timing";
import type { PosController } from "./use-pos-controller";

export function PosHeader({ controller }: { controller: PosController }) {
  const { state, derived, actions } = controller;

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div>
        <h1 className="text-xl font-semibold tracking-normal text-ink">
          Selling counter
        </h1>
        <p className="text-sm text-ink-muted">
          {state.bootstrap?.user.name ?? "Operator"} -{" "}
          {state.bootstrap?.user.role ?? ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <OfflineStatus />
        {derived.isStaff ? (
          <div className="inline-flex min-h-10 items-center gap-2 rounded-md border border-line-strong bg-surface-muted px-3 text-sm font-medium text-ink-muted">
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
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            Branch
            <Select
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
            <Badge tone="success">Shift open</Badge>
            {state.actionPending ? <Badge tone="warning">Posting</Badge> : null}
            <Button
              aria-label="Close operator shift"
              className="ml-2"
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
            className="min-h-12 px-5 text-base"
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
