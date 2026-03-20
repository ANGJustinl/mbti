import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../apps/web/lib/db";
import { loadQuestions } from "../apps/web/lib/loaders";
import {
  advanceSandboxRound,
  confirmReconnect,
  ensureWorkflowSeedData,
  finalizeSandboxSession,
  listPlazaFeed,
  publishPlazaListing,
  resetWorkflowData,
  sendMatchSignal,
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

describe("plaza conversion", () => {
  beforeEach(async () => {
    await resetWorkflowData();
    await ensureWorkflowSeedData();
  });

  it("supplements live feed with agent users when human supply is insufficient", async () => {
    await submitAssessment({
      userId: "human-a",
      name: "Human A",
      answers: await buildAnswers(),
    });

    const feed = await listPlazaFeed("human-a");
    expect(feed.length).toBeGreaterThan(0);
    expect(feed.every((item) => item.listing.userKind === "agent")).toBe(true);
  });

  it("supports direct return selection and records conversion analytics", async () => {
    await submitAssessment({
      userId: "human-a",
      name: "Human A",
      answers: await buildAnswers(),
    });
    await submitAssessment({
      userId: "human-b",
      name: "Human B",
      answers: await buildAnswers(),
    });

    await publishPlazaListing({
      userId: "human-a",
      enabled: true,
    });
    await publishPlazaListing({
      userId: "human-b",
      enabled: true,
    });

    const first = await sendMatchSignal({
      fromUserId: "human-b",
      toUserId: "human-a",
      sourcePage: "/match",
    });
    expect(first.state).toBe("pending");

    const feed = await listPlazaFeed("human-a");
    expect(feed[0]?.listing.userId).toBe("human-b");
    expect(feed[0]?.relationship).toBe("incoming");

    const returned = await sendMatchSignal({
      fromUserId: "human-a",
      toUserId: "human-b",
      sourcePage: "/me",
    });
    expect(returned.state).toBe("mutual");
    expect(returned.sessionId).toBeTruthy();

    const events = await prisma.analyticsEvent.findMany({
      orderBy: {
        createdAt: "asc",
      },
    });
    expect(events.map((event) => event.name)).toEqual([
      "signal_sent",
      "signal_returned",
      "match_mutual",
    ]);
    expect(events[1]?.sourcePage).toBe("/me");
    expect(events[2]?.sessionId).toBe(returned.sessionId);
  });

  it("shows an agent proxy card instead of human contact info after reconnect", async () => {
    await submitAssessment({
      userId: "demo-you",
      answers: await buildAnswers(),
    });

    for (const candidateId of ["candidate-chen", "candidate-lin", "candidate-song"]) {
      const started = await startMatch({
        userId: "demo-you",
        targetProfileId: candidateId,
      });

      await advanceSandboxRound({ sessionId: started.session.sessionId, roundIndex: 1 });
      await advanceSandboxRound({ sessionId: started.session.sessionId, roundIndex: 2 });
      await advanceSandboxRound({ sessionId: started.session.sessionId, roundIndex: 3 });

      const finalized = await finalizeSandboxSession({ sessionId: started.session.sessionId });
      if (finalized.session.state === "filtered_out") {
        continue;
      }

      await confirmReconnect({
        sessionId: started.session.sessionId,
        userId: "demo-you",
        confirmed: true,
      });
      const exchanged = await confirmReconnect({
        sessionId: started.session.sessionId,
        userId: candidateId,
        confirmed: true,
      });

      expect(exchanged.cards.some((card) => card.contactKind === "agent_proxy")).toBe(true);
      expect(
        exchanged.cards.some((card) => card.contactValue?.startsWith("dualcore://agent/")),
      ).toBe(true);
      return;
    }

    throw new Error("expected at least one compatible agent candidate");
  });
});
