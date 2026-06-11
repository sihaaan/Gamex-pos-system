import { NextResponse } from "next/server";

export type CsvValue = string | number | null | undefined;

export function formatCsvAmount(amount: number): string {
  return (amount / 100).toFixed(2);
}

export function buildCsv(
  headers: readonly string[],
  rows: readonly (readonly CsvValue[])[],
): string {
  return [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ].join("\n");
}

export function csvResponse(filename: string, csv: string): NextResponse {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function escapeCsvCell(value: CsvValue): string {
  const raw = value == null ? "" : String(value);
  if (!/[",\n\r]/.test(raw)) {
    return raw;
  }
  return `"${raw.replaceAll('"', '""')}"`;
}
