import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { requireAuth, requestFingerprint } from "@/lib/auth/session";
import {
  assertCanAssignUserBranch,
  safeUserSnapshot,
  userWhereForActor,
} from "@/lib/admin/management";
import { created, errorResponse, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { adminUserCreateSchema } from "@/lib/validation/common";

export async function GET(): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    const users = await prisma.user.findMany({
      where: userWhereForActor(auth),
      select: {
        id: true,
        legalEntityId: true,
        branchId: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ users });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    const input = await parseJson(request, adminUserCreateSchema);
    const email = input.email.toLowerCase();

    const [existingUser, branch] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      input.branchId
        ? prisma.branch.findFirst({
            where: { id: input.branchId, legalEntityId: auth.legalEntityId },
            select: { id: true, legalEntityId: true, isActive: true },
          })
        : Promise.resolve(null),
    ]);

    if (existingUser) {
      return NextResponse.json(
        {
          error: {
            code: "EMAIL_ALREADY_EXISTS",
            message: "A user with this email already exists.",
          },
        },
        { status: 409 },
      );
    }

    const branchId = assertCanAssignUserBranch(
      auth,
      input.role,
      branch,
      input.branchId ?? null,
    );
    const passwordHash = await hashPassword(input.temporaryPassword);
    const fingerprint = await requestFingerprint();

    const user = await prisma.user.create({
      data: {
        legalEntityId: auth.legalEntityId,
        branchId,
        email,
        name: input.name,
        role: input.role,
        passwordHash,
        isActive: input.isActive,
      },
      select: {
        id: true,
        legalEntityId: true,
        branchId: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        legalEntityId: auth.legalEntityId,
        branchId,
        actorUserId: auth.userId,
        action: "ADMIN_USER_CREATED",
        targetType: "user",
        targetId: user.id,
        afterJson: JSON.parse(JSON.stringify(safeUserSnapshot(user))),
        ipAddress: fingerprint.ipAddress,
        userAgent: fingerprint.userAgent,
      },
    });

    return created({ user });
  } catch (error) {
    return errorResponse(error);
  }
}
