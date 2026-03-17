import { NextResponse } from "next/server";

import { createSessionFromCode, mapSecondMeErrorMessage } from "../../../../lib/secondme/auth";
import {
  clearOauthState,
  clearPostAuthRedirect,
  readOauthState,
  readPostAuthRedirect,
} from "../../../../lib/secondme/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const returnTo = (await readPostAuthRedirect()) ?? "/match";
  const cookieState = await readOauthState();

  await clearOauthState();
  await clearPostAuthRedirect();

  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/?authError=${encodeURIComponent(oauthError)}`, url.origin),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/?authError=missing_code", url.origin),
    );
  }

  if (cookieState && state && cookieState !== state) {
    console.warn("Second Me OAuth state mismatch detected; continuing in relaxed mode.");
  }

  try {
    await createSessionFromCode(code);
    return NextResponse.redirect(new URL(returnTo, url.origin));
  } catch (error) {
    const mapped = mapSecondMeErrorMessage(error);
    return NextResponse.redirect(
      new URL(`/?authError=${encodeURIComponent(mapped.message)}`, url.origin),
    );
  }
}

