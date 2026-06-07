import { AppError } from "@/lib/http";

export type TenantScoped = {
  legalEntityId: string;
  branchId?: string | null;
};

export function assertLegalEntityScope(
  authLegalEntityId: string,
  row: TenantScoped | null | undefined,
): asserts row is TenantScoped {
  if (!row || row.legalEntityId !== authLegalEntityId) {
    throw new AppError(
      404,
      "TENANT_SCOPED_RESOURCE_NOT_FOUND",
      "The requested record was not found.",
    );
  }
}

export function tenantWhere<T extends object>(
  legalEntityId: string,
  where?: T,
): T & { legalEntityId: string } {
  return {
    ...(where ?? {}),
    legalEntityId,
  } as T & { legalEntityId: string };
}

export function assertBranchScope(
  auth: { role: string; branchId: string | null },
  row: TenantScoped,
): void {
  if (auth.role === "OWNER") {
    return;
  }

  if (auth.branchId && row.branchId && auth.branchId !== row.branchId) {
    throw new AppError(
      403,
      "BRANCH_SCOPE_VIOLATION",
      "This action is outside your assigned branch.",
    );
  }
}
