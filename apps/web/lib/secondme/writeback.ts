import type {
  PersonalityProfile,
  Recommendation,
  SecondMeWritebackMilestone,
  SecondMeWritebackPreview,
} from "@dual-core/domain";

import { prisma } from "../db";
import { SECOND_ME_USER_PREFIX } from "../current-user";
import { ingestSecondMeMemory, writeSecondMeNote } from "./auth";

type WritebackRecord = Awaited<ReturnType<typeof prisma.secondMeWriteback.findUnique>>;

function json<T>(value: T) {
  return JSON.stringify(value);
}

function parse<T>(value: string | null | undefined): T | null {
  if (!value) {
    return null;
  }

  return JSON.parse(value) as T;
}

function isSecondMeUserId(userId: string) {
  return userId.startsWith(SECOND_ME_USER_PREFIX);
}

function buildTargetKey(input: {
  milestone: SecondMeWritebackMilestone;
  assessmentId?: string;
  sessionId?: string;
}) {
  return [input.milestone, input.assessmentId ?? "na", input.sessionId ?? "na"].join(":");
}

function recommendationLabel(value: Recommendation) {
  switch (value) {
    case "continue":
      return "建议继续靠近";
    case "cautious":
      return "建议明确边界后继续";
    case "terminate":
      return "建议终止连接";
  }
}

function toPreview(record: NonNullable<WritebackRecord>): SecondMeWritebackPreview {
  const preview = parse<Omit<SecondMeWritebackPreview, "status" | "consented" | "lastError" | "writtenAt">>(
    record.previewJson,
  );

  return {
    targetKey: record.targetKey,
    milestone: record.milestone as SecondMeWritebackMilestone,
    sessionId: record.sessionId ?? undefined,
    assessmentId: record.assessmentId ?? undefined,
    title: preview?.title ?? "Second Me 写回",
    description: preview?.description ?? "将本次结果写回到你的 Second Me。",
    summaryLines: preview?.summaryLines ?? [],
    status: record.status as SecondMeWritebackPreview["status"],
    consented: record.consented,
    lastError: record.errorMessage ?? undefined,
    writtenAt: record.writtenAt?.toISOString(),
  };
}

async function buildAssessmentArtifacts(userId: string, assessmentId: string) {
  const assessment = await prisma.assessmentSubmission.findUnique({
    where: { id: assessmentId },
    include: {
      user: true,
    },
  });
  const profile = await prisma.personalityProfile.findUnique({
    where: { userId },
  });

  if (!assessment || !profile || assessment.userId !== userId) {
    throw new Error("assessment not found");
  }

  const baseWmti = parse<{ letters: string }>(profile.baseWmtiJson) ?? parse<{ letters: string }>(profile.wmtiJson);
  const effectiveWmti = parse<{ letters: string }>(profile.wmtiJson);
  const correction = parse<{ correctedAxes?: Array<{ dimension: string; baseCode: string; effectiveCode: string }> }>(
    profile.correctionJson,
  );
  const summaryLines = [
    `原始量表：${baseWmti?.letters ?? profile.wmtiLetters}`,
    `当前协作像：${effectiveWmti?.letters ?? profile.wmtiLetters}`,
    `${profile.lifeModeTitle} / ${profile.workModeTitle}`,
  ];

  if (correction?.correctedAxes?.length) {
    summaryLines.push(
      `复核维度：${correction.correctedAxes
        .map((axis) => `${axis.dimension} ${axis.baseCode}->${axis.effectiveCode}`)
        .join("、")}`,
    );
  }

  return {
    preview: {
      title: "写入本次双核测评",
      description: "会把这次量表结果与协作像复核摘要写进你的 Second Me 记忆里。",
      summaryLines,
    },
    payload: {
      channel: {
        kind: "profile",
        id: userId,
        url: `dualcore://profile/${userId}`,
        meta: {
          milestone: "assessment_completed",
        },
      },
      action: "assessment_completed",
      actionLabel: "Completed W-MBTI assessment",
      displayText: `${assessment.user.name} 完成了双核测评，当前协作像为 ${effectiveWmti?.letters ?? profile.wmtiLetters}`,
      eventDesc: "Dual Core Workplace assessment completed",
      importance: 0.78,
      idempotencyKey: buildTargetKey({ milestone: "assessment_completed", assessmentId }),
      refs: [
        {
          objectType: "assessment",
          objectId: assessmentId,
          url: `dualcore://assessment/${assessmentId}`,
          contentPreview: summaryLines.join(" | "),
          snapshot: {
            text: summaryLines.join("\n"),
            capturedAt: Date.now(),
          },
        },
      ],
      payload: {
        baseLetters: baseWmti?.letters ?? profile.wmtiLetters,
        effectiveLetters: effectiveWmti?.letters ?? profile.wmtiLetters,
        correctedAxes: correction?.correctedAxes ?? [],
      },
    },
  };
}

