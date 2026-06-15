import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "min-h-10 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/25 disabled:cursor-not-allowed disabled:bg-surface-strong",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
