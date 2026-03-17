import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const DEFAULT_API_BASE_URL = "https://api.mindverse.com/gate/lab";
const DEFAULT_OAUTH_URL = "https://go.second.me/oauth/";

let cachedFileEnv: Record<string, string> | null = null;

function loadEnvFromFiles() {
  if (cachedFileEnv) {
    return cachedFileEnv;
  }

  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "..", "..", ".env.local"),
    path.resolve(process.cwd(), "..", "..", ".env"),
  ];

  const merged: Record<string, string> = {};

  for (const filePath of candidates) {
    if (!existsSync(filePath)) {
      continue;
    }

    const content = readFileSync(filePath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) {
        continue;
      }

      const [key, ...rest] = line.split("=");
      if (!key) {
        continue;
      }

      const value = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
      merged[key] = value;
    }
  }

  cachedFileEnv = merged;
  return merged;
}

function readEnv(name: string) {
  return process.env[name] ?? loadEnvFromFiles()[name];
}

export class MissingSecondMeConfigError extends Error {
  constructor(public readonly missingKeys: string[]) {
    super(`Missing Second Me config: ${missingKeys.join(", ")}`);
    this.name = "MissingSecondMeConfigError";
  }
}

export interface SecondMeConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  oauthUrl: string;
  apiBaseUrl: string;
  tokenEndpoint: string;
  refreshEndpoint: string;
}

function required(name: string) {
  return readEnv(name);
}

export function hasSecondMeCredentials() {
  return Boolean(
    readEnv("SECONDME_CLIENT_ID") &&
      readEnv("SECONDME_CLIENT_SECRET") &&
      readEnv("SECONDME_REDIRECT_URI"),
  );
}

export function getSecondMeConfig(): SecondMeConfig {
  const missing = [
    "SECONDME_CLIENT_ID",
    "SECONDME_CLIENT_SECRET",
    "SECONDME_REDIRECT_URI",
  ].filter((name) => !required(name));

  if (missing.length > 0) {
    throw new MissingSecondMeConfigError(missing);
  }

  const apiBaseUrl = readEnv("SECONDME_API_BASE_URL") ?? DEFAULT_API_BASE_URL;

  return {
    clientId: required("SECONDME_CLIENT_ID")!,
    clientSecret: required("SECONDME_CLIENT_SECRET")!,
    redirectUri: required("SECONDME_REDIRECT_URI")!,
    oauthUrl: readEnv("SECONDME_OAUTH_URL") ?? DEFAULT_OAUTH_URL,
    apiBaseUrl,
    tokenEndpoint:
      readEnv("SECONDME_TOKEN_ENDPOINT") ?? `${apiBaseUrl}/api/oauth/token/code`,
    refreshEndpoint:
      readEnv("SECONDME_REFRESH_ENDPOINT") ??
      `${apiBaseUrl}/api/oauth/token/refresh`,
  };
}

export function getSecondMeSessionSecret() {
  return (
    readEnv("SECONDME_SESSION_SECRET") ??
    readEnv("SECONDME_CLIENT_SECRET") ??
    "dual-core-secondme-dev-secret"
  );
}