async function buildSessionArtifacts(
  userId: string,
  sessionId: string,
  milestone: Extract<SecondMeWritebackMilestone, "sandbox_finalized" | "manual_generated" | "reconnect_exchanged">,
) {
  const session = await prisma.sandboxSession.findUnique({
    where: { id: sessionId },
    include: {
      manual: true,
      reconnectDecisions: true,
      rounds: {
        orderBy: {
          roundIndex: "asc",
        },
      },
    },
  });

  if (!session || (session.userId !== userId && session.targetUserId !== userId)) {
    throw new Error("session not found");
  }

  const counterpartId = session.userId === userId ? session.targetUserId : session.userId;
  const counterpart = await prisma.user.findUnique({
    where: { id: counterpartId },
  });

  const commonLines = [
    `题目：${session.topicTitle}`,
    `兼容度：${session.fitScore ?? 0}/100`,
    `结论：${recommendationLabel((session.recommendation ?? "cautious") as Recommendation)}`,
    counterpart ? `协作对象：${counterpart.name}` : null,
  ].filter(Boolean) as string[];

  if (milestone === "sandbox_finalized") {
    return {
      preview: {
        title: "写入本次沙盘结论",
        description: "会把这次沙盘题目、兼容度和判定结论写入你的 Second Me 记忆里。",
        summaryLines: commonLines,
      },
      payload: {
        channel: {
          kind: "thread",
          id: sessionId,
          url: `dualcore://arena/${sessionId}`,
          meta: {
            milestone,
          },
        },
        action: "sandbox_finalized",
        actionLabel: "Finalized collaboration sandbox",
        displayText: `完成了关于「${session.topicTitle}」的协作沙盘，结论为 ${recommendationLabel((session.recommendation ?? "cautious") as Recommendation)}`,
        eventDesc: "Dual Core Workplace sandbox finalized",
        importance: 0.8,
        idempotencyKey: buildTargetKey({ milestone, sessionId }),
        refs: [
          {
            objectType: "sandbox_session",
            objectId: sessionId,
            url: `dualcore://arena/${sessionId}`,
            contentPreview: commonLines.join(" | "),
            snapshot: {
              text: [
                ...commonLines,
                ...session.rounds.map((round) => `Round ${round.roundIndex}: ${round.observerNote}`),
              ].join("\n"),
              capturedAt: Date.now(),
            },
          },
        ],
        payload: {
          topicTitle: session.topicTitle,
          fitScore: session.fitScore,
          recommendation: session.recommendation,
        },
      },
    };
  }

  if (!session.manual) {
    throw new Error("manual not found");
  }

  const manualSummary = [
    session.manual.summary,
    ...(parse<string[]>(session.manual.communicationRulesJson) ?? []).slice(0, 2),
  ];

  if (milestone === "manual_generated") {
    return {
      preview: {
        title: "写入本次协作说明书",
        description: "会把这份说明书的摘要和关键协作规则写回你的 Second Me。",
        summaryLines: manualSummary,
      },
      payload: {
        channel: {
          kind: "thread",
          id: sessionId,
          url: `dualcore://reconnect/${sessionId}`,
          meta: {
            milestone,
          },
        },
        action: "manual_generated",
        actionLabel: "Generated collaboration manual",
        displayText: `生成了「${session.topicTitle}」对应的协作说明书`,
        eventDesc: "Dual Core Workplace collaboration manual generated",
        importance: 0.74,
        idempotencyKey: buildTargetKey({ milestone, sessionId }),
        refs: [
          {
            objectType: "collaboration_manual",
            objectId: sessionId,
            url: `dualcore://reconnect/${sessionId}`,
            contentPreview: manualSummary.join(" | "),
            snapshot: {
              text: manualSummary.join("\n"),
              capturedAt: Date.now(),
            },
          },
        ],
        payload: {
          topicTitle: session.topicTitle,
          manualSummary: session.manual.summary,
          communicationRules: parse<string[]>(session.manual.communicationRulesJson) ?? [],
        },
      },
      note: {
        title: `双核职场协作说明书：${session.topicTitle}`,
        content: manualSummary.join("\n"),
        memoryType: "TEXT" as const,
      },
    };
  }

  const exchanged = session.reconnectDecisions.every((decision) => decision.confirmed)
    && session.reconnectDecisions.length >= 2;
  const exchangeLines = [
    ...commonLines,
    exchanged ? "双方已确认交换数字名片" : "连接已进入确认阶段",
  ];

  return {
    preview: {
      title: "写入本次连接确认",
      description: "会把这次从虚拟协作走向现实连接的确认结果写进你的 Second Me 记忆。",
      summaryLines: exchangeLines,
    },
    payload: {
      channel: {
        kind: "thread",
        id: sessionId,
        url: `dualcore://reconnect/${sessionId}`,
        meta: {
          milestone,
        },
      },
      action: "reconnect_exchanged",
      actionLabel: "Confirmed collaboration reconnect",
      displayText: counterpart
        ? `与 ${counterpart.name} 完成了双向确认，数字名片已解锁`
        : "完成了双向确认，数字名片已解锁",
      eventDesc: "Dual Core Workplace reconnect exchanged",
      importance: 0.86,
      idempotencyKey: buildTargetKey({ milestone, sessionId }),
      refs: [
        {
          objectType: "reconnect",
          objectId: sessionId,
          url: `dualcore://reconnect/${sessionId}`,
          contentPreview: exchangeLines.join(" | "),
          snapshot: {
            text: exchangeLines.join("\n"),
            capturedAt: Date.now(),
          },
        },
      ],
      payload: {
        topicTitle: session.topicTitle,
        counterpartName: counterpart?.name ?? null,
        exchanged,
      },
    },
  };
}

