import { describe, expect, it } from "vitest";
import type { AuthContext } from "@/lib/auth/session";
import { AppError } from "@/lib/http";
import {
  actualElapsedMinutesFromEvents,
  buildHsnSacSummary,
  buildSalesReport,
  buildTenderSummary,
} from "@/lib/reports/aggregations";
import { buildCsv, formatCsvAmount } from "@/lib/reports/csv";
import { parseReportFilters } from "@/lib/reports/filters";

const owner: AuthContext = {
  sessionId: "session-owner",
  userId: "owner-1",
  legalEntityId: "entity-1",
  branchId: null,
  role: "OWNER",
  name: "Owner",
  email: "owner@example.com",
};

const manager: AuthContext = {
  sessionId: "session-manager",
  userId: "manager-1",
  legalEntityId: "entity-1",
  branchId: "branch-1",
  role: "MANAGER",
  name: "Manager",
  email: "manager@example.com",
};

const staff: AuthContext = {
  sessionId: "session-staff",
  userId: "staff-1",
  legalEntityId: "entity-1",
  branchId: "branch-1",
  role: "STAFF",
  name: "Staff",
  email: "staff@example.com",
};

describe("report filters and access", () => {
  it("blocks staff from report API filters", () => {
    expect(() =>
      parseReportFilters(reportRequest("/api/reports/sales"), staff),
    ).toThrow(AppError);
  });

  it("limits managers to their assigned branch", () => {
    expect(
      parseReportFilters(reportRequest("/api/reports/sales?branchId=branch-1"), manager)
        .branchId,
    ).toBe("branch-1");
    expect(() =>
      parseReportFilters(
        reportRequest("/api/reports/sales?branchId=branch-2"),
        manager,
      ),
    ).toThrow(AppError);
  });

  it("allows owners to view all branches or a selected branch", () => {
    expect(
      parseReportFilters(reportRequest("/api/reports/sales"), owner).branchId,
    ).toBeNull();
    expect(
      parseReportFilters(reportRequest("/api/reports/sales?branchId=branch-2"), owner)
        .branchId,
    ).toBe("branch-2");
  });
});

describe("report aggregation", () => {
  it("reduces net sales and GST for posted credit notes", () => {
    const report = buildSalesReport({
      invoices: [
        {
          id: "invoice-1",
          branchId: "branch-1",
          branchName: "Branch 1",
          branchCode: "B1",
          invoiceNumber: "INV1",
          postedAt: new Date("2026-06-11T10:00:00Z"),
          taxableValue: 10_000,
          cgstAmount: 900,
          sgstAmount: 900,
          igstAmount: 0,
          discountAmount: 500,
          totalAmount: 11_800,
        },
      ],
      creditNotes: [
        {
          branchId: "branch-1",
          branchName: "Branch 1",
          branchCode: "B1",
          status: "POSTED",
          postedAt: new Date("2026-06-11T11:00:00Z"),
          taxableValue: 1_000,
          cgstAmount: 90,
          sgstAmount: 90,
          igstAmount: 0,
          totalAmount: 1_180,
        },
      ],
    });

    expect(report.summary.grossSales).toBe(12_300);
    expect(report.summary.discounts).toBe(500);
    expect(report.summary.refunds).toBe(1_180);
    expect(report.summary.netSales).toBe(10_620);
    expect(report.summary.gstCollected).toBe(1_620);
  });

  it("matches tender totals and mixed tender invoice count", () => {
    const summary = buildTenderSummary([
      { tenderType: "CASH", amount: 5_000, gstInvoiceId: "invoice-1" },
      { tenderType: "UPI_PHONEPE", amount: 8_000, gstInvoiceId: "invoice-1" },
      { tenderType: "UPI_GOOGLE_PAY", amount: 4_000, gstInvoiceId: "invoice-2" },
    ]);

    expect(summary.totalsByTender.CASH).toBe(5_000);
    expect(summary.totalsByTender.UPI_PHONEPE).toBe(8_000);
    expect(summary.totalsByTender.UPI_GOOGLE_PAY).toBe(4_000);
    expect(summary.mixedTenderInvoiceCount).toBe(1);
  });

  it("aggregates HSN/SAC from invoice line snapshots", () => {
    const [summary] = buildHsnSacSummary([
      {
        hsnSac: "9996",
        description: "Pool table timed play",
        taxableValue: 4_237,
        cgstAmount: 381,
        sgstAmount: 382,
        igstAmount: 0,
        totalAmount: 5_000,
        billableMinutes: 10,
      },
      {
        hsnSac: "9996",
        description: "Pool table timed play",
        taxableValue: 4_237,
        cgstAmount: 382,
        sgstAmount: 381,
        igstAmount: 0,
        totalAmount: 5_000,
        billableMinutes: 10,
      },
    ]);

    expect(summary?.description).toBe("Pool play");
    expect(summary?.taxableValue).toBe(8_474);
    expect(summary?.cgstAmount).toBe(763);
    expect(summary?.sgstAmount).toBe(763);
    expect(summary?.totalAmount).toBe(10_000);
    expect(summary?.quantityOrMinutes).toBe(20);
  });

  it("uses server event history for actual elapsed minutes", () => {
    const elapsed = actualElapsedMinutesFromEvents([
      { eventType: "STARTED", occurredAt: new Date("2026-06-11T10:00:00Z") },
      { eventType: "PAUSED", occurredAt: new Date("2026-06-11T10:20:00Z") },
      { eventType: "RESUMED", occurredAt: new Date("2026-06-11T10:30:00Z") },
      { eventType: "STOPPED", occurredAt: new Date("2026-06-11T10:45:00Z") },
    ]);

    expect(elapsed).toBe(35);
  });
});

describe("report CSV", () => {
  it("formats CSV amounts with two decimals and escapes cells", () => {
    expect(formatCsvAmount(13_000)).toBe("130.00");
    expect(
      buildCsv(["Invoice", "Amount"], [["INV,001", formatCsvAmount(13_000)]]),
    ).toBe('Invoice,Amount\n"INV,001",130.00');
  });
});

function reportRequest(path: string): Request {
  return new Request(`http://localhost${path}`);
}
