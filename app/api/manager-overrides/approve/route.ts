import { NextResponse } from "next/server";
import { requireAuth, requestFingerprint } from "@/lib/auth/session";
import { AppError, errorResponse, parseJson } from "@/lib/http";
import {
  approveManagerOverride,
  type ManagerOverrideApprovalInput,
} from "@/lib/manager-overrides/approval";
import { assertBranchScope, assertLegalEntityScope } from "@/lib/permissions/tenant";
import { prisma } from "@/lib/prisma";
import { requireActiveOperatorShift } from "@/lib/shifts/active-shift";
import { managerOverrideApproveSchema } from "@/lib/validation/common";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    const input = await parseJson(request, managerOverrideApproveSchema);
    const branchId = await resolveBranchId(input);
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, legalEntityId: auth.legalEntityId },
      select: { id: true, legalEntityId: true },
    });
    assertLegalEntityScope(auth.legalEntityId, branch);
    assertBranchScope(auth, {
      legalEntityId: branch.legalEntityId,
      branchId: branch.id,
    });

    const activeShift = await requireActiveOperatorShift({ auth, branchId });
    const managerLookup = input.managerEmailOrCode.toLowerCase();
    const manager = await prisma.user.findUnique({
      where: { email: managerLookup },
      select: {
        id: true,
        legalEntityId: true,
        branchId: true,
        email: true,
        role: true,
        passwordHash: true,
        isActive: true,
      },
    });
    const fingerprint = await requestFingerprint();

    const override = await approveManagerOverride({
      requester: auth,
      input,
      manager,
      branchId,
      operatorShiftId: activeShift.id,
      createApprovedOverride: async ({
        input: approvalInput,
        requester,
        manager,
        branchId,
        operatorShiftId,
      }) =>
        prisma.$transaction(async (tx) => {
          const created = await tx.managerOverride.create({
            data: {
              legalEntityId: requester.legalEntityId,
              branchId,
              operatorShiftId,
              action: approvalInput.action,
              status: "APPROVED",
              managerUserId: manager.id,
              targetType: approvalInput.targetType,
              targetId: approvalInput.targetId ?? "PENDING",
              reason: approvalInput.reason,
              metadata: {
                staffUserId: requester.userId,
                staffRole: requester.role,
                managerEmail: manager.email,
                approvedForSingleUse: true,
              },
            },
          });

          await tx.auditLog.create({
            data: {
              legalEntityId: requester.legalEntityId,
              branchId,
              operatorShiftId,
              actorUserId: requester.userId,
              action: "MANAGER_OVERRIDE_APPROVED",
              targetType: "manager_override",
              targetId: created.id,
              reason: approvalInput.reason,
              ipAddress: fingerprint.ipAddress,
              userAgent: fingerprint.userAgent,
              afterJson: {
                action: approvalInput.action,
                targetType: approvalInput.targetType,
                targetId: approvalInput.targetId ?? null,
                managerUserId: manager.id,
                staffUserId: requester.userId,
              },
            },
          });

          return { id: created.id };
        }),
    });

    return NextResponse.json({ managerOverrideId: override.id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

async function resolveBranchId(input: ManagerOverrideApprovalInput): Promise<string> {
  if (input.targetType === "tab" && input.targetId) {
    const tab = await prisma.tab.findUnique({
      where: { id: input.targetId },
      select: { branchId: true },
    });
    if (!tab) {
      throw new AppError(404, "TARGET_NOT_FOUND", "Override target was not found.");
    }
    return tab.branchId;
  }

  if (input.branchId) {
    return input.branchId;
  }

  throw new AppError(
    400,
    "BRANCH_REQUIRED",
    "Branch is required when no branch-scoped target is provided.",
  );
}
