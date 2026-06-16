import { NextResponse } from "next/server";
import { requireAuth, requestFingerprint } from "@/lib/auth/session";
import { errorResponse, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { adminLegalEntityUpdateSchema } from "@/lib/validation/common";

const legalEntitySelect = {
  id: true,
  name: true,
  gstin: true,
  address: true,
  stateCode: true,
  updatedAt: true,
};

export async function GET(): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    if (auth.role === "STAFF") {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Staff accounts cannot access business setup.",
          },
        },
        { status: 403 },
      );
    }

    const legalEntity = await prisma.legalEntity.findUniqueOrThrow({
      where: { id: auth.legalEntityId },
      select: legalEntitySelect,
    });

    return NextResponse.json({ legalEntity });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    if (auth.role !== "OWNER") {
      return NextResponse.json(
        {
          error: {
            code: "OWNER_REQUIRED",
            message: "Only owners can change legal entity details.",
          },
        },
        { status: 403 },
      );
    }

    const input = await parseJson(request, adminLegalEntityUpdateSchema);
    const fingerprint = await requestFingerprint();

    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.legalEntity.findUniqueOrThrow({
        where: { id: auth.legalEntityId },
        select: legalEntitySelect,
      });

      const legalEntity = await tx.legalEntity.update({
        where: { id: auth.legalEntityId },
        data: {
          name: input.name,
          gstin: input.gstin,
          address: input.address,
          stateCode: input.stateCode,
        },
        select: legalEntitySelect,
      });

      await tx.auditLog.create({
        data: {
          legalEntityId: auth.legalEntityId,
          actorUserId: auth.userId,
          action: "ADMIN_LEGAL_ENTITY_EDITED",
          targetType: "legal_entity",
          targetId: auth.legalEntityId,
          beforeJson: JSON.parse(JSON.stringify(before)),
          afterJson: JSON.parse(JSON.stringify(legalEntity)),
          reason: input.reason,
          ipAddress: fingerprint.ipAddress,
          userAgent: fingerprint.userAgent,
        },
      });

      return legalEntity;
    });

    return NextResponse.json({ legalEntity: result });
  } catch (error) {
    return errorResponse(error);
  }
}
