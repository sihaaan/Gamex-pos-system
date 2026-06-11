"use client";

import {
  AlertTriangle,
  ChevronDown,
  CirclePause,
  CirclePlay,
  Gamepad2,
  MoveRight,
  Square,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { staffInvoiceLineLabel, staffServiceName } from "@/lib/pos/display";
import { formatPaise } from "@/lib/utils";
import { ManagerOverrideDialog } from "./manager-override-dialog";
import {
  billHeaderLineLabel,
  elapsedLineLabel,
  formatDuration,
  formatSessionTime,
  isLiveTimedLine,
  resourceKindForTimedLine,
  statusLabel,
  timedLineBadgeTone,
  timedLineTiming,
} from "./timing";
import type { DiscountType } from "./types";
import type { PosController } from "./use-pos-controller";

export function CurrentBill({ controller }: { controller: PosController }) {
  const { selectedTab } = controller.derived;

  if (!selectedTab) {
    return (
      <p className="mt-3 text-sm text-ink-muted">
        Create or select a customer bill to start selling.
      </p>
    );
  }

  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col">
      <BillHeaderCard controller={controller} />
      <div className="mt-3 min-h-0 flex-1 pr-1">
        <div className="grid gap-3">
          <ActiveGames controller={controller} />
          <BillItems controller={controller} />
        </div>
      </div>
      <div className="mt-3 grid shrink-0 gap-2 border-t border-line pt-2">
        <DiscountSection controller={controller} />
      </div>
    </div>
  );
}

