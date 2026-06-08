import { describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { approveManagerOverride } from "@/lib/manager-overrides/approval";
import type { ManagerOverrideApprovalInput } from "@/lib/manager-overrides/approval";

const input: ManagerOverrideApprovalInput = {
  action: "HIGH_DISCOUNT",
  targetType: "tab",
  targetId: "tab-1",
  reason: "Regular customer goodwill",
  managerEmailOrCode: "manager@gamex.local",
  managerPassword: "Gamex@12345",
};

const requester = {
  userId: "staff-1",
  legalEntityId: "entity-1",
  branchId: "branch-1",
  role: "STAFF" as const,
};

describe("manager override approval", () => {
  it("blocks staff users from approving overrides", async () => {
    await expect(
      approveManagerOverride({
        requester,
        input,
        branchId: "branch-1",
        operatorShiftId: "shift-1",
        manager: {
          id: "staff-2",
          legalEntityId: "entity-1",
          branchId: "branch-1",
          email: "staff-2@gamex.local",
          role: "STAFF",
          passwordHash: await hashPassword(input.managerPassword),
          isActive: true,
        },
        createApprovedOverride: async () => ({ id: "override-1" }),
      }),
    ).rejects.toMatchObject({ code: "MANAGER_ROLE_REQUIRED" });
  });

  it("blocks managers from another legal entity", async () => {
    await expect(
      approveManagerOverride({
        requester,
        input,
        branchId: "branch-1",
        operatorShiftId: "shift-1",
        manager: {
          id: "manager-2",
          legalEntityId: "entity-2",
          branchId: "branch-2",
          email: "manager-2@gamex.local",
          role: "MANAGER",
          passwordHash: await hashPassword(input.managerPassword),
          isActive: true,
        },
        createApprovedOverride: async () => ({ id: "override-1" }),
      }),
    ).rejects.toMatchObject({ code: "MANAGER_TENANT_MISMATCH" });
  });

  it("creates an approved override through the persistence callback", async () => {
    let persisted = false;
    const result = await approveManagerOverride({
      requester,
      input,
      branchId: "branch-1",
      operatorShiftId: "shift-1",
      manager: {
        id: "manager-1",
        legalEntityId: "entity-1",
        branchId: "branch-1",
        email: "manager@gamex.local",
        role: "MANAGER",
        passwordHash: await hashPassword(input.managerPassword),
        isActive: true,
      },
      createApprovedOverride: async ({ requester, manager }) => {
        persisted = requester.userId === "staff-1" && manager.id === "manager-1";
        return { id: "override-1" };
      },
    });

    expect(result.id).toBe("override-1");
    expect(persisted).toBe(true);
  });
});
