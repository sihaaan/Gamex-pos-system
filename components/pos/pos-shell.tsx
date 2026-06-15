"use client";

import { Wallet } from "lucide-react";
import { CurrentBill } from "./current-bill";
import { PaymentPanel } from "./payment-panel";
import { PosHeader } from "./pos-header";
import {
  ConnectionErrorBanner,
  MessageBanner,
  PostedInvoiceCard,
  ShiftClosedBanner,
  ShiftSummaryCard,
} from "./pos-notices";
import { SessionControls, StartPromptDialog } from "./session-controls";
import { ProductQuickAdd, TabsList } from "./tabs-list";
import { usePosController } from "./use-pos-controller";

export function PosShell() {
  const controller = usePosController();

  return (
    <main className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <PosHeader controller={controller} />
      <ConnectionErrorBanner controller={controller} />
      <ShiftClosedBanner controller={controller} />
      <MessageBanner controller={controller} />
      <StartPromptDialog controller={controller} />
      <PostedInvoiceCard controller={controller} />
      <ShiftSummaryCard controller={controller} />

      <section className="grid min-h-0 gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(390px,0.95fr)] lg:items-start">
        <div className="grid min-h-0 gap-5">
          <SessionControls controller={controller} />
          <ProductQuickAdd controller={controller} />
          <TabsList controller={controller} />
        </div>

        <aside className="min-h-0 lg:sticky lg:top-20">
          <div className="flex min-h-0 flex-col rounded-2xl border border-line bg-surface p-4 shadow-card">
            <div className="flex items-center gap-2.5">
              <span className="brand-gradient grid h-8 w-8 place-items-center rounded-lg text-white shadow-sm">
                <Wallet className="h-4 w-4" />
              </span>
              <h2 className="text-lg font-bold tracking-tight text-ink">
                Current bill
              </h2>
            </div>
            <CurrentBill controller={controller} />
            <div className="mt-2">
              <PaymentPanel controller={controller} />
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
