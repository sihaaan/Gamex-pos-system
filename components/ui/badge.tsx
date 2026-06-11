import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-strong text-ink-muted",
  success:
    "bg-success-soft text-success-ink ring-1 ring-inset ring-success-line/60",
  warning:
    "bg-warning-soft text-warning-ink ring-1 ring-inset ring-warning-line/60",
  danger:
    "bg-danger-soft text-danger-ink ring-1 ring-inset ring-danger-line/60",
  info: "bg-info-soft text-info-ink ring-1 ring-inset ring-info-line/60",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
