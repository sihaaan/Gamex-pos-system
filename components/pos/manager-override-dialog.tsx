"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PosController } from "./use-pos-controller";

export function ManagerOverrideDialog({
  controller,
}: {
  controller: PosController;
}) {
  const { state, derived, actions } = controller;

  if (state.managerApproval.overrideId) {
    return <Badge tone="success">Manager approved</Badge>;
  }

  if (!derived.discountRequiresManagerApproval) {
    return null;
  }

  return (
    <div className="grid gap-2 rounded-lg border border-warning-line bg-warning-soft p-3">
      <p className="text-sm font-semibold text-warning-ink">
        Manager approval required
      </p>
      <label className="grid gap-1 text-xs font-medium text-warning-ink">
        Manager email
        <Input
          autoComplete="username"
          disabled={state.actionPending}
          inputMode="email"
          value={state.managerApproval.emailOrCode}
          onChange={(event) =>
            actions.dispatch({
              type: "MANAGER_APPROVAL_CHANGED",
              patch: { emailOrCode: event.target.value },
            })
          }
        />
      </label>
      <label className="grid gap-1 text-xs font-medium text-warning-ink">
        Manager password
        <Input
          autoComplete="current-password"
          disabled={state.actionPending}
          type="password"
          value={state.managerApproval.password}
          onChange={(event) =>
            actions.dispatch({
              type: "MANAGER_APPROVAL_CHANGED",
              patch: { password: event.target.value },
            })
          }
        />
      </label>
      <Button
        disabled={state.actionPending}
        onClick={() => void actions.approveDiscountOverride()}
        variant="secondary"
      >
        Approve discount
      </Button>
    </div>
  );
}
