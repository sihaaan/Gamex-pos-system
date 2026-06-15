"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/navigation";

export function MainNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex items-center gap-1 text-sm">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-2 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
              active
                ? "bg-nav-active text-nav-ink ring-1 ring-inset ring-nav-border"
                : "text-nav-ink-muted hover:bg-white/5 hover:text-nav-ink",
            )}
            href={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
