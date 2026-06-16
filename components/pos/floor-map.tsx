"use client";

import { CircleDot, Gamepad2, UserRound, Wrench } from "lucide-react";
import { findServiceForResource } from "@/lib/pos/service-selection";
import { timedPricingLabel } from "@/lib/timed-pricing-label";
import type { FloorLayout } from "@/lib/floor-layout";
import { billLabel, elapsedLineLabel } from "./timing";
import type { Resource, Tab, TimedLine } from "./types";
import type { PosController } from "./use-pos-controller";

type LiveStatus = "AVAILABLE" | "OCCUPIED" | "PAUSED" | "MAINTENANCE";

const statusRing: Record<LiveStatus, string> = {
  AVAILABLE: "ring-emerald-500",
  OCCUPIED: "ring-amber-500",
  PAUSED: "ring-blue-500",
  MAINTENANCE: "ring-zinc-500",
};

const statusDot: Record<LiveStatus, string> = {
  AVAILABLE: "bg-emerald-500",
  OCCUPIED: "bg-amber-500",
  PAUSED: "bg-blue-500",
  MAINTENANCE: "bg-zinc-500",
};

const statusText: Record<LiveStatus, string> = {
  AVAILABLE: "Available",
  OCCUPIED: "Occupied",
  PAUSED: "Paused",
  MAINTENANCE: "Maintenance",
};

function liveStatus(
  resource: Resource,
  liveLine: TimedLine | null,
): LiveStatus {
  if (resource.status === "MAINTENANCE") {
    return "MAINTENANCE";
  }
  if (liveLine?.status === "PAUSED" || resource.status === "PAUSED") {
    return "PAUSED";
  }
  if (liveLine || resource.status === "OCCUPIED") {
    return "OCCUPIED";
  }
  return "AVAILABLE";
}

export function FloorMap({
  controller,
  layout,
}: {
  controller: PosController;
  layout: FloorLayout;
}) {
  const { state, derived, actions } = controller;
  const { branchResources, resourceUseById } = derived;

  const resourceById = new Map(
    branchResources.map((resource) => [resource.id, resource]),
  );
  const placedIds = new Set(
    layout.items
      .map((item) => item.resourceId)
      .filter((resourceId) => resourceById.has(resourceId)),
  );
  const unplacedResources = branchResources.filter(
    (resource) => !placedIds.has(resource.id),
  );

  function handleTileTap(resource: Resource, use: { tab: Tab } | null) {
    if (state.actionPending) {
      return;
    }
    if (use) {
      actions.selectTab(use.tab.id);
      return;
    }
    if (resource.status === "AVAILABLE") {
      void actions.startSession(resource);
    }
  }

  return (
    <div className="grid gap-3">
      <div
        aria-label="Floor map"
        className="relative grid w-full gap-1 rounded-xl border border-line bg-surface-muted p-2"
        role="group"
        style={{
          gridTemplateColumns: `repeat(${layout.width}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${layout.height}, minmax(0, 1fr))`,
          aspectRatio: `${layout.width} / ${layout.height}`,
          backgroundImage:
            "linear-gradient(to right, var(--line) 1px, transparent 1px), linear-gradient(to bottom, var(--line) 1px, transparent 1px)",
          backgroundSize: `calc(100% / ${layout.width}) calc(100% / ${layout.height})`,
        }}
      >
        {layout.items.map((item) => {
          const resource = resourceById.get(item.resourceId);
          if (!resource) {
            return null;
          }
          const use = resourceUseById.get(resource.id) ?? null;
          const status = liveStatus(resource, use?.line ?? null);
          const isPool = resource.kind === "POOL_TABLE";
          const tappable =
            !state.actionPending &&
            (Boolean(use) ||
              (resource.status === "AVAILABLE" &&
                derived.canUseResourceBoard &&
                Boolean(
                  findServiceForResource(
                    resource,
                    state.bootstrap?.services ?? [],
                  ),
                )));

          return (
            <button
              key={item.resourceId}
              aria-label={`${resource.name} - ${statusText[status]}${
                use ? ` - ${billLabel(use.tab)}` : ""
              }`}
              className={`relative flex min-h-0 cursor-pointer flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg p-1 text-center shadow-sm ring-2 transition focus-visible:outline-none focus-visible:ring-4 enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 ${
                statusRing[status]
              } ${
                isPool
                  ? "border-2 border-amber-900/80 bg-emerald-700 text-emerald-50"
                  : "bg-zinc-800 text-zinc-100"
              }`}
              disabled={!tappable}
              onClick={() => handleTileTap(resource, use)}
              style={{
                gridColumn: `${item.x + 1} / span ${item.w}`,
                gridRow: `${item.y + 1} / span ${item.h}`,
              }}
              type="button"
            >
              <span
                aria-hidden
                className={`absolute right-1 top-1 h-2.5 w-2.5 rounded-full ${statusDot[status]}`}
              />
              {isPool ? (
                <CircleDot aria-hidden className="h-4 w-4 shrink-0 opacity-80" />
              ) : (
                <Gamepad2 aria-hidden className="h-4 w-4 shrink-0 opacity-80" />
              )}
              <span className="w-full truncate text-[11px] font-semibold leading-tight">
                {resource.name}
              </span>
              {use ? (
                <span className="flex w-full items-center justify-center gap-1 truncate text-[10px] font-medium opacity-90">
                  <UserRound aria-hidden className="h-3 w-3 shrink-0" />
                  <span className="truncate">{billLabel(use.tab)}</span>
                </span>
              ) : status === "MAINTENANCE" ? (
                <Wrench aria-hidden className="h-3 w-3 opacity-80" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
        {(
          ["AVAILABLE", "OCCUPIED", "PAUSED", "MAINTENANCE"] as LiveStatus[]
        ).map((status) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={`h-2.5 w-2.5 rounded-full ${statusDot[status]}`}
            />
            {statusText[status]}
          </span>
        ))}
      </div>

      {unplacedResources.length > 0 ? (
        <div className="grid gap-2">
          <p className="text-xs font-semibold uppercase text-ink-subtle">
            Not on the map
          </p>
          <div className="flex flex-wrap gap-2">
            {unplacedResources.map((resource) => {
              const use = resourceUseById.get(resource.id) ?? null;
              const status = liveStatus(resource, use?.line ?? null);
              const service = findServiceForResource(
                resource,
                state.bootstrap?.services ?? [],
              );
              const tappable =
                !state.actionPending &&
                (Boolean(use) ||
                  (resource.status === "AVAILABLE" &&
                    derived.canUseResourceBoard &&
                    Boolean(service)));

              return (
                <button
                  key={resource.id}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm font-medium text-ink transition hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!tappable}
                  onClick={() => handleTileTap(resource, use)}
                  type="button"
                >
                  <span
                    aria-hidden
                    className={`h-2.5 w-2.5 rounded-full ${statusDot[status]}`}
                  />
                  {resource.name}
                  <span className="text-xs font-normal text-ink-muted">
                    {use
                      ? elapsedLineLabel(use.line)
                      : service
                        ? timedPricingLabel(service.pricingRule)
                        : statusText[status]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
