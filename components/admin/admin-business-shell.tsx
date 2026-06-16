"use client";

import { Building2, FileText } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LegalEntity = {
  id: string;
  name: string;
  gstin: string;
  address: string;
  stateCode: string;
  updatedAt: string;
};

type BusinessDraft = {
  name: string;
  gstin: string;
  address: string;
  stateCode: string;
  reason: string;
};

const emptyDraft: BusinessDraft = {
  name: "",
  gstin: "",
  address: "",
  stateCode: "29",
  reason: "Update business profile",
};

export function AdminBusinessShell() {
  const [legalEntity, setLegalEntity] = useState<LegalEntity | null>(null);
  const [draft, setDraft] = useState<BusinessDraft>(emptyDraft);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const response = await fetch("/api/admin/legal-entity", {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(await responseMessage(response, "Unable to load business profile."));
    }

    const payload = (await response.json()) as { legalEntity: LegalEntity };
    setLegalEntity(payload.legalEntity);
    setDraft({
      name: payload.legalEntity.name,
      gstin: payload.legalEntity.gstin,
      address: payload.legalEntity.address,
      stateCode: payload.legalEntity.stateCode,
      reason: "Update business profile",
    });
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      load().catch((caught: unknown) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load business profile.",
        ),
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  async function save() {
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/legal-entity", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!response.ok) {
        throw new Error(await responseMessage(response, "Unable to save business profile."));
      }

      const payload = (await response.json()) as { legalEntity: LegalEntity };
      setLegalEntity(payload.legalEntity);
      setMessage("Business profile updated.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save business profile.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto grid max-w-5xl gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-success" />
            <h1 className="text-xl font-semibold tracking-normal">
              Business profile
            </h1>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Edit the legal entity details used on future GST invoices.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/admin">Back to admin</Link>
        </Button>
      </section>

      {message ? (
        <div className="rounded-md border border-success-line bg-success-soft p-3 text-sm font-medium text-success-ink">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-danger-line bg-danger-soft p-3 text-sm font-medium text-danger-ink">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-warning-line bg-warning-soft p-3 text-sm text-warning-ink">
          <FileText className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            These details apply to future invoices only. Already posted invoice
            snapshots stay unchanged.
          </p>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            Legal entity name
            <Input
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({ ...current, name: event.target.value }))
              }
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <label className="grid gap-1 text-xs font-medium text-ink-muted">
              GSTIN
              <Input
                maxLength={15}
                value={draft.gstin}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    gstin: event.target.value.toUpperCase(),
                  }))
                }
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-ink-muted">
              State code
              <Input
                inputMode="numeric"
                maxLength={2}
                value={draft.stateCode}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    stateCode: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            Registered address
            <Input
              value={draft.address}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  address: event.target.value,
                }))
              }
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button disabled={pending} onClick={save}>
              {pending ? "Saving" : "Save business profile"}
            </Button>
            {legalEntity ? (
              <p className="text-xs text-ink-muted">
                Last updated {new Date(legalEntity.updatedAt).toLocaleString("en-IN")}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

async function responseMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return payload?.error?.message ?? fallback;
}
