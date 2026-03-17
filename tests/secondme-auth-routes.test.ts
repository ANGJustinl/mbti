import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  buildSecondMeOauthUrl: vi.fn(),
  createSessionFromCode: vi.fn(),
  getCurrentSecondMeSession: vi.fn(),
  mapSecondMeErrorMessage: vi.fn((error: unknown) => ({
    status: 500,
    message: error instanceof Error ? error.message : "unknown_error",
  })),
}));

const sessionMocks = vi.hoisted(() => ({
  clearOauthState: vi.fn(),
  clearPostAuthRedirect: vi.fn(),
  readOauthState: vi.fn(),
  readPostAuthRedirect: vi.fn(),
  setOauthState: vi.fn(),
  setPostAuthRedirect: vi.fn(),
}));

const proxyMocks = vi.hoisted(() => ({
  proxySecondMeJson: vi.fn(),
}));

const cryptoMocks = vi.hoisted(() => ({
  randomUUID: vi.fn(),
}));

vi.mock("node:crypto", async (importActual) => {
  const actual = await importActual<typeof import("node:crypto")>();
  return {
    ...actual,
    randomUUID: cryptoMocks.randomUUID,
  };
});

vi.mock("../apps/web/lib/secondme/auth", () => authMocks);
vi.mock("../apps/web/lib/secondme/session", () => sessionMocks);
vi.mock("../apps/web/lib/secondme/proxy", () => proxyMocks);

import { GET as getCallback } from "../apps/web/app/api/auth/callback/route";
import { GET as getLogin } from "../apps/web/app/api/auth/login/route";
import { GET as getSession } from "../apps/web/app/api/auth/session/route";
import { GET as getUserInfo } from "../apps/web/app/api/secondme/user/info/route";

describe("Second Me auth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    cryptoMocks.randomUUID.mockReturnValue("test-state");
    authMocks.buildSecondMeOauthUrl.mockReturnValue("https://go.second.me/oauth/?state=test-state");
    authMocks.getCurrentSecondMeSession.mockResolvedValue(null);
    authMocks.createSessionFromCode.mockResolvedValue(undefined);

    sessionMocks.setOauthState.mockResolvedValue(undefined);
    sessionMocks.setPostAuthRedirect.mockResolvedValue(undefined);
    sessionMocks.readPostAuthRedirect.mockResolvedValue("/match");
    sessionMocks.readOauthState.mockResolvedValue("cookie-state");
    sessionMocks.clearOauthState.mockResolvedValue(undefined);
    sessionMocks.clearPostAuthRedirect.mockResolvedValue(undefined);

    proxyMocks.proxySecondMeJson.mockResolvedValue(
      Response.json(
        {
          code: 401,
          message: "Second Me 未登录",
        },
        { status: 401 },
      ),
    );
  });

  it("returns an unauthenticated session before login", async () => {
    const response = await getSession();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      authenticated: false,
      user: null,
      scope: [],
      expiresAt: null,
    });
    expect(authMocks.getCurrentSecondMeSession).toHaveBeenCalledTimes(1);
  });

  it("redirects login requests to the Second Me OAuth endpoint", async () => {
    const request = new Request("http://localhost:3000/api/auth/login?next=/match");

    const response = await getLogin(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://go.second.me/oauth/?state=test-state");
    expect(sessionMocks.setOauthState).toHaveBeenCalledWith("test-state");
    expect(sessionMocks.setPostAuthRedirect).toHaveBeenCalledWith("/match");
    expect(authMocks.buildSecondMeOauthUrl).toHaveBeenCalledWith("test-state");
  });

  it("protects the upstream proxy when no session exists", async () => {
    const response = await getUserInfo();

    expect(proxyMocks.proxySecondMeJson).toHaveBeenCalledWith("/api/secondme/user/info", {
      method: "GET",
    });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: 401,
      message: "Second Me 未登录",
    });
  });

  it("returns a safe redirect when callback misses the authorization code", async () => {
    const request = new Request("http://localhost:3000/api/auth/callback");

    const response = await getCallback(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/?authError=missing_code");
    expect(sessionMocks.clearOauthState).toHaveBeenCalledTimes(1);
    expect(sessionMocks.clearPostAuthRedirect).toHaveBeenCalledTimes(1);
    expect(authMocks.createSessionFromCode).not.toHaveBeenCalled();
  });
});
