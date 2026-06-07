import { prisma } from "@/lib/prisma";

export async function writeAuditLog(params: {
  legalEntityId: string;
  branchId?: string | null;
  operatorShiftId?: string | null;
  actorUserId?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      legalEntityId: params.legalEntityId,
      branchId: params.branchId,
      operatorShiftId: params.operatorShiftId,
      actorUserId: params.actorUserId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      beforeJson:
        params.beforeJson === undefined
          ? undefined
          : JSON.parse(JSON.stringify(params.beforeJson)),
      afterJson:
        params.afterJson === undefined
          ? undefined
          : JSON.parse(JSON.stringify(params.afterJson)),
      reason: params.reason,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });
}
