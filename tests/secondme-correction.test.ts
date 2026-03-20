import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../apps/web/lib/db";
import { ensureSecondMeWriteback } from "../apps/web/lib/secondme/writeback";

const profileMocks = vi.hoisted(() => ({
  syncSecondMeProfileSnapshot: vi.fn(),
}));

vi.mock("../apps/web/lib/secondme/profile", () => ({
  syncSecondMeProfileSnapshot: profileMocks.syncSecondMeProfileSnapshot,
}));

import { loadQuestions } from "../apps/web/lib/loaders";
import {
  ensureWorkflowSeedData,
  getCurrentUserProfile,
  getSecondMeWorkspaceStatus,
  resetWorkflowData,
  submitAssessment,
} from "../apps/web/lib/workflow";

async function buildLowConfidenceEnergyAnswers() {
  const questions = await loadQuestions();
  const energyIds = questions.filter((question) => question.dimension === "energy").map((question) => question.id);
  const answerMap = new Map<string, "A" | "B">();

  for (const [index, questionId] of energyIds.entries()) {
    answerMap.set(questionId, index < 6 ? "A" : "B");
  }

  return questions.map((question) => {
    if (answerMap.has(question.id)) {
      return {
        questionId: question.id,
        optionKey: answerMap.get(question.id)!,
      };
    }

    return {
      questionId: question.id,
      optionKey:
        question.dimension === "perception"
          ? ("B" as const)
          : ("A" as const),
    };
  });
}

describe("Second Me assessment correction", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    profileMocks.syncSecondMeProfileSnapshot.mockResolvedValue(null);
    await resetWorkflowData();
    await ensureWorkflowSeedData();
  });

  it("stores base/effective profile results and creates an assessment writeback prompt", async () => {
    profileMocks.syncSecondMeProfileSnapshot.mockResolvedValue({
      fetchedAt: "2026-03-19T12:00:00.000Z",
      shades: [],
      softMemory: [],
      signals: {
        fetchedAt: "2026-03-19T12:00:00.000Z",
        sourceSummary: "Second Me 侧写显示该用户更习惯先独处整理再表达。",
        collaborationSignals: ["更偏好先独立梳理问题，再进入同步。"],
        axisHints: [
          {
            dimension: "energy",
            code: "I",
            confidence: 0.91,
            evidence: ["更常以独处整理信息后再表达立场"],
          },
        ],
      },
    });

    const result = await submitAssessment({
      userId: "sm:casey",
      name: "Casey",
      roleTag: "已连接 Second Me 的测试用户",
      answers: await buildLowConfidenceEnergyAnswers(),
    });

    expect(result.baseProfile.wmti.letters).toBe("ENTJ");
    expect(result.effectiveProfile.wmti.letters).toBe("INTJ");
    expect(result.correction?.correctedAxes).toHaveLength(1);
    expect(result.card.profile.secondMeReview?.enabled).toBe(true);
    expect(result.writebackPrompt?.milestone).toBe("assessment_completed");

    const payload = await getCurrentUserProfile("sm:casey");
    expect(payload?.profile.baseWmti?.letters).toBe("ENTJ");
    expect(payload?.profile.wmti.letters).toBe("INTJ");
    expect(payload?.profile.secondMeReview?.correction?.correctedAxes[0]?.dimension).toBe("energy");

    const secondMeStatus = await getSecondMeWorkspaceStatus("sm:casey");
    expect(secondMeStatus.pendingWritebacks).toHaveLength(1);
    expect(secondMeStatus.pendingWritebacks[0]?.milestone).toBe("assessment_completed");
    expect(secondMeStatus.pendingWritebacks[0]?.summaryLines).toContain("当前协作像：INTJ");
  });

  it("refreshes pending assessment writeback previews from the latest corrected profile", async () => {
    profileMocks.syncSecondMeProfileSnapshot.mockResolvedValue({
      fetchedAt: "2026-03-19T12:00:00.000Z",
      shades: [],
      softMemory: [],
      signals: {
        fetchedAt: "2026-03-19T12:00:00.000Z",
        sourceSummary: "Second Me 侧写显示该用户更习惯先独处整理再表达。",
        collaborationSignals: ["更偏好先独立梳理问题，再进入同步。"],
        axisHints: [
          {
            dimension: "energy",
            code: "I",
            confidence: 0.91,
            evidence: ["更常以独处整理信息后再表达立场"],
          },
        ],
      },
    });

    const result = await submitAssessment({
      userId: "sm:casey",
      name: "Casey",
      roleTag: "已连接 Second Me 的测试用户",
      answers: await buildLowConfidenceEnergyAnswers(),
    });

    const pending = await prisma.secondMeWriteback.findFirstOrThrow({
      where: {
        userId: "sm:casey",
        milestone: "assessment_completed",
        assessmentId: result.assessmentId,
      },
    });

    await prisma.secondMeWriteback.update({
      where: { id: pending.id },
      data: {
        previewJson: JSON.stringify({
          title: "写入本次双核测评",
          description: "会把这次量表结果与协作像复核摘要写进你的 Second Me 记忆里。",
          summaryLines: ["原始量表：ESTJ", "当前协作像：ESTJ"],
        }),
      },
    });

    const refreshed = await ensureSecondMeWriteback({
      userId: "sm:casey",
      milestone: "assessment_completed",
      assessmentId: result.assessmentId,
    });

    expect(refreshed?.summaryLines).toContain("当前协作像：INTJ");

    const workspace = await getSecondMeWorkspaceStatus("sm:casey");
    expect(workspace.pendingWritebacks[0]?.summaryLines).toContain("当前协作像：INTJ");
  });
});
