import { MissingSecondMeConfigError, getSecondMeConfig } from "./config";
import {
  exchangeCodeForToken,
  fetchSecondMeUserInfo,
  refreshSecondMeToken,
  runActJson,
  type SecondMeActPayload,
  type SecondMeUserInfo,
} from "./client";
import {
  clearSecondMeSession,
  readSecondMeSession,
  writeSecondMeSession,
  type SecondMeSession,
  type SecondMeSessionUser,
  isAccessTokenStale,
} from "./session";
import { saveSecondMeAccount } from "../current-user";

export class SecondMeAuthError extends Error {
  constructor(
    message: string,
    public readonly status = 401,
  ) {
    super(message);
    this.name = "SecondMeAuthError";
  }
}

function normalizeUserInfo(user: SecondMeUserInfo): SecondMeSessionUser {
  return {
    secondmeUserId:
      typeof user.userId === "string"
        ? user.userId
        : typeof user.id === "string"
          ? user.id
          : undefined,
    name: typeof user.name === "string" ? user.name : undefined,
    email: typeof user.email === "string" ? user.email : undefined,
    avatarUrl: typeof user.avatarUrl === "string" ? user.avatarUrl : undefined,
    route: typeof user.route === "string" ? user.route : undefined,
  };
}

function buildSessionFromToken(
  token: Awaited<ReturnType<typeof exchangeCodeForToken>>["data"],
  user?: SecondMeSessionUser,
): SecondMeSession {
  return {
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresAt: Date.now() + token.expiresIn * 1000,
    scope: token.scope ?? [],
    tokenType: token.tokenType,
    user,
  };
}

export function buildSecondMeOauthUrl(state: string) {
  const config = getSecondMeConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    state,
  });

  return `${config.oauthUrl}?${params.toString()}`;
}

export async function createSessionFromCode(code: string) {
  const token = await exchangeCodeForToken(code);
  const userInfo = await fetchSecondMeUserInfo(token.data.accessToken).catch(() => null);
  const session = buildSessionFromToken(
    token.data,
    userInfo?.data ? normalizeUserInfo(userInfo.data) : undefined,
  );
  await writeSecondMeSession(session);
  await saveSecondMeAccount(session).catch(() => null);
  return session;
}

export async function ensureValidSecondMeSession() {
  const session = await readSecondMeSession();
  if (!session) {
    throw new SecondMeAuthError("Second Me 未登录");
  }

  if (!isAccessTokenStale(session)) {
    return session;
  }

  try {
    const refreshed = await refreshSecondMeToken(session.refreshToken);
    const nextSession = buildSessionFromToken(refreshed.data, session.user);
    await writeSecondMeSession(nextSession);
    await saveSecondMeAccount(nextSession).catch(() => null);
    return nextSession;
  } catch (error) {
    await clearSecondMeSession();
    throw error;
  }
}

export async function getCurrentSecondMeSession() {
  return readSecondMeSession();
}

export async function getCurrentSecondMeUser() {
  const session = await readSecondMeSession();
  return session?.user ?? null;
}

export async function runSecondMeActJson<T>(payload: SecondMeActPayload) {
  const session = await ensureValidSecondMeSession();
  return runActJson<T>(session.accessToken, payload);
}

export function mapSecondMeErrorMessage(error: unknown) {
  if (error instanceof MissingSecondMeConfigError) {
    return {
      status: 500,
      message: `Second Me 环境变量缺失: ${error.missingKeys.join(", ")}`,
    };
  }

  if (error instanceof SecondMeAuthError) {
    return {
      status: error.status,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      status: 500,
      message: error.message,
    };
  }

  return {
    status: 500,
    message: "Unknown Second Me error",
  };
}
