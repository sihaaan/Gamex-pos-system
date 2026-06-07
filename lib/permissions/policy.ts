import { AppError } from "@/lib/http";
import type { UserRole } from "@/lib/generated/prisma/enums";

export type Permission =
  | "shift:open"
  | "shift:close"
  | "shift:reopen"
  | "tab:write"
  | "tab:checkout"
  | "tab:void"
  | "refund:create"
  | "catalog:write"
  | "stock:adjust"
  | "reports:read";

const rolePermissions: Record<UserRole, ReadonlySet<Permission>> = {
  STAFF: new Set(["shift:open", "shift:close", "tab:write", "tab:checkout"]),
  MANAGER: new Set([
    "shift:open",
    "shift:close",
    "shift:reopen",
    "tab:write",
    "tab:checkout",
    "tab:void",
    "refund:create",
    "catalog:write",
    "stock:adjust",
    "reports:read",
  ]),
  OWNER: new Set([
    "shift:open",
    "shift:close",
    "shift:reopen",
    "tab:write",
    "tab:checkout",
    "tab:void",
    "refund:create",
    "catalog:write",
    "stock:adjust",
    "reports:read",
  ]),
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role].has(permission);
}

export function requirePermission(role: UserRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Your role does not allow this action.",
    );
  }
}

export function isManagerOrOwner(role: UserRole): boolean {
  return role === "MANAGER" || role === "OWNER";
}

export const sensitiveActions = [
  "VOID_TAB",
  "VOID_INVOICE",
  "HIGH_DISCOUNT",
  "PRICE_OVERRIDE",
  "RETROACTIVE_SESSION_EDIT",
  "REFUND",
  "CREDIT_NOTE",
  "STOCK_ADJUSTMENT",
  "REOPEN_CLOSED_TAB",
  "REOPEN_OR_ADJUST_SHIFT",
  "CHANGE_TAX_PRICING_CONFIG",
] as const;

export type SensitiveActionName = (typeof sensitiveActions)[number];

export function requireManagerOverride(
  role: UserRole,
  action: SensitiveActionName,
): void {
  if (!isManagerOrOwner(role)) {
    throw new AppError(
      403,
      "MANAGER_OVERRIDE_REQUIRED",
      `${action} requires manager or owner permission.`,
    );
  }
}
