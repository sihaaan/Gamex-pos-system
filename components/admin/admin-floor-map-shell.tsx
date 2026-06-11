"use client";

import {
  CircleDot,
  Gamepad2,
  Map as MapIcon,
  RotateCw,
  Save,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminPageHeader,
  StatusMessages,
  responseMessage,
  type BranchOption,
  type CurrentUser,
} from "@/components/admin/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  FLOOR_MAX_SIZE,
  FLOOR_MIN_SIZE,
  defaultFootprint,
  emptyFloorLayout,
  parseFloorLayout,
  placementFits,
  type FloorLayout,
  type FloorLayoutItem,
} from "@/lib/floor-layout";
import { cn } from "@/lib/utils";

type BranchRow = BranchOption & {
  isActive: boolean;
  floorLayout: unknown;
};

type ResourceRow = {
  id: string;
  branchId: string;
  name: string;
  kind: "POOL_TABLE" | "CONSOLE";
  isActive: boolean;
  branch: { id: string; name: string; code: string } | null;
};

export function AdminFloorMapShell() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [layout, setLayout] = useState<FloorLayout>(emptyFloorLayout());
  const [placingResourceId, setPlacingResourceId] = useState<string | null>(
    null,
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const owner = currentUser?.role === "OWNER";
  const branchResources = useMemo(
    () =>
      resources.filter(
        (resource) =>
          resource.branchId === selectedBranchId && resource.isActive,
      ),
    [resources, selectedBranchId],
  );
  const resourceById = useMemo(
    () => new Map(branchResources.map((resource) => [resource.id, resource])),
    [branchResources],
  );
  const placedIds = useMemo(
    () =>
      new Set(
        layout.items
          .map((item) => item.resourceId)
          .filter((resourceId) => resourceById.has(resourceId)),
      ),
    [layout.items, resourceById],
  );
  const unplacedResources = branchResources.filter(
    (resource) => !placedIds.has(resource.id),
  );
  const selectedItem =
    layout.items.find((item) => item.resourceId === selectedItemId) ?? null;

  const load = useCallback(async () => {
    setError(null);
    const [meResponse, branchesResponse, resourcesResponse] =
      await Promise.all([
        fetch("/api/auth/me", { cache: "no-store" }),
        fetch("/api/admin/branches", { cache: "no-store" }),
        fetch("/api/admin/resources", { cache: "no-store" }),
      ]);
    if (!meResponse.ok || !branchesResponse.ok || !resourcesResponse.ok) {
      throw new Error("Unable to load the floor map.");
    }

    const mePayload = (await meResponse.json()) as { user: CurrentUser };
    const branchesPayload = (await branchesResponse.json()) as {
      branches: BranchRow[];
    };
    const resourcesPayload = (await resourcesResponse.json()) as {
      resources: ResourceRow[];
    };

    setCurrentUser(mePayload.user);
    setBranches(branchesPayload.branches);
    setResources(resourcesPayload.resources);

    // load() only runs on mount, before any branch is selected.
    const initialBranchId =
      mePayload.user.role === "MANAGER" && mePayload.user.branchId
        ? mePayload.user.branchId
        : (branchesPayload.branches.find((branch) => branch.isActive)?.id ??
          branchesPayload.branches[0]?.id ??
          "");
    setSelectedBranchId(initialBranchId);
    const initialBranch = branchesPayload.branches.find(
      (branch) => branch.id === initialBranchId,
    );
    setLayout(
      parseFloorLayout(initialBranch?.floorLayout) ?? emptyFloorLayout(),
    );
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      load().catch((caught: unknown) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load the floor map.",
        ),
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  function handleBranchChange(branchId: string) {
    setSelectedBranchId(branchId);
    const branch = branches.find((item) => item.id === branchId);
    setLayout(parseFloorLayout(branch?.floorLayout) ?? emptyFloorLayout());
    setPlacingResourceId(null);
    setSelectedItemId(null);
    setDirty(false);
    setMessage(null);
    setError(null);
  }

  function updateLayout(updater: (current: FloorLayout) => FloorLayout) {
    setLayout((current) => updater(current));
    setDirty(true);
    setMessage(null);
  }

  function resizeRoom(patch: Partial<Pick<FloorLayout, "width" | "height">>) {
    updateLayout((current) => {
      const next = {
        ...current,
        ...patch,
        items: current.items,
      };
      // Drop placements that no longer fit the smaller room.
      next.items = current.items.filter(
        (item) =>
          item.x + item.w <= next.width && item.y + item.h <= next.height,
      );
      return next;
    });
  }

  function handleCellClick(x: number, y: number) {
    if (placingResourceId) {
      const resource = resourceById.get(placingResourceId);
      if (!resource) {
        setPlacingResourceId(null);
        return;
      }
      const footprint = defaultFootprint(resource.kind);
      const item: FloorLayoutItem = {
        resourceId: resource.id,
        x,
        y,
        w: footprint.w,
        h: footprint.h,
      };
      if (!placementFits(layout, item)) {
        setError("That spot does not fit. Pick a clear area inside the room.");
        return;
      }
      setError(null);
      updateLayout((current) => ({
        ...current,
        items: [...current.items, item],
      }));
      setPlacingResourceId(null);
      setSelectedItemId(resource.id);
      return;
    }

    setSelectedItemId(null);
  }

  function moveSelected(item: FloorLayoutItem, dx: number, dy: number) {
    const moved = { ...item, x: item.x + dx, y: item.y + dy };
    if (!placementFits(layout, moved)) {
      return;
    }
    updateLayout((current) => ({
      ...current,
      items: current.items.map((candidate) =>
        candidate.resourceId === item.resourceId ? moved : candidate,
      ),
    }));
  }

  function rotateSelected(item: FloorLayoutItem) {
    const rotated = {
      ...item,
      w: item.h,
      h: item.w,
      rotation: ((item.rotation ?? 0) + 90) % 360,
    };
    if (!placementFits(layout, rotated)) {
      setError("Not enough space to rotate here.");
      return;
    }
    setError(null);
    updateLayout((current) => ({
      ...current,
      items: current.items.map((candidate) =>
        candidate.resourceId === item.resourceId ? rotated : candidate,
      ),
    }));
  }

  function removeSelected(item: FloorLayoutItem) {
    updateLayout((current) => ({
      ...current,
      items: current.items.filter(
        (candidate) => candidate.resourceId !== item.resourceId,
      ),
    }));
    setSelectedItemId(null);
  }

  async function saveLayout() {
    if (!selectedBranchId) {
      return;
    }
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const validItems = layout.items.filter((item) =>
        resourceById.has(item.resourceId),
      );
      const response = await fetch(`/api/admin/branches/${selectedBranchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          floorLayout: { ...layout, items: validItems },
          reason: "Update floor map layout",
        }),
      });
      if (!response.ok) {
        throw new Error(
          await responseMessage(response, "Unable to save the floor map."),
        );
      }
      const payload = (await response.json()) as { branch: BranchRow };
      setBranches((current) =>
        current.map((branch) =>
          branch.id === payload.branch.id
            ? { ...branch, floorLayout: payload.branch.floorLayout }
            : branch,
        ),
      );
      setDirty(false);
      setMessage("Floor map saved. The POS floor view is updated.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save the floor map.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <AdminPageHeader
        icon={MapIcon}
        title="Floor Map"
        description="Lay out pool tables and consoles the way the room looks. The POS floor view mirrors this map."
      />

      <StatusMessages error={error} message={message} />

      <section className="grid gap-4 lg:grid-cols-[1.5fr_0.8fr]">
        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-xs font-medium text-ink-muted">
                Branch
                <Select
                  className="min-w-44"
                  disabled={!owner}
                  value={selectedBranchId}
                  onChange={(event) => handleBranchChange(event.target.value)}
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} ({branch.code})
                    </option>
                  ))}
                </Select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-ink-muted">
                Width
                <Input
                  className="w-20"
                  inputMode="numeric"
                  min={FLOOR_MIN_SIZE}
                  max={FLOOR_MAX_SIZE}
                  type="number"
                  value={layout.width}
                  onChange={(event) => {
                    const width = clampSize(Number(event.target.value));
                    resizeRoom({ width });
                  }}
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-ink-muted">
                Height
                <Input
                  className="w-20"
                  inputMode="numeric"
                  min={FLOOR_MIN_SIZE}
                  max={FLOOR_MAX_SIZE}
                  type="number"
                  value={layout.height}
                  onChange={(event) => {
                    const height = clampSize(Number(event.target.value));
                    resizeRoom({ height });
                  }}
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              {dirty ? <Badge tone="warning">Unsaved changes</Badge> : null}
              <Button disabled={pending || !dirty} onClick={() => void saveLayout()}>
                <Save className="h-4 w-4" />
                Save layout
              </Button>
            </div>
          </div>

          {placingResourceId ? (
            <p className="mb-2 rounded-md border border-info-line bg-info-soft px-3 py-2 text-sm font-medium text-info-ink">
              Tap a cell to place{" "}
              {resourceById.get(placingResourceId)?.name ?? "the resource"}.
            </p>
          ) : null}

          <div
            className="relative grid w-full gap-0 overflow-hidden rounded-lg border border-line bg-surface-muted"
            style={{
              gridTemplateColumns: `repeat(${layout.width}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${layout.height}, minmax(0, 1fr))`,
              aspectRatio: `${layout.width} / ${layout.height}`,
            }}
          >
            {Array.from({ length: layout.width * layout.height }, (_, index) => {
              const x = index % layout.width;
              const y = Math.floor(index / layout.width);
              return (
                <button
                  key={`${x}-${y}`}
                  aria-label={`Cell ${x + 1}, ${y + 1}`}
                  className={cn(
                    "min-h-0 border border-line/50 transition",
                    placingResourceId
                      ? "cursor-crosshair hover:bg-info-soft"
                      : "cursor-default",
                  )}
                  onClick={() => handleCellClick(x, y)}
                  style={{
                    gridColumn: x + 1,
                    gridRow: y + 1,
                  }}
                  tabIndex={placingResourceId ? 0 : -1}
                  type="button"
                />
              );
            })}
            {layout.items.map((item) => {
              const resource = resourceById.get(item.resourceId);
              if (!resource) {
                return null;
              }
              const isPool = resource.kind === "POOL_TABLE";
              const selected = selectedItemId === item.resourceId;

              return (
                <button
                  key={item.resourceId}
                  aria-label={`${resource.name} at ${item.x + 1}, ${item.y + 1}`}
                  className={cn(
                    "z-10 m-0.5 flex min-h-0 cursor-pointer flex-col items-center justify-center gap-0.5 overflow-hidden rounded-md p-1 text-center transition",
                    isPool
                      ? "border-2 border-amber-900/80 bg-emerald-700 text-emerald-50"
                      : "bg-zinc-800 text-zinc-100",
                    selected
                      ? "ring-4 ring-brand"
                      : "ring-1 ring-black/20 hover:ring-brand",
                  )}
                  onClick={() =>
                    setSelectedItemId((current) =>
                      current === item.resourceId ? null : item.resourceId,
                    )
                  }
                  style={{
                    gridColumn: `${item.x + 1} / span ${item.w}`,
                    gridRow: `${item.y + 1} / span ${item.h}`,
                  }}
                  type="button"
                >
                  {isPool ? (
                    <CircleDot aria-hidden className="h-4 w-4 opacity-80" />
                  ) : (
                    <Gamepad2 aria-hidden className="h-4 w-4 opacity-80" />
                  )}
                  <span className="w-full truncate text-[11px] font-semibold leading-tight">
                    {resource.name}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedItem ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface-muted p-2">
              <span className="px-1 text-sm font-semibold text-ink">
                {resourceById.get(selectedItem.resourceId)?.name}
              </span>
              <div className="flex items-center gap-1">
                {(
                  [
                    ["←", -1, 0],
                    ["→", 1, 0],
                    ["↑", 0, -1],
                    ["↓", 0, 1],
                  ] as const
                ).map(([label, dx, dy]) => (
                  <Button
                    key={label}
                    aria-label={`Move ${label}`}
                    className="min-h-10 w-10 px-0"
                    onClick={() => moveSelected(selectedItem, dx, dy)}
                    variant="secondary"
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <Button
                onClick={() => rotateSelected(selectedItem)}
                variant="secondary"
              >
                <RotateCw className="h-4 w-4" />
                Rotate
              </Button>
              <Button
                className="border-danger-line text-danger hover:bg-danger-soft"
                onClick={() => removeSelected(selectedItem)}
                variant="secondary"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            </div>
          ) : null}
        </div>

        <aside className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="text-base font-semibold text-ink">Resources</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Tap a resource, then tap a cell on the map to place it. Pool tables
            take a 3x2 footprint, consoles 1x1.
          </p>
          <div className="mt-3 grid gap-2">
            {unplacedResources.map((resource) => (
              <button
                key={resource.id}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  placingResourceId === resource.id
                    ? "border-brand bg-info-soft text-info-ink"
                    : "border-line bg-surface text-ink hover:bg-surface-strong",
                )}
                onClick={() =>
                  setPlacingResourceId((current) =>
                    current === resource.id ? null : resource.id,
                  )
                }
                type="button"
              >
                {resource.kind === "POOL_TABLE" ? (
                  <CircleDot className="h-4 w-4 shrink-0" />
                ) : (
                  <Gamepad2 className="h-4 w-4 shrink-0" />
                )}
                {resource.name}
                {placingResourceId === resource.id ? (
                  <Badge className="ml-auto" tone="info">
                    Placing
                  </Badge>
                ) : null}
              </button>
            ))}
            {unplacedResources.length === 0 ? (
              <p className="rounded-md bg-surface-muted px-3 py-2 text-sm text-ink-muted">
                {branchResources.length === 0
                  ? "No active resources in this branch."
                  : "Every resource is placed on the map."}
              </p>
            ) : null}
          </div>
        </aside>
      </section>
    </main>
  );
}

function clampSize(value: number): number {
  if (!Number.isFinite(value)) {
    return FLOOR_MIN_SIZE;
  }
  return Math.min(Math.max(Math.round(value), FLOOR_MIN_SIZE), FLOOR_MAX_SIZE);
}
