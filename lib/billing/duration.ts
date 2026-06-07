export type ServiceEventType =
  | "STARTED"
  | "PAUSED"
  | "RESUMED"
  | "STOPPED"
  | "TRANSFERRED"
  | "CLOSED"
  | "MANUAL_ADJUSTED";

export type BillableSessionEvent = {
  eventType: ServiceEventType;
  occurredAt: Date;
  metadata?: {
    billableSecondsDelta?: number;
    billableMinutesDelta?: number;
    fromResourceId?: string;
    toResourceId?: string;
  };
};

export type BillableDuration = {
  billableSeconds: number;
  billableMinutes: number;
  manualAdjustmentSeconds: number;
};

export function calculateBillableDuration(
  inputEvents: readonly BillableSessionEvent[],
  now?: Date,
): BillableDuration {
  const events = [...inputEvents].sort(
    (left, right) => left.occurredAt.getTime() - right.occurredAt.getTime(),
  );

  let runningSince: Date | null = null;
  let billableSeconds = 0;
  let manualAdjustmentSeconds = 0;

  for (const event of events) {
    switch (event.eventType) {
      case "STARTED":
      case "RESUMED": {
        if (!runningSince) {
          runningSince = event.occurredAt;
        }
        break;
      }
      case "PAUSED":
      case "STOPPED":
      case "CLOSED": {
        if (runningSince) {
          billableSeconds += secondsBetween(runningSince, event.occurredAt);
          runningSince = null;
        }
        break;
      }
      case "TRANSFERRED": {
        break;
      }
      case "MANUAL_ADJUSTED": {
        const secondsDelta =
          event.metadata?.billableSecondsDelta ??
          (event.metadata?.billableMinutesDelta ?? 0) * 60;
        manualAdjustmentSeconds += secondsDelta;
        break;
      }
    }
  }

  if (runningSince && now) {
    billableSeconds += secondsBetween(runningSince, now);
  }

  const adjustedSeconds = Math.max(0, billableSeconds + manualAdjustmentSeconds);

  return {
    billableSeconds: adjustedSeconds,
    billableMinutes: Math.ceil(adjustedSeconds / 60),
    manualAdjustmentSeconds,
  };
}

function secondsBetween(start: Date, end: Date): number {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
}
