import { NextResponse } from "next/server";

import {
  clearOauthState,
  clearPostAuthRedirect,
  clearSecondMeSession,
} from "../../../../lib/secondme/session";

export async function GET(request: Request) {
  const url = new URL(request.url);

  await Promise.all([
    clearSecondMeSession(),
    clearOauthState(),
    clearPostAuthRedirect(),
  ]);

  return NextResponse.redirect(new URL("/", url.origin));
}