function BillHeaderCard({ controller }: { controller: PosController }) {
  const { state, derived } = controller;
  const { timedLines, activeTimedLines, currentBillLabel, timingNowMs } =
    derived;
  const quote = state.quote;

  return (
    <div className="rounded-xl border border-success-line bg-success-soft p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex min-w-0 items-center gap-2 text-base font-semibold text-success-ink">
              <UserRound className="h-4 w-4 shrink-0" />
              <span className="truncate">{currentBillLabel}</span>
            </p>
            <Badge tone="success">Selected bill</Badge>
          </div>
          <p className="mt-1 text-xs text-success">
            {activeTimedLines.length > 0
              ? "Stop running games before checkout."
              : "New games and snacks add here."}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-success">
            {state.quoteLoading ? "Calculating" : derived.billDueLabel}
          </p>
          <p className="text-2xl font-semibold tabular-nums text-success-ink">
            {quote ? formatPaise(quote.totalAmount) : "--"}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm font-medium text-success-ink">
        {derived.currentBillStats}
      </p>
      {timedLines.length > 0 ? (
        <div className="mt-2 grid gap-2 border-t border-success-line/60 pt-2">
          <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase text-success-ink">
            <span>Game timing</span>
            <span>
              {timedLines.length} game{timedLines.length === 1 ? "" : "s"}
            </span>
          </div>
          {timedLines.slice(0, 2).map((line) => {
            const lineTiming = timedLineTiming(line, timingNowMs);

            return (
              <div
                key={line.id}
                className="grid gap-1 rounded-md bg-surface/70 px-3 py-2 text-xs text-ink"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-semibold">
                    {line.resource?.name ??
                      staffServiceName(line.descriptionSnapshot)}
                  </span>
                  <Badge tone={timedLineBadgeTone(line.status)}>
                    {statusLabel(line.status)}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <TimingStat
                    label="Start"
                    value={formatSessionTime(lineTiming.startAt)}
                  />
                  <TimingStat
                    label="Stop"
                    value={formatSessionTime(lineTiming.stopAt)}
                  />
                  <TimingStat
                    label="Duration"
                    value={formatDuration(lineTiming.durationMs)}
                  />
                </div>
              </div>
            );
          })}
          {timedLines.length > 2 ? (
            <p className="text-xs font-medium text-success">
              +{timedLines.length - 2} more in bill details
            </p>
          ) : null}
        </div>
      ) : null}
      {quote?.lines.length ? (
        <div className="mt-2 grid gap-1 border-t border-success-line/60 pt-2">
          {quote.lines.slice(0, 3).map((line, index) => (
            <div
              key={line.id ?? line.sourceLineId ?? `${line.description}-${index}`}
              className="flex items-center justify-between gap-3 text-xs font-medium text-success-ink"
            >
              <span className="min-w-0 truncate">
                {billHeaderLineLabel(line, timedLines)}
              </span>
              <span className="shrink-0 tabular-nums">
                {formatPaise(line.totalAmount)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ActiveGames({ controller }: { controller: PosController }) {
  const { state, derived, actions } = controller;
  const { timedLines, activeTimedLines, branchResources, timingNowMs } =
    derived;

  if (activeTimedLines.length === 0 && timedLines.length > 0) {
    return null;
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Gamepad2 className="h-4 w-4 text-success" />
          Games
        </p>
        {activeTimedLines.length > 0 ? (
          <Badge tone="warning">{activeTimedLines.length} active</Badge>
        ) : (
          <Badge>No active games</Badge>
        )}
      </div>
      {activeTimedLines.map((line) => {
        const isMoving = state.movingTimedLineId === line.id;
        const lineTiming = timedLineTiming(line, timingNowMs);
        const hasGameControls =
          line.status === "RUNNING" || line.status === "PAUSED";
        const isStoppedLine = !hasGameControls;
        const isStoppedExpanded = state.expandedStoppedLineId === line.id;
        const quoteLine =
          state.quote?.lines.find(
            (invoiceLine) => invoiceLine.sourceLineId === line.id,
          ) ?? null;
        const moveTargetKind = resourceKindForTimedLine(line);
        const availableMoveTargets = branchResources.filter(
          (resource) =>
            resource.status === "AVAILABLE" &&
            (!moveTargetKind || resource.kind === moveTargetKind),
        );

        return (
          <div
            key={line.id}
            className="rounded-lg border border-line bg-surface p-3"
          >
            {isStoppedLine ? (
              <button
                className="grid w-full cursor-pointer gap-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                onClick={() =>
                  actions.dispatch({
                    type: "STOPPED_LINE_TOGGLED",
                    lineId: line.id,
                  })
                }
                type="button"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {line.resource?.name ??
                        staffServiceName(line.descriptionSnapshot)}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-muted">
                      {staffServiceName(line.descriptionSnapshot)}
                      {quoteLine?.billableMinutes
                        ? ` - ${quoteLine.billableMinutes} min`
                        : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {quoteLine ? (
                      <span className="text-sm font-semibold tabular-nums text-ink">
                        {formatPaise(quoteLine.totalAmount)}
                      </span>
                    ) : null}
                    <Badge tone={timedLineBadgeTone(line.status)}>
                      {statusLabel(line.status)}
                    </Badge>
                    <ChevronDown
                      className={`h-4 w-4 text-ink-subtle transition ${
                        isStoppedExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </span>
                </span>
              </button>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink">
                      {staffServiceName(line.descriptionSnapshot)}
                    </span>
                    <Badge tone={timedLineBadgeTone(line.status)}>
                      {statusLabel(line.status)}
                    </Badge>
                  </span>
                  <span className="mt-1 block text-xs text-ink-muted">
                    {line.resource?.name ?? "No resource"}
                    {" - "}
                    {elapsedLineLabel(line)}
                  </span>
                  {quoteLine ? (
                    <span className="mt-1 block truncate text-xs font-medium text-success">
                      Est. {formatPaise(quoteLine.totalAmount)}
                      {quoteLine.billableMinutes
                        ? ` - ${quoteLine.billableMinutes} min`
                        : ""}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  {line.status === "RUNNING" ? (
                    <Button
                      aria-label={`Pause ${line.descriptionSnapshot} on ${
                        line.resource?.name ?? "no resource"
                      }`}
                      className="min-h-11 px-3"
                      variant="secondary"
                      onClick={() => void actions.pauseTimedLine(line)}
                      disabled={state.actionPending}
                    >
                      <CirclePause className="h-4 w-4" />
                      Pause
                    </Button>
                  ) : null}
                  {line.status === "PAUSED" ? (
                    <Button
                      aria-label={`Resume ${line.descriptionSnapshot} on ${
                        line.resource?.name ?? "no resource"
                      }`}
                      className="min-h-11 px-3"
                      variant="secondary"
                      onClick={() => void actions.resumeTimedLine(line)}
                      disabled={state.actionPending}
                    >
                      <CirclePlay className="h-4 w-4" />
                      Resume
                    </Button>
                  ) : null}
                  <Button
                    aria-label={`Stop ${line.descriptionSnapshot} on ${
                      line.resource?.name ?? "no resource"
                    }`}
                    className={
                      state.stopConfirmLineId === line.id
                        ? "min-h-11 px-3"
                        : "min-h-11 border-danger-line px-3 text-danger hover:bg-danger-soft"
                    }
                    variant={
                      state.stopConfirmLineId === line.id
                        ? "danger"
                        : "secondary"
                    }
                    onClick={() => void actions.stopTimedLine(line)}
                    disabled={state.actionPending}
                  >
                    <Square className="h-4 w-4" />
                    {state.stopConfirmLineId === line.id
                      ? "Confirm stop"
                      : "Stop"}
                  </Button>
                  {line.status === "RUNNING" ? (
                    <Button
                      aria-label={`Move game from ${
                        line.resource?.name ?? "no resource"
                      }`}
                      className="min-h-11 px-3"
                      variant="ghost"
                      onClick={() =>
                        actions.dispatch({
                          type: "MOVE_TARGET_TOGGLED",
                          lineId: line.id,
                        })
                      }
                      disabled={state.actionPending}
                    >
                      <MoveRight className="h-4 w-4" />
                      Move game
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
            {!isStoppedLine || isStoppedExpanded ? (
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-md bg-surface-muted p-2">
                <TimingStat
                  label="Start"
                  value={formatSessionTime(lineTiming.startAt)}
                />
                <TimingStat
                  label="Stop"
                  value={formatSessionTime(lineTiming.stopAt)}
                />
                <TimingStat
                  label="Duration"
                  value={formatDuration(lineTiming.durationMs)}
                />
              </div>
            ) : null}
            {isMoving ? (
              <div className="mt-3 rounded-md bg-surface-muted p-3">
                <p className="mb-2 text-xs font-medium text-ink-muted">
                  Move this game to:
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {availableMoveTargets.map((resource) => (
                    <Button
                      key={resource.id}
                      variant="secondary"
                      onClick={() =>
                        void actions.moveTimedSession(line, resource.id)
                      }
                      disabled={state.actionPending}
                    >
                      <MoveRight className="h-4 w-4" />
                      {resource.name}
                    </Button>
                  ))}
                </div>
                {availableMoveTargets.length === 0 ? (
                  <p className="text-sm text-ink-muted">
                    No available resources to move into.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
      {timedLines.length === 0 ? (
        <p className="rounded-md bg-surface-muted px-3 py-2 text-sm text-ink-muted">
          No games on this bill.
        </p>
      ) : null}
    </div>
  );
}

function BillItems({ controller }: { controller: PosController }) {
  const { state, derived, actions } = controller;
  const { timedLines, timingNowMs } = derived;
  const quote = state.quote;

  if (!quote) {
    return (
      <div className="rounded-md bg-surface-muted p-3 text-sm text-ink-muted">
        {state.quoteLoading ? "Calculating bill..." : "Select a bill to see items."}
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-lg bg-surface-muted p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">Items on bill</p>
        <Badge>
          {quote.lines.length} line{quote.lines.length === 1 ? "" : "s"}
        </Badge>
      </div>
      <div className="grid gap-1.5">
        {quote.lines.map((line, index) => {
          const sourceTimedLine = line.sourceLineId
            ? (timedLines.find(
                (timedLine) => timedLine.id === line.sourceLineId,
              ) ?? null)
            : null;
          const sourceTiming = sourceTimedLine
            ? timedLineTiming(sourceTimedLine, timingNowMs)
            : null;
          const sourceExpanded = sourceTimedLine
            ? state.expandedStoppedLineId === sourceTimedLine.id
            : false;
          const lineLabel =
            sourceTimedLine?.resource?.name && line.billableMinutes
              ? `${sourceTimedLine.resource.name} - ${line.billableMinutes} min`
              : staffInvoiceLineLabel(line);

          return (
            <div
              key={line.id ?? line.sourceLineId ?? `${line.description}-${index}`}
              className="rounded-md bg-surface px-3 py-2 text-sm"
            >
              {sourceTimedLine && !isLiveTimedLine(sourceTimedLine) ? (
                <>
                  <button
                    className="flex w-full cursor-pointer items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    onClick={() =>
                      actions.dispatch({
                        type: "STOPPED_LINE_TOGGLED",
                        lineId: sourceTimedLine.id,
                      })
                    }
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">
                        {lineLabel}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-muted">
                        {staffServiceName(sourceTimedLine.descriptionSnapshot)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-semibold tabular-nums text-ink">
                        {formatPaise(line.totalAmount)}
                      </span>
                      <Badge tone={timedLineBadgeTone(sourceTimedLine.status)}>
                        {statusLabel(sourceTimedLine.status)}
                      </Badge>
                      <ChevronDown
                        className={`h-4 w-4 text-ink-subtle transition ${
                          sourceExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </span>
                  </button>
                  {sourceTiming ? (
                    <div className="mt-2 grid grid-cols-3 gap-2 rounded-md bg-surface-muted p-2">
                      <TimingStat
                        label="Start"
                        value={formatSessionTime(sourceTiming.startAt)}
                      />
                      <TimingStat
                        label="Stop"
                        value={formatSessionTime(sourceTiming.stopAt)}
                      />
                      <TimingStat
                        label="Duration"
                        value={formatDuration(sourceTiming.durationMs)}
                      />
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-ink">{lineLabel}</span>
                  <span className="shrink-0 font-medium tabular-nums text-ink">
                    {formatPaise(line.totalAmount)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-md border border-line bg-surface p-2">
        <button
          className="flex min-h-10 w-full cursor-pointer items-center gap-2 text-left"
          onClick={() => actions.dispatch({ type: "BILL_DETAILS_TOGGLED" })}
          type="button"
        >
          <span className="text-sm font-semibold text-ink">Bill details</span>
          <ChevronDown
            className={`h-4 w-4 text-ink-subtle transition ${
              state.billDetailsOpen ? "rotate-180" : ""
            }`}
          />
        </button>
        {quote.discountAmount > 0 ? (
          <div className="flex items-center justify-between gap-3 border-t border-line pt-2 text-sm">
            <span className="text-ink-muted">Discount</span>
            <span className="font-medium tabular-nums text-success">
              -{formatPaise(quote.discountAmount)}
            </span>
          </div>
        ) : null}
        {state.billDetailsOpen ? (
          <div className="mt-2 grid gap-1.5 border-t border-line pt-2 text-sm">
            <BreakdownRow label="Gross amount" value={quote.grossAmount} />
            <BreakdownRow
              label="Discount"
              value={quote.discountAmount}
              tone="discount"
            />
            <BreakdownRow label="Taxable value" value={quote.taxableValue} />
            <BreakdownRow
              label="GST"
              value={quote.cgstAmount + quote.sgstAmount + quote.igstAmount}
            />
            <BreakdownRow label="Amount due" value={quote.totalAmount} strong />
          </div>
        ) : null}
      </div>

      {quote.hasActiveTimedLines ? (
        <div className="flex items-center gap-2 rounded-md border border-warning-line bg-warning-soft px-3 py-2 text-sm font-semibold text-warning-ink">
          <AlertTriangle className="h-4 w-4" />
          Stop running games before checkout.
        </div>
      ) : null}
    </div>
  );
}

function DiscountSection({ controller }: { controller: PosController }) {
  const { state, derived, actions } = controller;
  const {
    discountSummary,
    automaticDiscountSummary,
    totalDiscountSummary,
    discountLimitPercent,
    requestedDiscountAmount,
    discountReasonMissing,
  } = derived;

  return (
    <div className="grid gap-2 rounded-lg border border-line bg-surface px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink">
            {totalDiscountSummary
              ? `Discount -${totalDiscountSummary}`
              : "No discount"}
          </p>
          {automaticDiscountSummary ? (
            <p className="text-xs text-success">
              Automatic -{automaticDiscountSummary}
            </p>
          ) : null}
          {discountSummary ? (
            <p className="text-xs text-ink-muted">
              Manual -{discountSummary} -{" "}
              {state.discount.reason.trim() ||
                "Reason required before checkout"}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {discountSummary ? (
            <Button
              className="px-3"
              disabled={state.actionPending}
              onClick={() => actions.dispatch({ type: "DISCOUNT_REMOVED" })}
              variant="ghost"
            >
              Remove
            </Button>
          ) : null}
          <Button
            variant="secondary"
            onClick={() => actions.dispatch({ type: "DISCOUNT_TOGGLED" })}
            disabled={!state.quote || state.actionPending}
          >
            {state.discount.open
              ? "Done"
              : discountSummary
                ? "Edit"
                : "Add discount"}
          </Button>
        </div>
      </div>
      {state.discount.open ? (
        <div className="grid gap-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
            <label className="grid gap-1 text-xs font-medium text-ink-muted">
              Discount type
              <Select
                className="min-h-11"
                disabled={state.actionPending}
                value={state.discount.type}
                onChange={(event) =>
                  actions.dispatch({
                    type: "DISCOUNT_CHANGED",
                    patch: { type: event.target.value as DiscountType },
                  })
                }
              >
                <option value="AMOUNT">Amount</option>
                <option value="PERCENT">Percent</option>
              </Select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-ink-muted">
              Value
              <Input
                className="min-h-11"
                disabled={state.actionPending}
                inputMode="decimal"
                placeholder={state.discount.type === "AMOUNT" ? "50" : "10"}
                value={state.discount.value}
                onChange={(event) =>
                  actions.dispatch({
                    type: "DISCOUNT_CHANGED",
                    patch: { value: event.target.value },
                  })
                }
              />
            </label>
          </div>
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            Discount reason
            <Input
              disabled={state.actionPending}
              placeholder="Reason for discount"
              value={state.discount.reason}
              onChange={(event) =>
                actions.dispatch({
                  type: "DISCOUNT_CHANGED",
                  patch: { reason: event.target.value },
                })
              }
            />
          </label>
          <div className="grid grid-cols-2 gap-2 rounded-md bg-surface-muted p-3 text-sm">
            <span className="text-ink-muted">Discount</span>
            <span className="text-right font-semibold tabular-nums text-ink">
              {formatPaise(requestedDiscountAmount)}
            </span>
            <span className="text-ink-muted">Staff limit</span>
            <span className="text-right font-semibold text-ink">
              {discountLimitPercent}%
            </span>
          </div>
          {discountReasonMissing ? (
            <p className="text-xs font-medium text-warning-ink">
              Enter a discount reason before checkout.
            </p>
          ) : null}
          <ManagerOverrideDialog controller={controller} />
        </div>
      ) : null}
    </div>
  );
}

function TimingStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase text-ink-subtle">
        {label}
      </p>
      <p className="truncate text-xs font-semibold tabular-nums text-ink">
        {value}
      </p>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  strong = false,
  tone,
}: {
  label: string;
  value: number;
  strong?: boolean;
  tone?: "discount";
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 ${
        strong ? "border-t border-line pt-2 text-base font-semibold" : ""
      }`}
    >
      <span className="text-ink-muted">{label}</span>
      <span
        className={`tabular-nums ${strong ? "font-semibold text-ink" : "font-medium text-ink"}`}
      >
        {tone === "discount" && value > 0 ? "-" : ""}
        {formatPaise(value)}
      </span>
    </div>
  );
}
