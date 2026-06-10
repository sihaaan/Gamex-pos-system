import type { UserRole } from "@/lib/generated/prisma/enums";
import { AppError } from "@/lib/http";

export type AdminActor = {
  userId: string;
  legalEntityId: string;
  branchId: string | null;
  role: UserRole;
};

export type ManagedUserSummary = {
  id: string;
  legalEntityId: string;
  branchId: string | null;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  passwordHash?: string;
  mfaSecretEnvelope?: string | null;
};

export type ManagedBranchSummary = {
  id: string;
  legalEntityId: string;
  isActive: boolean;
};

export type BranchScopedAdminRecord = {
  id: string;
  legalEntityId: string;
  branchId: string | null;
};

export type AdminAssignableBranch = {
  id: string;
  legalEntityId: string;
  isActive: boolean;
};

export type ResourceAvailabilitySummary = {
  isActive: boolean;
  status: "AVAILABLE" | "OCCUPIED" | "PAUSED" | "MAINTENANCE";
};

export type PosProductVisibilitySummary = {
  isActive: boolean;
  branchId: string | null;
};

export type PosResourceVisibilitySummary = {
  isActive: boolean;
  branchId: string;
};

export const adminCatalogAuditActions = [
  "ADMIN_RESOURCE_CREATED",
  "ADMIN_RESOURCE_EDITED",
  "ADMIN_RESOURCE_DEACTIVATED",
  "ADMIN_RESOURCE_REACTIVATED",
  "ADMIN_PRODUCT_CREATED",
  "ADMIN_PRODUCT_EDITED",
  "ADMIN_PRODUCT_DEACTIVATED",
  "ADMIN_PRODUCT_REACTIVATED",
  "ADMIN_STOCK_ADJUSTED",
  "ADMIN_SERVICE_CREATED",
  "ADMIN_SERVICE_EDITED",
  "ADMIN_GST_RATE_CREATED",
  "ADMIN_GST_RATE_EDITED",
] as const;

export function requireAdminActor(actor: Pick<AdminActor, "role">): void {
  if (actor.role === "STAFF") {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Staff accounts cannot access admin management.",
    );
  }
}

export function assertCanCreateUserRole(
  actor: Pick<AdminActor, "role">,
  targetRole: UserRole,
): void {
  requireAdminActor(actor);
  if (actor.role === "MANAGER" && targetRole !== "STAFF") {
    throw new AppError(
      403,
      "ROLE_NOT_ALLOWED",
      "Managers can create staff accounts only.",
    );
  }
}

export function assertCanManageUser(
  actor: AdminActor,
  target: Pick<
    ManagedUserSummary,
    "id" | "legalEntityId" | "branchId" | "role"
  > | null,
): asserts target is Pick<
  ManagedUserSummary,
  "id" | "legalEntityId" | "branchId" | "role"
> {
  requireAdminActor(actor);
  if (!target || target.legalEntityId !== actor.legalEntityId) {
    throw new AppError(404, "NOT_FOUND", "User was not found.");
  }

  if (actor.role === "OWNER") {
    return;
  }

  if (target.role !== "STAFF") {
    throw new AppError(
      403,
      "ROLE_NOT_ALLOWED",
      "Managers can manage staff accounts only.",
    );
  }

  if (!actor.branchId || target.branchId !== actor.branchId) {
    throw new AppError(
      403,
      "BRANCH_SCOPE_REQUIRED",
      "Managers can manage users in their assigned branch only.",
    );
  }
}

export function assertCanAssignUserBranch(
  actor: AdminActor,
  targetRole: UserRole,
  branch: { id: string; legalEntityId: string; isActive: boolean } | null,
  requestedBranchId: string | null | undefined,
): string | null {
  assertCanCreateUserRole(actor, targetRole);

  if (targetRole !== "OWNER" && !requestedBranchId && actor.role === "OWNER") {
    throw new AppError(
      400,
      "BRANCH_REQUIRED",
      "Managers and staff must be assigned to a branch.",
    );
  }

  if (actor.role === "MANAGER") {
    if (!actor.branchId) {
      throw new AppError(
        403,
        "BRANCH_SCOPE_REQUIRED",
        "Managers must have an assigned branch to create staff.",
      );
    }
    return actor.branchId;
  }

  if (!requestedBranchId) {
    return null;
  }

  if (!branch || branch.legalEntityId !== actor.legalEntityId) {
    throw new AppError(404, "BRANCH_NOT_FOUND", "Branch was not found.");
  }

  if (!branch.isActive) {
    throw new AppError(
      409,
      "BRANCH_INACTIVE",
      "Assign users to an active branch.",
    );
  }

  return branch.id;
}

export function userWhereForActor(actor: AdminActor): {
  legalEntityId: string;
  branchId?: string;
} {
  requireAdminActor(actor);
  if (actor.role === "OWNER") {
    return { legalEntityId: actor.legalEntityId };
  }
  if (!actor.branchId) {
    throw new AppError(
      403,
      "BRANCH_SCOPE_REQUIRED",
      "Managers need an assigned branch.",
    );
  }
  return { legalEntityId: actor.legalEntityId, branchId: actor.branchId };
}

export function branchWhereForActor(actor: AdminActor): {
  legalEntityId: string;
  id?: string;
} {
  requireAdminActor(actor);
  if (actor.role === "OWNER") {
    return { legalEntityId: actor.legalEntityId };
  }
  if (!actor.branchId) {
    throw new AppError(
      403,
      "BRANCH_SCOPE_REQUIRED",
      "Managers need an assigned branch.",
    );
  }
  return { legalEntityId: actor.legalEntityId, id: actor.branchId };
}

