import { describe, expect, it, beforeEach } from "vitest";

import { loadQuestions } from "../apps/web/lib/loaders";
import {
  advanceSandboxRound,
  assertSessionActor,
  confirmReconnect,
  ensureWorkflowSeedData,
  finalizeSandboxSession,
  getReconnectPayload,
  listUserSessions,
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

describe("workflow repository", () => {
  beforeEach(async () => {
    await resetWorkflowData();
    await ensureWorkflowSeedData();
  });

  it("rejects a match when the initiator has no assessment/profile", async () => {
    await expect(
      startMatch({
        userId: "fresh-user",
        targetProfileId: "candidate-chen",
      }),
    ).rejects.toThrow("profile is required before match");
  });

  it("persists a full session and requires sequential rounds", async () => {
    await submitAssessment({
      userId: "demo-you",
      answers: await buildAnswers(),
    });

    const started = await startMatch({
      userId: "demo-you",
      targetProfileId: "candidate-chen",
    });

    await expect(
      advanceSandboxRound({
        sessionId: started.session.sessionId,
        roundIndex: 3,
      }),
    ).rejects.toThrow("round must advance sequentially");

    await advanceSandboxRound({ sessionId: started.session.sessionId, roundIndex: 1 });
    await advanceSandboxRound({ sessionId: started.session.sessionId, roundIndex: 2 });
    const thirdRound = await advanceSandboxRound({
      sessionId: started.session.sessionId,
      roundIndex: 3,
    });

    expect(thirdRound.session.state).toBe("sandboxing");
    expect(thirdRound.round.roundIndex).toBe(3);
  });

  it("requires full sandbox before finalize and hides contacts until both confirm", async () => {
    await submitAssessment({
      userId: "demo-you",
      answers: await buildAnswers(),
    });

    const started = await startMatch({
      userId: "demo-you",
      targetProfileId: "candidate-chen",
    });

    await expect(
      finalizeSandboxSession({ sessionId: started.session.sessionId }),
    ).rejects.toThrow("session is not ready to finalize");

    await advanceSandboxRound({ sessionId: started.session.sessionId, roundIndex: 1 });
    await advanceSandboxRound({ sessionId: started.session.sessionId, roundIndex: 2 });
    await advanceSandboxRound({ sessionId: started.session.sessionId, roundIndex: 3 });

    const finalized = await finalizeSandboxSession({ sessionId: started.session.sessionId });
    expect(["reconnect_ready", "filtered_out"]).toContain(finalized.session.state);
    expect(finalized.manual.communicationRules.length).toBeGreaterThan(0);

    const reconnectPayload = await getReconnectPayload(started.session.sessionId, "demo-you");
    expect(reconnectPayload?.session.topic.title).toBeTruthy();
    expect(reconnectPayload?.session.topic.sourceUrl).toContain("zhihu.com");
    expect(Array.isArray(reconnectPayload?.session.conflictFlags)).toBe(true);

    if (finalized.session.state === "filtered_out") {
      await expect(
        confirmReconnect({
          sessionId: started.session.sessionId,
          userId: "demo-you",
          confirmed: true,
        }),
      ).rejects.toThrow("session can not exchange contacts");
      return;
    }

    const firstConfirm = await confirmReconnect({
      sessionId: started.session.sessionId,
      userId: "demo-you",
      confirmed: true,
    });
    expect(firstConfirm.state).toBe("reconnect_ready");
    expect(firstConfirm.cards.every((card) => !card.contactValue)).toBe(true);

    const secondConfirm = await confirmReconnect({
      sessionId: started.session.sessionId,
      userId: "candidate-chen",
      confirmed: true,
    });
    expect(secondConfirm.state).toBe("exchanged");
    expect(secondConfirm.cards.every((card) => card.contactValue?.startsWith("dualcore://profile/"))).toBe(true);
  });

  it("lists only the actor's sessions and rejects unrelated actors", async () => {
    await submitAssessment({
      userId: "demo-you",
      answers: await buildAnswers(),
    });
    await submitAssessment({
      userId: "fresh-user",
      answers: await buildAnswers(),
    });

    const demoSession = await startMatch({
      userId: "demo-you",
      targetProfileId: "candidate-chen",
    });
    await startMatch({
      userId: "fresh-user",
      targetProfileId: "candidate-lin",
    });

    const demoGroups = await listUserSessions("demo-you");
    expect(demoGroups.sandboxing).toHaveLength(1);
    expect(demoGroups.sandboxing[0]?.counterpart.userId).toBe("candidate-chen");

    await expect(
      assertSessionActor(demoSession.session.sessionId, "fresh-user"),
    ).rejects.toThrow("forbidden");
  });
});
