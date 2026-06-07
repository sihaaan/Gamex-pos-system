import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "The request payload is invalid.",
          issues: error.issues,
        },
      },
      { status: 400 },
    );
  }

  console.error(error);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong while processing the request.",
      },
    },
    { status: 500 },
  );
}

export async function parseJson<T>(
  request: Request,
  schema: ZodSchema<T>,
): Promise<T> {
  const body = await request.json();
  return schema.parse(body);
}

export function created<T>(payload: T): NextResponse<T> {
  return NextResponse.json(payload, { status: 201 });
}

export function ok<T>(payload: T): NextResponse<T> {
  return NextResponse.json(payload);
}
