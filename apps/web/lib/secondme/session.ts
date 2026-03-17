import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { getSecondMeConfig, getSecondMeSessionSecret } from "./config";

export interface SecondMeSessionUser {
  secondmeUserId?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  route?: string;
}

export interface SecondMeSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string[];
  tokenType?: string;
  user?: SecondMeSessionUser;
}

const SESSION_COOKIE = "secondme_session";
const OAUTH_STATE_COOKIE = "secondme_oauth_state";
const REDIRECT_COOKIE = "secondme_post_auth_redirect";

function shouldUseSecureCookies() {
  try {
    const { redirectUri } = getSecondMeConfig();
    return !/^http:\/\/(localhost|127\.0\.0\.1)/.test(redirectUri);
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: shouldUseSecureCookies(),
    path: "/",
  };
}

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: shouldUseSecureCookies(),
  path: "/",
};

function sign(value: string) {
  return createHmac("sha256", getSecondMeSessionSecret())
    .update(value)
    .digest("base64url");
}

function encodeSignedJson<T>(payload: T) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeSignedJson<T>(value?: string): T | null {
  if (!value) {
    return null;
  }

  const [body, signature] = value.split(".");
  if (!body || !signature) {
    return null;
  }

  const expected = sign(body);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);

  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function isAccessTokenStale(session: SecondMeSession, skewMs = 60_000) {
  return session.expiresAt <= Date.now() + skewMs;
}

export async function readSecondMeSession(): Promise<SecondMeSession | null> {
  const store = await cookies();
  return decodeSignedJson<SecondMeSession>(store.get(SESSION_COOKIE)?.value);
}

export async function writeSecondMeSession(session: SecondMeSession) {
  const store = await cookies();
  store.set(SESSION_COOKIE, encodeSignedJson(session), {
    ...getCookieOptions(),
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSecondMeSession() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    ...getCookieOptions(),
    maxAge: 0,
  });
}

export async function setOauthState(state: string) {
  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE, state, {
    ...getCookieOptions(),
    maxAge: 60 * 10,
  });
}

export async function readOauthState() {
  const store = await cookies();
  return store.get(OAUTH_STATE_COOKIE)?.value ?? null;
}

export async function clearOauthState() {
  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE, "", {
    ...getCookieOptions(),
    maxAge: 0,
  });
}

export async function setPostAuthRedirect(pathname: string) {
  const store = await cookies();
  store.set(REDIRECT_COOKIE, pathname, {
    ...getCookieOptions(),
    maxAge: 60 * 10,
  });
}

export async function readPostAuthRedirect() {
  const store = await cookies();
  return store.get(REDIRECT_COOKIE)?.value ?? null;
}

export async function clearPostAuthRedirect() {
  const store = await cookies();
  store.set(REDIRECT_COOKIE, "", {
    ...getCookieOptions(),
    maxAge: 0,
  });
}
