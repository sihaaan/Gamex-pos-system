import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { canIssueSessionForUser } from "@/lib/auth/login-policy";
import {
  assertCanCreateBranch,
  assertCanCreateUserRole,
  assertCanManageBranch,
  assertCanManageUser,
  branchWhereForActor,
  safeUserSnapshot,
  userWhereForActor,
  type AdminActor,
  type ManagedUserSummary,
} from "@/lib/admin/management";
import { AppError } from "@/lib/http";

const owner: AdminActor = {
  userId: "owner-1",
  legalEntityId: "entity-1",
  branchId: null,
  role: "OWNER",
};

const manager: AdminActor = {
  userId: "manager-1",
  legalEntityId: "entity-1",
  branchId: "branch-1",
  role: "MANAGER",
};

const staff: AdminActor = {
  userId: "staff-1",
  legalEntityId: "entity-1",
  branchId: "branch-1",
  role: "STAFF",
};

const managedStaff: ManagedUserSummary = {
  id: "staff-2",
  legalEntityId: "entity-1",
  branchId: "branch-1",
  email: "staff@example.com",
  name: "Staff",
  role: "STAFF",
  isActive: true,
  passwordHash: "secret-hash",
  mfaSecretEnvelope: "encrypted-mfa",
};

describe("admin management policy", () => {
  it("blocks staff from admin management", () => {
    expect(() => userWhereForActor(staff)).toThrow(AppError);
    expect(() => assertCanCreateBranch(staff)).toThrow(AppError);
  });

  it("allows owners to create staff, managers, and owners", () => {
    expect(() => assertCanCreateUserRole(owner, "STAFF")).not.toThrow();
    expect(() => assertCanCreateUserRole(owner, "MANAGER")).not.toThrow();
    expect(() => assertCanCreateUserRole(owner, "OWNER")).not.toThrow();
  });

  it("prevents managers from creating owners or managers", () => {
    expect(() => assertCanCreateUserRole(manager, "OWNER")).toThrow(AppError);
    expect(() => assertCanCreateUserRole(manager, "MANAGER")).toThrow(AppError);
    expect(() => assertCanCreateUserRole(manager, "STAFF")).not.toThrow();
  });

  it("scopes non-owner users to their branch", () => {
    expect(userWhereForActor(manager)).toEqual({
      legalEntityId: "entity-1",
      branchId: "branch-1",
    });
    expect(branchWhereForActor(manager)).toEqual({
      legalEntityId: "entity-1",
      id: "branch-1",
    });
  });

  it("blocks cross-tenant user and branch mutations", () => {
    expect(() =>
      assertCanManageUser(owner, { ...managedStaff, legalEntityId: "entity-2" }),
    ).toThrow(AppError);
    expect(() =>
      assertCanManageBranch(owner, {
        id: "branch-2",
        legalEntityId: "entity-2",
        isActive: true,
      }),
    ).toThrow(AppError);
  });

  it("blocks managers from editing another branch or non-staff users", () => {
    expect(() =>
      assertCanManageUser(manager, { ...managedStaff, branchId: "branch-2" }),
    ).toThrow(AppError);
    expect(() =>
      assertCanManageUser(manager, { ...managedStaff, role: "OWNER" }),
    ).toThrow(AppError);
    expect(() => assertCanManageUser(manager, managedStaff)).not.toThrow();
  });

  it("removes secrets from user audit snapshots", () => {
    expect(safeUserSnapshot(managedStaff)).toEqual({
      id: "staff-2",
      legalEntityId: "entity-1",
      branchId: "branch-1",
      email: "staff@example.com",
      name: "Staff",
      role: "STAFF",
      isActive: true,
      lastLoginAt: undefined,
      createdAt: undefined,
      updatedAt: undefined,
    });
  });
});

describe("admin password and login controls", () => {
  it("hashes temporary passwords without retaining plaintext", async () => {
    const password = "TempPass@12345";
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    await expect(verifyPassword(hash, password)).resolves.toBe(true);
  });

  it("does not issue sessions for deactivated users", () => {
    expect(canIssueSessionForUser({ isActive: true })).toBe(true);
    expect(canIssueSessionForUser({ isActive: false })).toBe(false);
    expect(canIssueSessionForUser(null)).toBe(false);
  });
});
