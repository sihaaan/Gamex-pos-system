import type { UserRole } from "@/lib/generated/prisma/enums";

export type NavItem = {
  href: string;
  label: string;
};

const staffNavItems: NavItem[] = [{ href: "/pos", label: "POS" }];

const managerNavItems: NavItem[] = [
  { href: "/pos", label: "POS" },
  { href: "/reports", label: "Reports" },
  { href: "/admin", label: "Admin" },
];

export function visibleNavItems(role: UserRole | null | undefined): NavItem[] {
  if (role === "MANAGER" || role === "OWNER") {
    return managerNavItems;
  }

  return staffNavItems;
}
