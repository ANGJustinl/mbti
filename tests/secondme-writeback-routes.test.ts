import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  readSecondMeSession: vi.fn(),
}));

const profileMocks = vi.hoisted(() => ({
  syncSecondMeProfileSnapshot: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  ingestSecondMeMemory: vi.fn(),
  writeSecondMeNote: vi.fn(),
  runSecondMeActJson: vi.fn(),
}));

vi.mock("../apps/web/lib/secondme/session", () => ({
  readSecondMeSession: sessionMocks.readSecondMeSession,
}));

vi.mock("../apps/web/lib/secondme/profile", () => ({
  syncSecondMeProfileSnapshot: profileMocks.syncSecondMeProfileSnapshot,
}));

vi.mock("../apps/web/lib/secondme/auth", () => ({
  ingestSecondMeMemory: authMocks.ingestSecondMeMemory,
  writeSecondMeNote: authMocks.writeSecondMeNote,
  runSecondMeActJson: authMocks.runSecondMeActJson,
}));

import { POST as writebackRoute } from "../apps/web/app/api/secondme/writeback/route";
import { loadQuestions } from "../apps/web/lib/loaders";
import {
  ensureWorkflowSeedData,
  getSecondMeWorkspaceStatus,
  resetWorkflowData,
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

describe("Second Me writeback route", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    profileMocks.syncSecondMeProfileSnapshot.mockResolvedValue(null);
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
    authMocks.runSecondMeActJson.mockRejectedValue(new Error("Second Me unavailable in tests"));
    await resetWorkflowData();
    await ensureWorkflowSeedData();
  });

  it("skips writeback without calling upstream when consent is denied", async () => {
    const assessment = await submitAssessment({
      userId: "sm:casey",
      name: "Casey",
      roleTag: "Second Me 用户",
      answers: await buildAnswers(),
    });

    const response = await writebackRoute(
      new Request("http://localhost/api/secondme/writeback", {
        method: "POST",
        body: JSON.stringify({
          milestone: "assessment_completed",
          assessmentId: assessment.assessmentId,
          consented: false,
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await unwrap<{
      milestone: string;
      status: string;
    }>(response);
    expect(payload.data).toMatchObject({
      milestone: "assessment_completed",
      status: "skipped",
    });
    expect(authMocks.ingestSecondMeMemory).not.toHaveBeenCalled();

    const status = await getSecondMeWorkspaceStatus("sm:casey");
    expect(status.pendingWritebacks).toHaveLength(0);
    expect(status.recentWritebacks[0]?.status).toBe("skipped");
  });

  it("writes assessment memory upstream after consent", async () => {
    authMocks.ingestSecondMeMemory.mockResolvedValue({
      data: { eventId: 1, isDuplicate: false },
    });

    const assessment = await submitAssessment({
      userId: "sm:casey",
      name: "Casey",
      roleTag: "Second Me 用户",
      answers: await buildAnswers(),
    });

    const response = await writebackRoute(
      new Request("http://localhost/api/secondme/writeback", {
        method: "POST",
        body: JSON.stringify({
          milestone: "assessment_completed",
          assessmentId: assessment.assessmentId,
          consented: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await unwrap<{
      milestone: string;
      status: string;
    }>(response);
    expect(payload.data).toMatchObject({
      milestone: "assessment_completed",
      status: "synced",
    });
    expect(authMocks.ingestSecondMeMemory).toHaveBeenCalledTimes(1);
  });
});
