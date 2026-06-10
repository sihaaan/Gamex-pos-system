"use client";

import { IndianRupee, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TaxKind = "HSN" | "SAC";

type TaxRateRow = {
  id: string;
  code: string;
  kind: TaxKind;
  description: string;
  gstRate: string;
  effectiveFrom: string;
  effectiveTo: string | null;
};

type TaxRateDraft = {
  code: string;
  kind: TaxKind;
  description: string;
  gstRate: string;
  effectiveFrom: string;
  effectiveTo: string;
  reason: string;
};

const emptyDraft: TaxRateDraft = {
  code: "",
  kind: "HSN",
  description: "",
  gstRate: "18",
  effectiveFrom: todayInputValue(),
  effectiveTo: "",
  reason: "Configure GST rate",
};

export function AdminGstRatesShell() {
  const [taxRates, setTaxRates] = useState<TaxRateRow[]>([]);
  const [draft, setDraft] = useState<TaxRateDraft>(emptyDraft);
  const [selectedTaxRateId, setSelectedTaxRateId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "ENDED">("ACTIVE");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selectedTaxRate = useMemo(
    () => taxRates.find((taxRate) => taxRate.id === selectedTaxRateId) ?? null,
    [selectedTaxRateId, taxRates],
  );

  const filteredTaxRates = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return taxRates.filter((taxRate) => {
      const active = !taxRate.effectiveTo || new Date(taxRate.effectiveTo) >= new Date();
      const statusMatch =
        filter === "ALL" ||
        (filter === "ACTIVE" && active) ||
        (filter === "ENDED" && !active);
      const searchMatch =
        !normalizedSearch ||
        taxRate.code.toLowerCase().includes(normalizedSearch) ||
        taxRate.description.toLowerCase().includes(normalizedSearch);
      return statusMatch && searchMatch;
    });
  }, [filter, search, taxRates]);

  const load = useCallback(async () => {
    setError(null);
    const response = await fetch("/api/admin/gst-rates", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Unable to load GST rates.");
    }
    const payload = (await response.json()) as { taxRates: TaxRateRow[] };
    setTaxRates(payload.taxRates);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      load().catch((caught: unknown) =>
        setError(
          caught instanceof Error ? caught.message : "Unable to load GST rates.",
        ),
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  function startCreate() {
    setSelectedTaxRateId(null);
    setMessage(null);
    setDraft(emptyDraft);
  }

  function startEdit(taxRate: TaxRateRow) {
    setSelectedTaxRateId(taxRate.id);
    setMessage(null);
    setDraft({
      code: taxRate.code,
      kind: taxRate.kind,
      description: taxRate.description,
      gstRate: String(Number(taxRate.gstRate)),
      effectiveFrom: isoToDateInput(taxRate.effectiveFrom),
      effectiveTo: taxRate.effectiveTo ? isoToDateInput(taxRate.effectiveTo) : "",
      reason: `Update ${taxRate.kind} ${taxRate.code}`,
    });
  }

  async function saveTaxRate() {
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const editing = Boolean(selectedTaxRateId);
      const response = await fetch(
        editing
          ? `/api/admin/gst-rates/${selectedTaxRateId}`
          : "/api/admin/gst-rates",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editing
              ? {
                  description: draft.description,
                  effectiveTo: draft.effectiveTo
                    ? dateInputToIso(draft.effectiveTo)
                    : null,
                  reason: draft.reason,
                }
              : {
                  code: draft.code,
                  kind: draft.kind,
                  description: draft.description,
                  gstRate: Number(draft.gstRate),
                  effectiveFrom: dateInputToIso(draft.effectiveFrom),
                  effectiveTo: draft.effectiveTo
                    ? dateInputToIso(draft.effectiveTo)
                    : undefined,
                  reason: draft.reason,
                },
          ),
        },
      );
      if (!response.ok) {
        throw new Error(await responseMessage(response, "Unable to save GST rate."));
      }
      await load();
      setMessage(editing ? "GST rate updated." : "GST rate created.");
      if (!editing) {
        setSelectedTaxRateId(null);
        setDraft(emptyDraft);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save GST rate.");
    } finally {
      setPending(false);
    }
  }

  function endToday() {
    setDraft((current) => ({
      ...current,
      effectiveTo: todayInputValue(),
      reason: current.reason || "End GST rate",
    }));
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <div>
          <div className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-emerald-700" />
            <h1 className="text-xl font-semibold tracking-normal">GST rates</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-600">
            Manage HSN/SAC rates with effective dates for future billing.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/admin">Back to admin</Link>
        </Button>
      </section>

      <StatusMessages error={error} message={message} />

      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.9fr]">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Tax rate catalog</h2>
            <Button onClick={startCreate} variant="secondary">
              <Plus className="h-4 w-4" />
              New GST rate
            </Button>
          </div>
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Search
              <Input
                placeholder="HSN 2106, SAC 9996"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Status
              <select
                className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950"
                value={filter}
                onChange={(event) =>
                  setFilter(event.target.value as "ALL" | "ACTIVE" | "ENDED")
                }
              >
                <option value="ACTIVE">Active</option>
                <option value="ENDED">Ended</option>
                <option value="ALL">All</option>
              </select>
            </label>
          </div>
          <div className="grid gap-2">
            {filteredTaxRates.map((taxRate) => {
              const active =
                !taxRate.effectiveTo || new Date(taxRate.effectiveTo) >= new Date();
              return (
                <button
                  key={taxRate.id}
                  className={cn(
                    "grid gap-2 rounded-md border p-3 text-left text-sm transition hover:bg-zinc-50",
                    selectedTaxRateId === taxRate.id
                      ? "border-emerald-600 bg-emerald-50"
                      : "border-zinc-200 bg-white",
                  )}
                  onClick={() => startEdit(taxRate)}
                  type="button"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {taxRate.kind} {taxRate.code}
                      </p>
                      <p className="text-xs text-zinc-600">{taxRate.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{taxRate.gstRate}% GST</Badge>
                      <Badge tone={active ? "success" : "warning"}>
                        {active ? "Active" : "Ended"}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-600">
                    From {formatDate(taxRate.effectiveFrom)}
                    {taxRate.effectiveTo
                      ? ` to ${formatDate(taxRate.effectiveTo)}`
                      : ""}
                  </p>
                </button>
              );
            })}
            {filteredTaxRates.length === 0 ? (
              <p className="rounded-md border border-zinc-200 p-4 text-sm text-zinc-600">
                No GST rates found.
              </p>
            ) : null}
          </div>
        </div>

        <aside className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <Pencil className="h-4 w-4 text-emerald-700" />
            <h2 className="text-base font-semibold">
              {selectedTaxRate ? "Edit GST rate" : "Create GST rate"}
            </h2>
          </div>
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-medium text-zinc-600">
                Code
                <Input
                  disabled={Boolean(selectedTaxRate)}
                  value={draft.code}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      code: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-zinc-600">
                Kind
                <select
                  className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 disabled:bg-zinc-100"
                  disabled={Boolean(selectedTaxRate)}
                  value={draft.kind}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      kind: event.target.value as TaxKind,
                    }))
                  }
                >
                  <option value="HSN">HSN</option>
                  <option value="SAC">SAC</option>
                </select>
              </label>
            </div>
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Description
              <Input
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-medium text-zinc-600">
                GST %
                <Input
                  disabled={Boolean(selectedTaxRate)}
                  inputMode="decimal"
                  value={draft.gstRate}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      gstRate: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-zinc-600">
                Effective from
                <Input
                  disabled={Boolean(selectedTaxRate)}
                  type="date"
                  value={draft.effectiveFrom}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      effectiveFrom: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            {selectedTaxRate ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                Create a new GST rate for percentage or code changes. Existing rates can be renamed or end-dated.
              </p>
            ) : null}
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Effective to
              <Input
                type="date"
                value={draft.effectiveTo}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    effectiveTo: event.target.value,
                  }))
                }
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Audit reason
              <Input
                value={draft.reason}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
              />
            </label>
            {selectedTaxRate ? (
              <Button onClick={endToday} variant="secondary">
                Set end date to today
              </Button>
            ) : null}
            <Button disabled={pending} onClick={saveTaxRate}>
              {selectedTaxRate ? "Save GST rate" : "Create GST rate"}
            </Button>
          </div>
        </aside>
      </section>
    </main>
  );
}

function StatusMessages({
  error,
  message,
}: {
  error: string | null;
  message: string | null;
}) {
  return (
    <>
      {message ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-900">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-900">
          {error}
        </div>
      ) : null}
    </>
  );
}

async function responseMessage(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return payload?.error?.message ?? fallback;
}

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateInputToIso(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function isoToDateInput(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
    new Date(value),
  );
}
