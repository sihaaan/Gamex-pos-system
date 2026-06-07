import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-emerald-700 text-white hover:bg-emerald-800 focus-visible:ring-emerald-700",
  secondary:
    "border border-zinc-300 bg-white text-zinc-950 hover:bg-zinc-100 focus-visible:ring-zinc-500",
  danger:
    "bg-red-700 text-white hover:bg-red-800 focus-visible:ring-red-700",
  ghost:
    "bg-transparent text-zinc-700 hover:bg-zinc-100 focus-visible:ring-zinc-500",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: ButtonVariant;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild, variant = "primary", className, type = "button", ...props }, ref) => {
    const Component = asChild ? Slot : "button";
    return (
      <Component
        ref={ref}
        type={asChild ? undefined : type}
        className={cn(
          "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
