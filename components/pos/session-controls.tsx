"use client";

import {
  AlertTriangle,
  Check,
  CircleDot,
  CirclePause,
  CirclePlay,
  Clock,
  LayoutGrid,
  Map,
  Monitor,
  Square,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPaise } from "@/lib/utils";
import { parseFloorLayout } from "@/lib/floor-layout";
import { findServiceForResource } from "@/lib/pos/service-selection";
import { staffServiceName } from "@/lib/pos/display";
import { FloorMap } from "./floor-map";
import {
  billLabel,
  cashierServiceName,
  elapsedLineLabel,
  resourceLabel,
  resourceStartState,
  statusLabel,
} from "./timing";
import type { PosController } from "./use-pos-controller";
import type { Resource, TimedLine } from "./types";

const FLOOR_VIEW_STORAGE_KEY = "gamex-pos-floor-view";

export function SessionControls({
  controller,
}: {
  controller: PosController;
}) {
  const { state, derived, actions } = controller;
  const {
    branchResources,
    resourceUseById,
    canUseResourceBoard,
    selectedTab,
    currentBillLabel,
    currentBranchId,
  } = derived;

  const floorLayout = useMemo(() => {
    const branch = state.bootstrap?.branches.find(
      (candidate) => candidate.id === currentBranchId,
    );
    const layout = parseFloorLayout(branch?.floorLayout);
    return layout && layout.items.length > 0 ? layout : null;
  }, [state.bootstrap?.branches, currentBranchId]);

  const [floorViewPreferred, setFloorViewPreferred] = useState(true);
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const stored = window.localStorage.getItem(FLOOR_VIEW_STORAGE_KEY);
      if (stored !== null) {
        setFloorViewPreferred(stored === "true");
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const showFloorView = Boolean(floorLayout) && floorViewPreferred;

  function toggleFloorView() {
    setFloorViewPreferred((current) => {
      const next = !current;
      window.localStorage.setItem(FLOOR_VIEW_STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Start play</h2>
          <p className="text-sm text-ink-muted">
            Tap an available pool table or PS5 to start a bill or add to the
            current bill.
          </p>
        </div>
        {floorLayout ? (
          <Button
            aria-pressed={showFloorView}
            onClick={toggleFloorView}
            variant="secondary"
          >
            {showFloorView ? (
              <>
                <LayoutGrid className="h-4 w-4" />
                Grid view
              </>
            ) : (
              <>
                <Map className="h-4 w-4" />
                Floor view
              </>
            )}
          </Button>
        ) : null}
      </div>
      {showFloorView && floorLayout ? (
        <FloorMap controller={controller} layout={floorLayout} />
      ) : (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {branchResources.map((resource) => {
          const service = findServiceForResource(
            resource,
            state.bootstrap?.services ?? [],
          );
          const resourceUse = resourceUseById.get(resource.id) ?? null;
          const estimatedLine = state.quote?.lines.find(
            (line) => line.sourceLineId === resourceUse?.line.id,
          );
          const canStart =
            resource.status === "AVAILABLE" &&
            canUseResourceBoard &&
            Boolean(service);
          const startState = resourceStartState({
            hasShift: Boolean(state.bootstrap?.activeShift),
            hasService: Boolean(service),
            actionPending: state.actionPending,
            currentBillLabel: selectedTab ? currentBillLabel : null,
          });

          if (resource.status === "AVAILABLE") {
            return (
              <button
                key={resource.id}
                aria-label={
                  service
                    ? `Start ${cashierServiceName(service)} on ${resource.name}`
                    : `Start play on ${resource.name}`
                }
                className={`grid min-h-44 gap-3 rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed ${
                  canStart
                    ? "border-success-line bg-success-soft hover:border-brand"
                    : "border-line bg-surface-muted"
                }`}
                disabled={!canStart}
                onClick={() => void actions.startSession(resource)}
              >
                <ResourceCardHeader resource={resource} liveLine={null} />
                <span className="rounded-md bg-surface/80 px-3 py-2 text-sm font-semibold text-success-ink">
                  {startState}
                </span>
                {selectedTab ? (
                  <span className="rounded-md bg-surface/70 px-3 py-2 text-xs font-medium text-success-ink">
                    Selected bill: {currentBillLabel}
                  </span>
                ) : null}
                {service ? (
                  <span className="text-sm text-ink-muted">
                    {cashierServiceName(service)} -{" "}
                    {formatPaise(service.pricingRule.ratePerMinute)}/min
                  </span>
                ) : (
                  <span className="text-sm text-danger">Service missing</span>
                )}
              </button>
            );
          }

          return (
            <div
              key={resource.id}
              className={`grid min-h-44 gap-3 rounded-xl border p-4 text-left ${
                resource.status === "MAINTENANCE"
                  ? "border-danger-line bg-danger-soft"
                  : "border-warning-line bg-warning-soft"
              }`}
            >
              <ResourceCardHeader
                resource={resource}
                liveLine={resourceUse?.line ?? null}
              />
              {resourceUse ? (
                <>
                  <div className="grid gap-1 rounded-md bg-surface/80 px-3 py-2 text-sm text-ink">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <UserRound className="h-4 w-4" />
                      {billLabel(resourceUse.tab)}
                    </span>
                    <span>
                      {staffServiceName(resourceUse.line.descriptionSnapshot)} -{" "}
                      {statusLabel(resourceUse.line.status)}
                    </span>
                    <span className="text-xs text-ink-muted">
                      {elapsedLineLabel(resourceUse.line)}
                    </span>
                    <span className="text-xs text-ink-muted">
                      {estimatedLine
                        ? `Estimate ${formatPaise(estimatedLine.totalAmount)}`
                        : state.selectedTabId === resourceUse.tab.id
                          ? "Estimate calculating"
                          : "Open bill to see estimate"}
                    </span>
                  </div>
                  <div className="grid gap-2">
                    <Button
                      className="min-h-11"
                      disabled={state.actionPending}
                      onClick={() => actions.selectTab(resourceUse.tab.id)}
                      variant="secondary"
                    >
                      <UserRound className="h-4 w-4" />
                      Open bill
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      {resourceUse.line.status === "PAUSED" ? (
                        <Button
                          className="min-h-11"
                          disabled={state.actionPending}
                          onClick={() =>
                            void actions.resumeTimedLine(resourceUse.line)
                          }
                          variant="secondary"
                        >
                          <CirclePlay className="h-4 w-4" />
                          Resume
                        </Button>
                      ) : (
                        <Button
                          className="min-h-11"
                          disabled={state.actionPending}
                          onClick={() =>
                            void actions.pauseTimedLine(resourceUse.line)
                          }
                          variant="secondary"
                        >
                          <CirclePause className="h-4 w-4" />
                          Pause
                        </Button>
                      )}
                      <Button
                        className={
                          state.stopConfirmLineId === resourceUse.line.id
                            ? "min-h-11"
                            : "min-h-11 border-danger-line text-danger hover:bg-danger-soft"
                        }
                        disabled={state.actionPending}
                        onClick={() =>
                          void actions.stopTimedLine(resourceUse.line)
                        }
                        variant={
                          state.stopConfirmLineId === resourceUse.line.id
                            ? "danger"
                            : "secondary"
                        }
                      >
                        <Square className="h-4 w-4" />
                        {state.stopConfirmLineId === resourceUse.line.id
                          ? "Confirm stop"
                          : "Stop"}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <span className="rounded-md bg-surface/80 px-3 py-2 text-sm font-medium text-warning-ink">
                  Not available
                </span>
              )}
            </div>
          );
        })}
        {!state.loading && branchResources.length === 0 ? (
          <p className="col-span-full text-sm text-ink-muted">
            No resources configured for this branch.
          </p>
        ) : null}
      </div>
      )}
    </div>
  );
}

export function StartPromptDialog({
  controller,
}: {
  controller: PosController;
}) {
  const { state, actions } = controller;

  if (!state.startPrompt) {
    return null;
  }

  return (
    <div
      aria-labelledby="start-play-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4"
      role="dialog"
    >
      <form
        className="grid w-full max-w-sm gap-4 rounded-xl border border-line bg-surface p-5 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          void actions.confirmStartPrompt();
        }}
      >
        <div>
          <h2
            className="text-lg font-semibold tracking-normal text-ink"
            id="start-play-title"
          >
            Start play on {state.startPrompt.resource.name}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Create a bill and start this game in one step.
          </p>
        </div>
        <label className="grid gap-1.5 text-sm font-medium text-ink-muted">
          Customer / table name
          <Input
            autoFocus
            value={state.startBillLabel}
            onChange={(event) =>
              actions.dispatch({
                type: "START_BILL_LABEL_CHANGED",
                label: event.target.value,
              })
            }
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button
            disabled={state.actionPending}
            onClick={actions.closeStartPrompt}
            type="button"
            variant="secondary"
          >
            Cancel
          </Button>
          <Button disabled={state.actionPending} type="submit">
            <CirclePlay className="h-4 w-4" />
            Start play
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ResourceCardHeader({
  resource,
  liveLine,
}: {
  resource: Resource;
  liveLine: TimedLine | null;
}) {
  return (
    <span className="grid gap-2">
      <span>
        <span className="block text-lg font-semibold text-ink">
          {resource.name}
        </span>
        <span className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
          {resource.kind === "POOL_TABLE" ? (
            <CircleDot className="h-4 w-4" />
          ) : (
            <Monitor className="h-4 w-4" />
          )}
          {resourceLabel(resource.kind)}
        </span>
      </span>
      <ResourceStatusBadge resource={resource} liveLine={liveLine} />
    </span>
  );
}

export function ResourceStatusBadge({
  resource,
  liveLine,
}: {
  resource: Resource;
  liveLine: TimedLine | null;
}) {
  if (resource.status === "AVAILABLE") {
    return (
      <Badge tone="success" className="w-fit text-sm">
        <Check className="h-4 w-4" />
        Available
      </Badge>
    );
  }

  if (resource.status === "MAINTENANCE") {
    return (
      <Badge tone="danger" className="w-fit text-sm">
        <AlertTriangle className="h-4 w-4" />
        Maintenance
      </Badge>
    );
  }

  if (liveLine?.status === "PAUSED" || resource.status === "PAUSED") {
    return (
      <Badge tone="info" className="w-fit text-sm">
        <CirclePause className="h-4 w-4" />
        Paused
      </Badge>
    );
  }

  return (
    <Badge tone="warning" className="w-fit text-sm">
      <Clock className="h-4 w-4" />
      Occupied
    </Badge>
  );
}
