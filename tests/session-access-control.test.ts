import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  readSecondMeSession: vi.fn(),
}));

vi.mock("../apps/web/lib/secondme/session", () => ({
  readSecondMeSession: sessionMocks.readSecondMeSession,
}));

import { POST as reconnectRoute } from "../apps/web/app/api/reconnect/confirm/route";
import { POST as advanceRoundRoute } from "../apps/web/app/api/sandbox/round/route";
import { getReconnectPayload, resetWorkflowData, startMatch, submitAssessment, advanceSandboxRound, finalizeSandboxSession, ensureWorkflowSeedData } from "../apps/web/lib/workflow";
import { loadQuestions } from "../apps/web/lib/loaders";

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

describe("session access control", () => {
  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    vi.clearAllMocks();
    sessionMocks.readSecondMeSession.mockResolvedValue(null);
    await resetWorkflowData();
    await ensureWorkflowSeedData();
  });

  it("rejects sandbox access from a non-participant current user", async () => {
    await submitAssessment({
      userId: "demo-you",
      answers: await buildAnswers(),
    });
    const started = await startMatch({
      userId: "demo-you",
      targetProfileId: "candidate-chen",
    });

    sessionMocks.readSecondMeSession.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: Date.now() + 60_000,
      scope: ["user.info"],
      user: {
        secondmeUserId: "intruder",
        name: "Intruder",
      },
    });

    const response = await advanceRoundRoute(
      new Request("http://localhost/api/sandbox/round", {
        method: "POST",
        body: JSON.stringify({
          sessionId: started.session.sessionId,
          roundIndex: 1,
        }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(unwrap(response)).resolves.toMatchObject({
      status: "error",
      error: {
        message: "forbidden",
      },
    });
  });

  it("does not let a normal Second Me user confirm on behalf of the counterpart", async () => {
    await submitAssessment({
      userId: "sm:casey",
      answers: await buildAnswers(),
    });
    const started = await startMatch({
      userId: "sm:casey",
      targetProfileId: "candidate-chen",
    });
    await advanceSandboxRound({ sessionId: started.session.sessionId, roundIndex: 1 });
    await advanceSandboxRound({ sessionId: started.session.sessionId, roundIndex: 2 });
    await advanceSandboxRound({ sessionId: started.session.sessionId, roundIndex: 3 });

    const finalized = await finalizeSandboxSession({ sessionId: started.session.sessionId });
    if (finalized.session.state === "filtered_out") {
      return;
    }

    sessionMocks.readSecondMeSession.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: Date.now() + 60_000,
      scope: ["user.info"],
      user: {
        secondmeUserId: "casey",
        name: "Casey",
      },
    });

    const response = await reconnectRoute(
      new Request("http://localhost/api/reconnect/confirm", {
        method: "POST",
        body: JSON.stringify({
          sessionId: started.session.sessionId,
          actorUserId: "candidate-chen",
          confirmed: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await unwrap<{
      state: string;
      cards: Array<{ contactValue?: string }>;
    }>(response);
    expect(payload.data?.state).toBe("reconnect_ready");
    expect(payload.data?.cards.every((card) => !card.contactValue)).toBe(true);

    const reconnect = await getReconnectPayload(started.session.sessionId, "sm:casey");
    expect(reconnect?.decisions).toMatchObject({
      "sm:casey": true,
      "candidate-chen": false,
    });
  });
});
