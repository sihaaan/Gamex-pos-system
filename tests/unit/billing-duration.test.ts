import { describe, expect, it } from "vitest";
import { calculateBillableDuration } from "@/lib/billing/duration";

describe("calculateBillableDuration", () => {
  it("uses server-confirmed events and excludes paused time", () => {
    const duration = calculateBillableDuration([
      { eventType: "STARTED", occurredAt: new Date("2026-06-07T10:00:00Z") },
      { eventType: "PAUSED", occurredAt: new Date("2026-06-07T10:20:00Z") },
      { eventType: "RESUMED", occurredAt: new Date("2026-06-07T10:35:00Z") },
      { eventType: "STOPPED", occurredAt: new Date("2026-06-07T10:50:00Z") },
    ]);

    expect(duration.billableMinutes).toBe(35);
  });

  it("applies manager manual adjustment events", () => {
    const duration = calculateBillableDuration([
      { eventType: "STARTED", occurredAt: new Date("2026-06-07T10:00:00Z") },
      { eventType: "STOPPED", occurredAt: new Date("2026-06-07T10:30:00Z") },
      {
        eventType: "MANUAL_ADJUSTED",
        occurredAt: new Date("2026-06-07T10:31:00Z"),
        metadata: { billableMinutesDelta: -5 },
      },
    ]);

    expect(duration.billableMinutes).toBe(25);
  });
});
