import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  readSecondMeSession: vi.fn(),
}));

vi.mock("../apps/web/lib/secondme/session", () => ({
  readSecondMeSession: sessionMocks.readSecondMeSession,
}));

import { GET as getMe } from "../apps/web/app/api/me/route";
import { GET as getMeProfile } from "../apps/web/app/api/me/profile/route";
import { GET as getMeSessions } from "../apps/web/app/api/me/sessions/route";
import { loadQuestions } from "../apps/web/lib/loaders";
import {
  ensureWorkflowSeedData,
  resetWorkflowData,
  startMatch,
  submitAssessment,
} from "../apps/web/lib/workflow";

async function buildAnswers() {
  const questions = await loadQuestions();
  return questions.map((question, index) => ({
    questionId: question.id,
    optionKey: index % 2 === 0 ? ("A" as const) : ("B" as const),
  }));
}

async function unwrap<T>(response: Response) {
  return (await response.json()) as {
    status: "ok" | "error";
    data?: T;
    error?: { message: string };
  };
}

describe("current user context and /api/me routes", () => {
  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    vi.clearAllMocks();
    sessionMocks.readSecondMeSession.mockResolvedValue(null);
    await resetWorkflowData();
    await ensureWorkflowSeedData();
  });

  it("returns a bound local user from a Second Me session", async () => {
    sessionMocks.readSecondMeSession.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: Date.now() + 60_000,
      scope: ["user.info"],
      user: {
        secondmeUserId: "casey",
        name: "Casey",
        route: "casey-route",
      },
    });

    const response = await getMe(new Request("http://localhost/api/me"));
    expect(response.status).toBe(200);

    const payload = await unwrap<{
      authenticated: boolean;
      currentUser: {
        userId: string;
        source: string;
        secondmeUserId?: string;
      } | null;
      hasProfile: boolean;
      needsAssessment: boolean;
    }>(response);

    expect(payload.data).toMatchObject({
      authenticated: true,
      currentUser: {
        userId: "sm:casey",
        source: "secondme",
        secondmeUserId: "casey",
      },
      hasProfile: false,
      needsAssessment: true,
    });
  });

  it("does not expose demo fallback outside development mode", async () => {
    process.env.NODE_ENV = "production";

    const response = await getMe(new Request("http://localhost/api/me?demo=1"));
    expect(response.status).toBe(200);

    const payload = await unwrap<{
      currentUser: unknown;
      authenticated: boolean;
      hasProfile: boolean;
      needsAssessment: boolean;
    }>(response);

    expect(payload.data).toEqual({
      authenticated: false,
      currentUser: null,
      hasProfile: false,
      needsAssessment: true,
    });
  });

  it("allows development demo fallback and returns the current demo card", async () => {
    const meResponse = await getMe(new Request("http://localhost/api/me?demo=1"));
    expect(meResponse.status).toBe(200);

    const mePayload = await unwrap<{
      currentUser: {
        userId: string;
        source: string;
        demoMode: boolean;
      } | null;
      hasProfile: boolean;
    }>(meResponse);

    expect(mePayload.data).toMatchObject({
      currentUser: {
        userId: "demo-you",
        source: "demo",
        demoMode: true,
      },
      hasProfile: true,
    });

    const profileResponse = await getMeProfile(new Request("http://localhost/api/me/profile?demo=1"));
    expect(profileResponse.status).toBe(200);
    const profilePayload = await unwrap<{
      card: { profile: { userId: string; wmti: { letters: string } } } | null;
    }>(profileResponse);

    expect(profilePayload.data?.card?.profile.userId).toBe("demo-you");
    expect(profilePayload.data?.card?.profile.wmti.letters).toHaveLength(4);
  });

  it("returns only the current user's sessions from /api/me/sessions", async () => {
    await submitAssessment({
      userId: "demo-you",
      answers: await buildAnswers(),
    });
    await submitAssessment({
      userId: "fresh-user",
      answers: await buildAnswers(),
    });

    await startMatch({
      userId: "demo-you",
      targetProfileId: "candidate-chen",
    });
    await startMatch({
      userId: "fresh-user",
      targetProfileId: "candidate-lin",
    });

    const response = await getMeSessions(new Request("http://localhost/api/me/sessions?demo=1"));
    expect(response.status).toBe(200);

    const payload = await unwrap<{
      totalCount: number;
      groups: {
        sandboxing: Array<{ counterpart: { userId: string } }>;
      };
    }>(response);

    expect(payload.data?.totalCount).toBe(1);
    expect(payload.data?.groups.sandboxing).toHaveLength(1);
    expect(payload.data?.groups.sandboxing[0]?.counterpart.userId).toBe("candidate-chen");
  });
});
