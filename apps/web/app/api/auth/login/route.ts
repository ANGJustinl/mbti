import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { buildSecondMeOauthUrl, mapSecondMeErrorMessage } from "../../../../lib/secondme/auth";
import { setOauthState, setPostAuthRedirect } from "../../../../lib/secondme/session";

function sanitizeReturnPath(value: string | null) {
  if (!value || !value.startsWith("/")) {
    return "/match";
  }

  return value;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const returnTo = sanitizeReturnPath(url.searchParams.get("next"));
    const state = randomUUID();

    await setOauthState(state);
    await setPostAuthRedirect(returnTo);

    return NextResponse.redirect(buildSecondMeOauthUrl(state));
  } catch (error) {
    const mapped = mapSecondMeErrorMessage(error);
    return NextResponse.json({ message: mapped.message }, { status: mapped.status });
  }
}