export function branchScopedWhereForActor(actor: AdminActor): {
  legalEntityId: string;
  branchId?: string;
} {
  requireAdminActor(actor);
  if (actor.role === "OWNER") {
    return { legalEntityId: actor.legalEntityId };
  }
  if (!actor.branchId) {
    throw new AppError(
      403,
      "BRANCH_SCOPE_REQUIRED",
      "Managers need an assigned branch.",
    );
  }
  return { legalEntityId: actor.legalEntityId, branchId: actor.branchId };
}

export function branchOptionalCatalogWhereForActor(actor: AdminActor): {
  legalEntityId: string;
  OR?: Array<{ branchId: string | null }>;
} {
  requireAdminActor(actor);
  if (actor.role === "OWNER") {
    return { legalEntityId: actor.legalEntityId };
  }
  if (!actor.branchId) {
    throw new AppError(
      403,
      "BRANCH_SCOPE_REQUIRED",
      "Managers need an assigned branch.",
    );
  }
  return {
    legalEntityId: actor.legalEntityId,
    OR: [{ branchId: actor.branchId }, { branchId: null }],
  };
}

export function assertCanManageBranchScopedRecord(
  actor: AdminActor,
  record: BranchScopedAdminRecord | null,
  targetLabel: string,
): asserts record is BranchScopedAdminRecord {
  requireAdminActor(actor);
  if (!record || record.legalEntityId !== actor.legalEntityId) {
    throw new AppError(404, "NOT_FOUND", `${targetLabel} was not found.`);
  }

  if (actor.role === "OWNER") {
    return;
  }

  if (!actor.branchId || record.branchId !== actor.branchId) {
    throw new AppError(
      403,
      "BRANCH_SCOPE_REQUIRED",
      `Managers can manage ${targetLabel.toLowerCase()} in their assigned branch only.`,
    );
  }
}

export function assertCanAssignCatalogBranch(
  actor: AdminActor,
  branch: AdminAssignableBranch | null,
  requestedBranchId: string | null | undefined,
  options?: { allowGlobalForOwner?: boolean },
): string | null {
  requireAdminActor(actor);

  if (actor.role === "MANAGER") {
    if (!actor.branchId) {
      throw new AppError(
        403,
        "BRANCH_SCOPE_REQUIRED",
        "Managers need an assigned branch.",
      );
    }
    return actor.branchId;
  }

  if (!requestedBranchId) {
    if (options?.allowGlobalForOwner) {
      return null;
    }
    throw new AppError(400, "BRANCH_REQUIRED", "Branch is required.");
  }

  if (!branch || branch.legalEntityId !== actor.legalEntityId) {
    throw new AppError(404, "BRANCH_NOT_FOUND", "Branch was not found.");
  }

  if (!branch.isActive) {
    throw new AppError(
      409,
      "BRANCH_INACTIVE",
      "Use an active branch for this setup item.",
    );
  }

  return branch.id;
}

export function assertResourceCanDeactivate(params: {
  resource: ResourceAvailabilitySummary;
  activeTimedLineCount: number;
}): void {
  if (
    params.resource.status === "OCCUPIED" ||
    params.resource.status === "PAUSED" ||
    params.activeTimedLineCount > 0
  ) {
    throw new AppError(
      409,
      "RESOURCE_IN_USE",
      "Stop or move running games before deactivating this resource.",
    );
  }
}

export function isProductVisibleInPos(
  product: PosProductVisibilitySummary,
  branchId: string,
): boolean {
  return product.isActive && (!product.branchId || product.branchId === branchId);
}

export function isResourceVisibleInPos(
  resource: PosResourceVisibilitySummary,
  branchId: string,
): boolean {
  return resource.isActive && resource.branchId === branchId;
}

export function calculateStockAdjustmentDelta(params: {
  adjustmentType: "INCREASE" | "DECREASE" | "SET_COUNT";
  quantity: number;
  currentStock: number;
}): number {
  const quantityDelta =
    params.adjustmentType === "INCREASE"
      ? params.quantity
      : params.adjustmentType === "DECREASE"
        ? -params.quantity
        : params.quantity - params.currentStock;

  if (params.currentStock + quantityDelta < 0) {
    throw new AppError(
      409,
      "NEGATIVE_STOCK",
      "Stock adjustment cannot reduce stock below zero.",
    );
  }

  return quantityDelta;
}

export function assertCanCreateBranch(actor: AdminActor): void {
  requireAdminActor(actor);
  if (actor.role !== "OWNER") {
    throw new AppError(
      403,
      "OWNER_REQUIRED",
      "Only owners can create new branches.",
    );
  }
}

export function assertCanManageBranch(
  actor: AdminActor,
  branch: ManagedBranchSummary | null,
): asserts branch is ManagedBranchSummary {
  requireAdminActor(actor);
  if (!branch || branch.legalEntityId !== actor.legalEntityId) {
    throw new AppError(404, "BRANCH_NOT_FOUND", "Branch was not found.");
  }

  if (actor.role === "OWNER") {
    return;
  }

  if (!actor.branchId || branch.id !== actor.branchId) {
    throw new AppError(
      403,
      "BRANCH_SCOPE_REQUIRED",
      "Managers can manage their assigned branch only.",
    );
  }
}

export function safeUserSnapshot(user: ManagedUserSummary): {
  id: string;
  legalEntityId: string;
  branchId: string | null;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
} {
  return {
    id: user.id,
    legalEntityId: user.legalEntityId,
    branchId: user.branchId,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
