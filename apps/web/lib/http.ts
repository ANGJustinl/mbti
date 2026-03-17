import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(
    {
      status: "ok",
      data,
    },
    init,
  );
}

export function failure(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      status: "error",
      error: {
        message,
        details,
      },
    },
    { status },
  );
}

