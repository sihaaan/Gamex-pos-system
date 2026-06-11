import type { AuthContext } from "@/lib/auth/session";
import { AppError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import type { ReportFilters } from "@/lib/reports/filters";

export type ReportBranchOption = {
  id: string;
  name: string;
  code: string;
};

export async function loadReportBranches(
  auth: AuthContext,
): Promise<ReportBranchOption[]> {
  if (auth.role === "MANAGER" && !auth.branchId) {
    throw new AppError(
      403,
      "BRANCH_SCOPE_REQUIRED",
      "Managers need an assigned branch.",
    );
  }

  return prisma.branch.findMany({
    where: {
      legalEntityId: auth.legalEntityId,
      id: auth.role === "OWNER" ? undefined : auth.branchId ?? undefined,
    },
    select: {
      id: true,
      name: true,
      code: true,
    },
    orderBy: { code: "asc" },
  });
}

export function reportMeta(params: {
  auth: AuthContext;
  filters: ReportFilters;
  branches: readonly ReportBranchOption[];
}) {
  return {
    currentUser: {
      role: params.auth.role,
      branchId: params.auth.branchId,
      name: params.auth.name,
    },
    filters: {
      preset: params.filters.preset,
      from: params.filters.from.toISOString(),
      to: params.filters.to.toISOString(),
      branchId: params.filters.branchId,
      staffUserId: params.filters.staffUserId,
    },
    branches: params.branches,
  };
}
