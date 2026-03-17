import { NextResponse } from "next/server";

import { SecondMeApiError, fetchSecondMeJson, fetchSecondMeStream } from "./client";
import {
  SecondMeAuthError,
  ensureValidSecondMeSession,
  mapSecondMeErrorMessage,
} from "./auth";
import { MissingSecondMeConfigError } from "./config";

function errorResponse(error: unknown) {
  const mapped = mapSecondMeErrorMessage(error);

  return NextResponse.json(
    {
      code: mapped.status === 401 ? 401 : -1,
      message: mapped.message,
    },
    { status: mapped.status },
  );
}

export async function proxySecondMeJson(
  upstreamPath: string,
  init?: RequestInit,
) {
  try {
    const session = await ensureValidSecondMeSession();
    const result = await fetchSecondMeJson(upstreamPath, session.accessToken, init);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function proxySecondMeGet(
  upstreamPath: string,
  requestUrl: string,
) {
  const url = new URL(requestUrl);
  return proxySecondMeJson(`${upstreamPath}${url.search}`, {
    method: "GET",
  });
}

export async function proxySecondMeSse(
  upstreamPath: string,
  request: Request,
) {
  try {
    const session = await ensureValidSecondMeSession();
    const response = await fetchSecondMeStream(upstreamPath, session.accessToken, {
      method: request.method,
      headers: {
        "Content-Type": request.headers.get("content-type") ?? "application/json",
      },
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.text(),
    });

    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ?? "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (
      error instanceof MissingSecondMeConfigError ||
      error instanceof SecondMeApiError ||
      error instanceof SecondMeAuthError
    ) {
      return errorResponse(error);
    }

    return errorResponse(new Error("Second Me stream proxy failed"));
  }
}

