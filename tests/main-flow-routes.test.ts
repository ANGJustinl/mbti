import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  readSecondMeSession: vi.fn(),
}));

vi.mock("../apps/web/lib/secondme/session", () => ({
  readSecondMeSession: sessionMocks.readSecondMeSession,
}));

import { loadQuestions } from "../apps/web/lib/loaders";
import { ensureWorkflowSeedData, resetWorkflowData } from "../apps/web/lib/workflow";
import { POST as submitAssessmentRoute } from "../apps/web/app/api/assessment/submit/route";
import { POST as startMatchRoute } from "../apps/web/app/api/match/start/route";
import { POST as advanceRoundRoute } from "../apps/web/app/api/sandbox/round/route";
import { POST as finalizeRoute } from "../apps/web/app/api/sandbox/finalize/route";
import { POST as reconnectRoute } from "../apps/web/app/api/reconnect/confirm/route";
import { POST as drawRoute } from "../apps/web/app/api/draw/route";

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

describe("main flow routes", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionMocks.readSecondMeSession.mockResolvedValue(null);
    await resetWorkflowData();
    await ensureWorkflowSeedData();
  });

  it("rejects incomplete assessments", async () => {
    const questions = await loadQuestions();
    const response = await submitAssessmentRoute(
      new Request("http://localhost/api/assessment/submit?demo=1", {
        method: "POST",
        body: JSON.stringify({
          answers: [{ questionId: questions[0].id, optionKey: "A" }],
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(unwrap(response)).resolves.toMatchObject({
      status: "error",
      error: {
        message: `answers must include ${questions.length} items`,
      },
    });
  });

  it("runs the complete happy path from assessment to reconnect", async () => {
    const assessmentResponse = await submitAssessmentRoute(
      new Request("http://localhost/api/assessment/submit?demo=1", {
        method: "POST",
        body: JSON.stringify({
          meta: { name: "你" },
          answers: await buildAnswers(),
        }),
      }),
    );

    expect(assessmentResponse.status).toBe(200);
    const assessmentPayload = await unwrap<{
      state: string;
      card: { profile: { wmti: { letters: string } } };
    }>(assessmentResponse);
    expect(assessmentPayload.data?.state).toBe("assessed");
    expect(assessmentPayload.data?.card.profile.wmti.letters.length).toBe(4);

    const matchResponse = await startMatchRoute(
      new Request("http://localhost/api/match/start?demo=1", {
        method: "POST",
        body: JSON.stringify({
          targetProfileId: "candidate-chen",
        }),
      }),
    );
    const matchPayload = await unwrap<{
      session: { sessionId: string };
    }>(matchResponse);
    expect(matchResponse.status).toBe(200);

    const sessionId = matchPayload.data?.session.sessionId;
    expect(sessionId).toBeTruthy();

    for (const roundIndex of [1, 2, 3]) {
      const roundResponse = await advanceRoundRoute(
        new Request("http://localhost/api/sandbox/round?demo=1", {
          method: "POST",
          body: JSON.stringify({
            sessionId,
            roundIndex,
          }),
        }),
      );
      expect(roundResponse.status).toBe(200);
    }

    const finalizeResponse = await finalizeRoute(
      new Request("http://localhost/api/sandbox/finalize?demo=1", {
        method: "POST",
        body: JSON.stringify({
          sessionId,
        }),
      }),
    );
    const finalized = await unwrap<{
      session: { state: string };
      manual: { summary: string };
    }>(finalizeResponse);
    expect(finalizeResponse.status).toBe(200);
    expect(finalized.data?.manual.summary).toBeTruthy();

    if (finalized.data?.session.state === "filtered_out") {
      const blockedReconnect = await reconnectRoute(
        new Request("http://localhost/api/reconnect/confirm?demo=1", {
          method: "POST",
          body: JSON.stringify({
            sessionId,
            confirmed: true,
          }),
        }),
      );
      expect(blockedReconnect.status).toBe(400);
      return;
    }

    const firstReconnect = await reconnectRoute(
      new Request("http://localhost/api/reconnect/confirm?demo=1", {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          confirmed: true,
        }),
      }),
    );
    const firstPayload = await unwrap<{
      state: string;
      cards: Array<{ contactValue?: string }>;
    }>(firstReconnect);
    expect(firstReconnect.status).toBe(200);
    expect(firstPayload.data?.state).toBe("reconnect_ready");
    expect(firstPayload.data?.cards.every((card) => !card.contactValue)).toBe(true);

    const secondReconnect = await reconnectRoute(
      new Request("http://localhost/api/reconnect/confirm?demo=1&actor=candidate-chen", {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          confirmed: true,
        }),
      }),
    );
    const secondPayload = await unwrap<{
      state: string;
      cards: Array<{ contactValue?: string }>;
    }>(secondReconnect);
    expect(secondReconnect.status).toBe(200);
    expect(secondPayload.data?.state).toBe("exchanged");
    expect(secondPayload.data?.cards.every((card) => card.contactValue)).toBe(true);
  });

  it("validates draw input", async () => {
    const failed = await drawRoute(
      new Request("http://localhost/api/draw", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(failed.status).toBe(400);

    const passed = await drawRoute(
      new Request("http://localhost/api/draw", {
        method: "POST",
        body: JSON.stringify({
          mood: "卡住了",
        }),
      }),
    );
    expect(passed.status).toBe(200);
  });
});
