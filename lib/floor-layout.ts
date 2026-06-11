export type FloorLayoutItem = {
  resourceId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
};

export type FloorLayout = {
  width: number;
  height: number;
  items: FloorLayoutItem[];
};

export const FLOOR_MIN_SIZE = 2;
export const FLOOR_MAX_SIZE = 40;

export function emptyFloorLayout(): FloorLayout {
  return { width: 12, height: 8, items: [] };
}

export function defaultFootprint(kind: string): { w: number; h: number } {
  return kind === "POOL_TABLE" ? { w: 3, h: 2 } : { w: 1, h: 1 };
}

/**
 * Runtime guard for layout JSON loaded from the API. Returns null for
 * anything that does not look like a usable layout so callers can fall
 * back to the list view.
 */
export function parseFloorLayout(value: unknown): FloorLayout | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const width = candidate.width;
  const height = candidate.height;
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < FLOOR_MIN_SIZE ||
    height < FLOOR_MIN_SIZE ||
    width > FLOOR_MAX_SIZE ||
    height > FLOOR_MAX_SIZE
  ) {
    return null;
  }

  const rawItems = Array.isArray(candidate.items) ? candidate.items : [];
  const items: FloorLayoutItem[] = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      continue;
    }
    const item = raw as Record<string, unknown>;
    if (
      typeof item.resourceId !== "string" ||
      typeof item.x !== "number" ||
      typeof item.y !== "number" ||
      typeof item.w !== "number" ||
      typeof item.h !== "number"
    ) {
      continue;
    }
    items.push({
      resourceId: item.resourceId,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      ...(typeof item.rotation === "number"
        ? { rotation: item.rotation }
        : {}),
    });
  }

  return { width, height, items };
}

export function itemsOverlap(
  left: FloorLayoutItem,
  right: FloorLayoutItem,
): boolean {
  return (
    left.x < right.x + right.w &&
    right.x < left.x + left.w &&
    left.y < right.y + right.h &&
    right.y < left.y + left.h
  );
}

export function placementFits(
  layout: FloorLayout,
  item: FloorLayoutItem,
): boolean {
  if (item.x < 0 || item.y < 0) {
    return false;
  }
  if (item.x + item.w > layout.width || item.y + item.h > layout.height) {
    return false;
  }
  return !layout.items.some(
    (other) => other.resourceId !== item.resourceId && itemsOverlap(other, item),
  );
}
