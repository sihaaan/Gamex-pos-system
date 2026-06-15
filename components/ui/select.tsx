import * as React from "react";
import { cn } from "@/lib/utils";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "min-h-10 w-full cursor-pointer rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25 disabled:cursor-not-allowed disabled:bg-surface-strong",
        className,
      )}
      {...props}
    />
  ),
);

Select.displayName = "Select";
