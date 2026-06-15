import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface p-5 shadow-card",
        className,
      )}
      {...props}
    />
  );
}

export function FieldLabel({
  className,
  ...props
}: HTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("grid gap-1 text-xs font-medium text-ink-muted", className)}
      {...props}
    />
  );
}
