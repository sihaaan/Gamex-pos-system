import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-strong text-ink-muted ring-1 ring-inset ring-line",
  brand: "bg-brand-soft text-brand-strong ring-1 ring-inset ring-brand/25",
  success:
    "bg-success-soft text-success-ink ring-1 ring-inset ring-success-line/60",
  warning:
    "bg-warning-soft text-warning-ink ring-1 ring-inset ring-warning-line/60",
  danger:
    "bg-danger-soft text-danger-ink ring-1 ring-inset ring-danger-line/60",
  info: "bg-info-soft text-info-ink ring-1 ring-inset ring-info-line/60",
};

const dots: Record<BadgeTone, string> = {
  neutral: "bg-ink-faint",
  brand: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

export function Badge({
  children,
  tone = "neutral",
  dot = false,
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        tones[tone],
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden
          className={cn("h-1.5 w-1.5 rounded-full", dots[tone])}
        />
      ) : null}
      {children}
    </span>
  );
}