async function buildArtifacts(input: {
  userId: string;
  milestone: SecondMeWritebackMilestone;
  assessmentId?: string;
  sessionId?: string;
}) {
  if (input.milestone === "assessment_completed") {
    if (!input.assessmentId) {
      throw new Error("assessmentId is required");
    }

    return buildAssessmentArtifacts(input.userId, input.assessmentId);
  }

  if (!input.sessionId) {
    throw new Error("sessionId is required");
  }

  return buildSessionArtifacts(input.userId, input.sessionId, input.milestone);
}

async function refreshPendingPreview(record: NonNullable<WritebackRecord>) {
  if (record.status !== "pending") {
    return record;
  }

  const artifacts = await buildArtifacts({
    userId: record.userId,
    milestone: record.milestone as SecondMeWritebackMilestone,
    assessmentId: record.assessmentId ?? undefined,
    sessionId: record.sessionId ?? undefined,
  }).catch(() => null);

  if (!artifacts) {
    return record;
  }

  return prisma.secondMeWriteback.update({
    where: { id: record.id },
    data: {
      previewJson: json(artifacts.preview),
      errorMessage: null,
    },
  });
}

export async function ensureSecondMeWriteback(input: {
  userId: string;
  milestone: SecondMeWritebackMilestone;
  assessmentId?: string;
  sessionId?: string;
}) {
  if (!isSecondMeUserId(input.userId)) {
    return null;
  }

  const targetKey = buildTargetKey(input);
  const existing = await prisma.secondMeWriteback.findUnique({
    where: { targetKey },
  });
  if (existing) {
    const refreshed = await refreshPendingPreview(existing);
    return toPreview(refreshed);
  }

  const artifacts = await buildArtifacts(input);
  const created = await prisma.secondMeWriteback.create({
    data: {
      targetKey,
      userId: input.userId,
      sessionId: input.sessionId,
      assessmentId: input.assessmentId,
      milestone: input.milestone,
      previewJson: json(artifacts.preview),
      payloadJson: null,
      consented: false,
      status: "pending",
    },
  });

  return toPreview(created);
}

export async function listSecondMeWritebacks(userId: string) {
  if (!isSecondMeUserId(userId)) {
    return {
      pending: [] as SecondMeWritebackPreview[],
      recent: [] as SecondMeWritebackPreview[],
    };
  }

  const records = await prisma.secondMeWriteback.findMany({
    where: { userId },
    orderBy: {
      updatedAt: "desc",
    },
    take: 10,
  });
  const hydrated = await Promise.all(records.map((record) => refreshPendingPreview(record)));

  return {
    pending: hydrated.filter((record) => record.status === "pending").map(toPreview),
    recent: hydrated.filter((record) => record.status !== "pending").slice(0, 3).map(toPreview),
  };
}

export async function processSecondMeWriteback(input: {
  userId: string;
  milestone: SecondMeWritebackMilestone;
  consented: boolean;
  assessmentId?: string;
  sessionId?: string;
}) {
  if (!isSecondMeUserId(input.userId)) {
    throw new Error("Second Me writeback is unavailable");
  }

  const targetKey = buildTargetKey(input);
  const existing = await prisma.secondMeWriteback.findUnique({
    where: { targetKey },
  });
  const preview = existing ?? (await ensureSecondMeWriteback(input).then(async () => prisma.secondMeWriteback.findUnique({
    where: { targetKey },
  })));

  if (!preview) {
    throw new Error("writeback target not found");
  }

  if (!input.consented) {
    const skipped = await prisma.secondMeWriteback.update({
      where: { targetKey },
      data: {
        consented: false,
        status: "skipped",
        errorMessage: null,
      },
    });

    return toPreview(skipped);
  }

  const artifacts = await buildArtifacts(input);

  try {
    await ingestSecondMeMemory(artifacts.payload);
    let noteError: string | null = null;

    if ("note" in artifacts && artifacts.note) {
      await writeSecondMeNote(artifacts.note).catch((error) => {
        noteError = error instanceof Error ? error.message : "Second Me note.add failed";
      });
    }

    const synced = await prisma.secondMeWriteback.update({
      where: { targetKey },
      data: {
        consented: true,
        status: "synced",
        payloadJson: json(artifacts.payload),
        errorMessage: noteError,
        writtenAt: new Date(),
      },
    });

    return toPreview(synced);
  } catch (error) {
    const failed = await prisma.secondMeWriteback.update({
      where: { targetKey },
      data: {
        consented: true,
        status: "failed",
        payloadJson: json(artifacts.payload),
        errorMessage: error instanceof Error ? error.message : "Second Me writeback failed",
      },
    });

    return toPreview(failed);
  }
}
