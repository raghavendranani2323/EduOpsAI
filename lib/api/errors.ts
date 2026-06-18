import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ErrorResponseOptions {
  requestId?: string;
}

export function errorResponse(error: ApiError, options: ErrorResponseOptions = {}) {
  const headers = new Headers();
  if (options.requestId) headers.set("x-request-id", options.requestId);
  if (error.retryAfterSeconds) {
    headers.set("retry-after", String(error.retryAfterSeconds));
  }
  return NextResponse.json(
    {
      ok: false,
      error: error.message,
      code: error.code,
      ...(options.requestId ? { requestId: options.requestId } : {}),
    },
    { status: error.status, headers },
  );
}

export function serverErrorResponse(
  message = "Something went wrong",
  options: ErrorResponseOptions = {},
) {
  const headers = new Headers();
  if (options.requestId) headers.set("x-request-id", options.requestId);
  return NextResponse.json(
    {
      ok: false,
      error: message,
      code: "INTERNAL_ERROR",
      ...(options.requestId ? { requestId: options.requestId } : {}),
    },
    { status: 500, headers },
  );
}
