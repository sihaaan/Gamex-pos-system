import { verifyPassword } from "@/lib/auth/password";
import type { UserRole } from "@/lib/generated/prisma/enums";
import { AppError } from "@/lib/http";
import { managerOverrideApproveSchema } from "@/lib/validation/common";
import type { z } from "zod";

export type ManagerOverrideApprovalInput = z.infer<
  typeof managerOverrideApproveSchema
>;

export type OverrideRequester = {
  userId: string;
  legalEntityId: string;
  branchId: string | null;
  role: UserRole;
};

export type OverrideManagerUser = {
  id: string;
  legalEntityId: string;
  branchId: string | null;
  email: string;
  role: UserRole;
  passwordHash: string;
  isActive: boolean;
};

export type ApprovedManagerOverride = {
  id: string;
};

export async function approveManagerOverride(params: {
  requester: OverrideRequester;
  input: ManagerOverrideApprovalInput;
  manager: OverrideManagerUser | null;
  branchId: string;
  operatorShiftId: string | null;
  createApprovedOverride: (params: {
    input: ManagerOverrideApprovalInput;
    requester: OverrideRequester;
    manager: OverrideManagerUser;
    branchId: string;
    operatorShiftId: string | null;
  }) => Promise<ApprovedManagerOverride>;
}): Promise<ApprovedManagerOverride> {
  const manager = params.manager;

  if (!manager || !manager.isActive) {
    throw new AppError(
      401,
      "MANAGER_APPROVAL_INVALID",
      "Manager approval failed.",
    );
  }

  if (manager.legalEntityId !== params.requester.legalEntityId) {
    throw new AppError(
      403,
      "MANAGER_TENANT_MISMATCH",
      "Manager must belong to the same legal entity.",
    );
  }

  if (manager.role !== "MANAGER" && manager.role !== "OWNER") {
    throw new AppError(
      403,
      "MANAGER_ROLE_REQUIRED",
      "A manager or owner must approve this action.",
    );
  }

  if (manager.id === params.requester.userId) {
    throw new AppError(
      403,
      "SELF_APPROVAL_BLOCKED",
      "You cannot approve your own override.",
    );
  }

  const passwordOk = await verifyPassword(
    manager.passwordHash,
    params.input.managerPassword,
  );
  if (!passwordOk) {
    throw new AppError(
      401,
      "MANAGER_APPROVAL_INVALID",
      "Manager approval failed.",
    );
  }

  return params.createApprovedOverride({
    input: params.input,
    requester: params.requester,
    manager,
    branchId: params.branchId,
    operatorShiftId: params.operatorShiftId,
  });
}
