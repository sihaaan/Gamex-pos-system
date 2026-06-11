import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "ok",
    service: "gamex-pos",
    timestamp: new Date().toISOString(),
  });
}
