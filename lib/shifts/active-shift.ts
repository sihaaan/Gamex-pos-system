import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/http";
import type { AuthContext } from "@/lib/auth/session";

export type ActiveOperatorShift = {
  id: string;
  legalEntityId: string;
  branchId: string;
  staffUserId: string;
};

export async function requireActiveOperatorShift(params: {
  auth: AuthContext;
  branchId?: string;
}): Promise<ActiveOperatorShift> {
  const shift = await prisma.operatorShift.findFirst({
    where: {
      legalEntityId: params.auth.legalEntityId,
      staffUserId: params.auth.userId,
      branchId: params.branchId,
      status: "OPEN",
    },
    select: {
      id: true,
      legalEntityId: true,
      branchId: true,
      staffUserId: true,
    },
    orderBy: { openedAt: "desc" },
  });

  if (!shift) {
    throw new AppError(
      409,
      "ACTIVE_SHIFT_REQUIRED",
      "Open an operator shift before making POS sales.",
    );
  }

  return shift;
}
