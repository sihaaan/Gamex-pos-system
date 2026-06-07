import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";

export async function GET(): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    return NextResponse.json({ user: auth });
  } catch (error) {
    return errorResponse(error);
  }
}
