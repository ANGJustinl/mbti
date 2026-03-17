import { getSecondMeConfig } from "./config";

export interface SecondMeEnvelope<T> {
  code: number;
  data: T;
  message?: string;
}

export interface SecondMeTokenPayload {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  scope?: string[];
}

export interface SecondMeUserInfo {
  id?: string;
  userId?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  route?: string;
  [key: string]: unknown;
}

export interface SecondMeActPayload {
  message: string;
  actionControl: string;
  appId?: string;
  sessionId?: string;
  systemPrompt?: string;
}

export class SecondMeApiError extends Error {
  constructor(
    message: string,
    public readonly status = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "SecondMeApiError";
  }
}

async function parseJsonEnvelope<T>(response: Response): Promise<SecondMeEnvelope<T>> {
  const text = await response.text();
  const result = text ? (JSON.parse(text) as SecondMeEnvelope<T>) : null;

  if (!response.ok) {
    throw new SecondMeApiError(
      result?.message ?? `Second Me request failed: ${response.status}`,
      response.status,
      result,
    );
  }

  if (!result || result.code !== 0) {
    throw new SecondMeApiError(
      result?.message ?? "Second Me returned an invalid response",
      response.status,
      result,
    );
  }

  return result;
}

export async function exchangeCodeForToken(code: string) {
  const config = getSecondMeConfig();
  const response = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
    cache: "no-store",
  });

  return parseJsonEnvelope<SecondMeTokenPayload>(response);
}

export async function refreshSecondMeToken(refreshToken: string) {
  const config = getSecondMeConfig();
  const response = await fetch(config.refreshEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
    cache: "no-store",
  });

  return parseJsonEnvelope<SecondMeTokenPayload>(response);
}

export async function fetchSecondMeJson<T>(
  upstreamPath: string,
  accessToken: string,
  init?: RequestInit,
) {
  const { apiBaseUrl } = getSecondMeConfig();
  const response = await fetch(`${apiBaseUrl}${upstreamPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  return parseJsonEnvelope<T>(response);
}

export async function fetchSecondMeStream(
  upstreamPath: string,
  accessToken: string,
  init: RequestInit,
) {
  const { apiBaseUrl } = getSecondMeConfig();
  const response = await fetch(`${apiBaseUrl}${upstreamPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new SecondMeApiError(
      `Second Me stream failed: ${response.status}`,
      response.status,
      body,
    );
  }

  return response;
}

export async function fetchSecondMeUserInfo(accessToken: string) {
  return fetchSecondMeJson<SecondMeUserInfo>("/api/secondme/user/info", accessToken, {
    method: "GET",
  });
}

export function parseActSsePayload<T>(payload: string): T {
  let content = "";

  for (const line of payload.split(/\r?\n/)) {
    if (!line.startsWith("data:")) {
      continue;
    }

    const raw = line.slice(5).trim();
    if (!raw || raw === "[DONE]") {
      continue;
    }

    try {
      const parsed = JSON.parse(raw) as {
        choices?: Array<{ delta?: { content?: string } }>;
      };
      const delta = parsed.choices?.[0]?.delta?.content;
      if (delta) {
        content += delta;
      }
    } catch {
      continue;
    }
  }

  if (!content) {
    throw new SecondMeApiError("Second Me Act stream returned no JSON payload");
  }

  return JSON.parse(content) as T;
}

export async function runActJson<T>(
  accessToken: string,
  payload: SecondMeActPayload,
) {
  const response = await fetchSecondMeStream("/api/secondme/act/stream", accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseActSsePayload<T>(await response.text());
}

