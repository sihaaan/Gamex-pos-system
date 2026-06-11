import { formatPaise } from "@/lib/utils";
import { staffInvoiceLineLabel, staffServiceName } from "@/lib/pos/display";
import type {
  Branch,
  InvoiceLine,
  Resource,
  Service,
  Tab,
  TimedLine,
  TimedLineTiming,
} from "./types";

export function isLiveTimedLine(line: TimedLine): boolean {
  return line.status === "RUNNING" || line.status === "PAUSED";
}

export function timedLineBadgeTone(
  status: TimedLine["status"],
): "neutral" | "success" | "warning" | "danger" {
  if (status === "RUNNING") {
    return "success";
  }
  if (status === "PAUSED") {
    return "warning";
  }
  if (status === "VOIDED") {
    return "danger";
  }
  return "neutral";
}

export function statusLabel(status: TimedLine["status"]): string {
  if (status === "RUNNING") {
    return "Running";
  }
  if (status === "PAUSED") {
    return "Paused";
  }
  if (status === "STOPPED") {
    return "Stopped";
  }
  if (status === "CLOSED") {
    return "Closed";
  }
  return "Voided";
}

export function resourceLabel(kind: Resource["kind"]): string {
  return kind === "POOL_TABLE" ? "Pool table" : "PS5 console";
}

export function resourceKindForTimedLine(
  line: TimedLine,
): Resource["kind"] | null {
  const description = line.descriptionSnapshot.toLowerCase();
  if (description.includes("pool")) {
    return "POOL_TABLE";
  }
  if (description.includes("ps5") || description.includes("console")) {
    return "CONSOLE";
  }
  return null;
}

export function resourceStartState({
  hasShift,
  hasService,
  actionPending,
  currentBillLabel,
}: {
  hasShift: boolean;
  hasService: boolean;
  actionPending: boolean;
  currentBillLabel: string | null;
}): string {
  if (actionPending) {
    return "Posting";
  }
  if (!hasShift) {
    return "Open shift first";
  }
  if (!hasService) {
    return "Service missing";
  }
  return currentBillLabel ? "Add to selected bill" : "Tap to start";
}

export function billLabel(tab: Tab): string {
  return tab.customerLabel || tab.customerName || "Walk-in bill";
}

export function branchName(
  branchId: string,
  branches: readonly Branch[],
): string {
  return branches.find((branch) => branch.id === branchId)?.name ?? "";
}

export function cashierServiceName(service: Service): string {
  return staffServiceName(`${service.name} ${service.description}`);
}

export function billHeaderLineLabel(
  line: InvoiceLine,
  timedLines: readonly TimedLine[],
): string {
  const sourceTimedLine = line.sourceLineId
    ? timedLines.find((timedLine) => timedLine.id === line.sourceLineId) ?? null
    : null;

  if (sourceTimedLine?.resource?.name && line.billableMinutes) {
    return `${sourceTimedLine.resource.name} - ${line.billableMinutes} min`;
  }

  return staffInvoiceLineLabel(line);
}

export function invoiceLineMeta(line: InvoiceLine): string {
  if (line.lineKind === "SERVICE") {
    return `${line.billableMinutes ?? 0} min`;
  }

  return `${line.quantity ?? 1} x ${formatPaise(line.unitPrice)}`;
}

export function elapsedLineLabel(line: TimedLine): string {
  if (line.status === "STOPPED" || line.status === "CLOSED") {
    return "Stopped";
  }

  const latestLiveEvent = [...(line.sessionEvents ?? [])]
    .reverse()
    .find(
      (event) =>
        event.eventType === "STARTED" || event.eventType === "RESUMED",
    );

  if (!latestLiveEvent) {
    return line.status === "PAUSED" ? "Paused" : "Just started";
  }

  const occurredAt = new Date(latestLiveEvent.occurredAt).getTime();
  if (!Number.isFinite(occurredAt)) {
    return line.status === "PAUSED" ? "Paused" : "Running";
  }

  const minutes = Math.max(0, Math.floor((Date.now() - occurredAt) / 60_000));

  if (line.status === "PAUSED") {
    return minutes <= 0 ? "Paused just now" : `Paused after ${minutes} min`;
  }

  return minutes <= 0 ? "Started just now" : `${minutes} min running`;
}

export function timedLineTiming(
  line: TimedLine,
  nowMs: number | null,
): TimedLineTiming {
  const events = (line.sessionEvents ?? [])
    .map((event) => ({
      eventType: event.eventType,
      occurredAtMs: Date.parse(event.occurredAt),
    }))
    .filter((event) => Number.isFinite(event.occurredAtMs))
    .sort((left, right) => left.occurredAtMs - right.occurredAtMs);

  let startAtMs: number | null = null;
  let stopAtMs: number | null = null;
  let activeSinceMs: number | null = null;
  let durationMs = 0;
  let canMeasureDuration = true;

  for (const event of events) {
    if (event.eventType === "STARTED" || event.eventType === "RESUMED") {
      startAtMs ??= event.occurredAtMs;
      activeSinceMs = event.occurredAtMs;
      stopAtMs = null;
      continue;
    }

    if (event.eventType === "PAUSED") {
      if (activeSinceMs !== null) {
        durationMs += Math.max(0, event.occurredAtMs - activeSinceMs);
        activeSinceMs = null;
      }
      continue;
    }

    if (event.eventType === "STOPPED" || event.eventType === "CLOSED") {
      if (activeSinceMs !== null) {
        durationMs += Math.max(0, event.occurredAtMs - activeSinceMs);
        activeSinceMs = null;
      }
      stopAtMs = event.occurredAtMs;
    }
  }

  if (activeSinceMs !== null) {
    if (nowMs === null) {
      canMeasureDuration = false;
    } else {
      durationMs += Math.max(0, nowMs - activeSinceMs);
    }
  }

  return {
    startAt: startAtMs === null ? null : new Date(startAtMs),
    stopAt: stopAtMs === null ? null : new Date(stopAtMs),
    durationMs:
      startAtMs === null || !canMeasureDuration
        ? null
        : Math.max(0, durationMs),
  };
}

export function formatSessionTime(value: Date | null): string {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

export function formatDuration(durationMs: number | null): string {
  if (durationMs === null) {
    return "--";
  }

  const totalMinutes = Math.floor(durationMs / 60_000);
  if (totalMinutes < 1) {
    return "Under 1 min";
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) {
    return `${totalMinutes} min`;
  }

  return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}
