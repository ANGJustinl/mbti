import { NextResponse } from "next/server";

import { getCurrentSecondMeSession } from "../../../../lib/secondme/auth";

export async function GET() {
  const session = await getCurrentSecondMeSession();

  return NextResponse.json({
    authenticated: Boolean(session),
    user: session?.user ?? null,
    scope: session?.scope ?? [],
    expiresAt: session?.expiresAt ?? null,
  });
}

