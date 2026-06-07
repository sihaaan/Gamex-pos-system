import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  revokeCurrentSession,
} from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";

export async function POST(): Promise<NextResponse> {
  try {
    await revokeCurrentSession();
    const response = NextResponse.json({ ok: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
