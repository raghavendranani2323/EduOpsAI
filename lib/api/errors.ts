import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorResponse(error: ApiError) {
  return NextResponse.json(
    { ok: false, error: error.message, code: error.code },
    { status: error.status },
  );
}

export function serverErrorResponse(message = "Something went wrong") {
  return NextResponse.json(
    { ok: false, error: message, code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}

