import {
  buildCollaborationManual,
  buildDualCoreCard,
  buildSandboxSession,
  type CollaborationManual,
  type ConflictFlag,
  type DebateTopic,
  type DualCoreCard,
  type PersonalityProfile,
  type Recommendation,
  type SandboxSession,
} from "@dual-core/domain";

import { runSecondMeActJson } from "../secondme/auth";

interface CardActResult {
  tagline?: string;
  actionHints?: string[];
}

interface SandboxActResult {
  fitScore?: number;
  recommendation?: Recommendation;
  observerNote?: string;
  conflictTags?: string[];
  rounds?: Array<{
    roundType?: "positioning" | "negotiation" | "contract";
    issue?: string;
    agentAStance?: string;
    agentBStance?: string;
    tensionPoint?: string;
    concession?: string;
    boundary?: string;
    synthesis?: string;
    fitScore?: number;
  }>;
}

interface ManualActResult {
  summary?: string;
  complements?: string[];
  riskPoints?: string[];
  communicationRules?: string[];
  workSplitSuggestions?: string[];
}

function describeProfile(profile: PersonalityProfile) {
  const lines = [
    `姓名: ${profile.name}`,
    `角色: ${profile.roleTag}`,
    `W-MBTI: ${profile.wmti.letters}`,
    `生活态: ${profile.lifeModeTitle}`,
    `职场态: ${profile.workModeTitle}`,
    `优势: ${profile.strengths.join(" / ")}`,
    `风险: ${profile.risks.join(" / ")}`,
    `协作偏好: ${profile.collaborationStyle.join(" / ")}`,
    `协作像: ${profile.collaborationThesis}`,
    `适合一起做: ${profile.bestWith}`,
    `最容易摩擦: ${profile.frictionWith}`,
    `偏好分工: ${profile.preferredWorkSplit}`,
    `不适合怎样开始: ${profile.badStartPattern}`,
    `最怕的误读: ${profile.likelyMisread}`,
    `建议谁先主导: ${profile.suggestedLead}`,
  ];

  if (profile.baseWmti && profile.baseWmti.letters !== profile.wmti.letters) {
    lines.push(`原始量表: ${profile.baseWmti.letters}`);
  }

  if (profile.secondMeReview?.enabled) {
    lines.push(`Second Me 侧写: ${profile.secondMeReview.sourceSummary ?? "已启用"}`);
    if (profile.secondMeReview.correction?.correctedAxes.length) {
      lines.push(
        `复核维度: ${profile.secondMeReview.correction.correctedAxes
          .map((axis) => `${axis.dimension} ${axis.baseCode}->${axis.effectiveCode}`)
          .join(" / ")}`,
      );
    }
  }

  return lines.join("\n");
}

function normalizeRecommendation(value?: string): Recommendation {
  if (value === "continue" || value === "cautious" || value === "terminate") {
    return value;
  }

  return "cautious";
}

function clampScore(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 68;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function mapConflictTag(tag: string): ConflictFlag | null {
  switch (tag) {
    case "control_conflict":
      return {
        type: "control_conflict",
        severity: "high",
        reason: "Second Me Act 判断双方对控制权和决策节奏的要求存在硬碰撞。",
      };
    case "ambiguity_tolerance_gap":
      return {
        type: "ambiguity_tolerance_gap",
        severity: "medium",
        reason: "Second Me Act 判断双方对不确定性的容忍区间明显不同。",
      };
    case "communication_style_mismatch":
      return {
        type: "communication_style_mismatch",
        severity: "medium",
        reason: "Second Me Act 判断双方表达风格差异较大，容易误读意图。",
      };
    case "execution_rhythm_gap":
      return {
        type: "execution_rhythm_gap",
        severity: "medium",
        reason: "Second Me Act 判断双方推进节奏不一致，容易互相觉得过快或过慢。",
      };
    default:
      return null;
  }
}

function buildStateFromRecommendation(recommendation: Recommendation): SandboxSession["state"] {
  if (recommendation === "continue") {
    return "reconnect_ready";
  }

  if (recommendation === "cautious") {
    return "sandboxing";
  }

  return "filtered_out";
}

export async function generateDualCoreCard(profile: PersonalityProfile): Promise<DualCoreCard> {
  const fallback = buildDualCoreCard(profile);

  try {
    const result = await runSecondMeActJson<CardActResult>({
      message: `请根据以下画像生成一句职场态标语与 3 条协作建议。\n\n${describeProfile(profile)}`,
      systemPrompt: "你是双核职场的中文协作顾问。",
      actionControl: [
        "仅输出合法 JSON，不要解释。",
        '结构: {"tagline": string, "actionHints": string[]}',
        "tagline 要锋利、简洁、适合产品名片展示。",
        "actionHints 必须返回 3 条中文建议。",
      ].join("\n"),
    });

    return {
      ...fallback,
      tagline:
        typeof result.tagline === "string" && result.tagline.trim()
          ? result.tagline.trim()
          : fallback.tagline,
      actionHints:
        Array.isArray(result.actionHints) && result.actionHints.length > 0
          ? result.actionHints.filter(Boolean).slice(0, 3)
          : fallback.actionHints,
    };
  } catch {
    return fallback;
  }
}

export async function runSandboxSession(
  topic: DebateTopic,
  left: PersonalityProfile,
  right: PersonalityProfile,
): Promise<SandboxSession> {
  const fallback = buildSandboxSession(`session-${right.userId}-${topic.id}`, topic, left, right);

  try {
    const result = await runSecondMeActJson<SandboxActResult>({
      message: [
        `题目: ${topic.title}`,
        `题目说明: ${topic.prompt}`,
        "",
        "[Agent A]",
        describeProfile(left),
        "",
        "[Agent B]",
        describeProfile(right),
      ].join("\n"),
      systemPrompt: "你是双核职场的双盲沙盘裁判，只做结构化兼容度判断。",
      actionControl: [
        "仅输出合法 JSON，不要解释。",
        '结构: {"fitScore": number, "recommendation": "continue"|"cautious"|"terminate", "observerNote": string, "conflictTags": string[], "rounds": [{"roundType":"positioning"|"negotiation"|"contract","issue":string,"agentAStance":string,"agentBStance":string,"tensionPoint":string,"concession":string,"boundary":string,"synthesis":string,"fitScore":number}]}',
        "fitScore 为 0 到 100 的整数。",
        "conflictTags 只能使用 control_conflict、ambiguity_tolerance_gap、communication_style_mismatch、execution_rhythm_gap。",
        "rounds 必须严格返回 3 段，对应立场确认、冲突协商、规则敲定。",
      ].join("\n"),
    });

    const recommendation = normalizeRecommendation(result.recommendation);
    const fitScore = clampScore(result.fitScore);
    const conflictFlags =
      result.conflictTags?.map(mapConflictTag).filter(Boolean) as ConflictFlag[] | undefined;

    return {
      ...fallback,
      fitScore,
      recommendation,
      conflictFlags: conflictFlags?.length ? conflictFlags : fallback.conflictFlags,
      state: buildStateFromRecommendation(recommendation),
      rounds:
        Array.isArray(result.rounds) && result.rounds.length === 3
          ? fallback.rounds.map((round, index) => {
              const item = result.rounds?.[index];
              return {
                ...round,
                roundType: item?.roundType ?? round.roundType,
                issue: item?.issue?.trim() || round.issue,
                question: item?.issue?.trim() || round.question,
                agentAResponse: item?.agentAStance?.trim() || round.agentAResponse,
                agentBResponse: item?.agentBStance?.trim() || round.agentBResponse,
                observerNote:
                  index === fallback.rounds.length - 1 &&
                  typeof result.observerNote === "string" &&
                  result.observerNote.trim()
                    ? result.observerNote
                    : round.observerNote,
                tensionPoint: item?.tensionPoint?.trim() || round.tensionPoint,
                concession: item?.concession?.trim() || round.concession,
                boundary: item?.boundary?.trim() || round.boundary,
                synthesis: item?.synthesis?.trim() || round.synthesis,
                fitScore: clampScore(item?.fitScore ?? round.fitScore),
              };
            })
          : fallback.rounds.map((round, index) =>
              index === fallback.rounds.length - 1
                ? {
                    ...round,
                    fitScore,
                    observerNote:
                      typeof result.observerNote === "string" && result.observerNote.trim()
                        ? result.observerNote
                        : round.observerNote,
                  }
                : round,
            ),
    };
  } catch {
    return fallback;
  }
}

export async function generateCollaborationManual(
  topic: DebateTopic,
  left: PersonalityProfile,
  right: PersonalityProfile,
): Promise<CollaborationManual> {
  const fallback = buildCollaborationManual(`manual-${right.userId}-${topic.id}`, left, right, topic);

  try {
    const result = await runSecondMeActJson<ManualActResult>({
      message: [
        `题目: ${topic.title}`,
        `题目说明: ${topic.prompt}`,
        "",
        "[协作方 A]",
        describeProfile(left),
        "",
        "[协作方 B]",
        describeProfile(right),
        "",
        "请围绕双方在公开广场互选成功后的真实协作，生成具体而克制的说明书。",
      ].join("\n"),
      systemPrompt: "你是双核职场的协作契约起草人。",
      actionControl: [
        "仅输出合法 JSON，不要解释。",
        '结构: {"summary": string, "complements": string[], "riskPoints": string[], "communicationRules": string[], "workSplitSuggestions": string[]}',
        "所有数组返回 3 条中文内容。",
        "文字风格要求具体、可执行，避免空泛鼓励。",
      ].join("\n"),
    });

    return {
      ...fallback,
      summary:
        typeof result.summary === "string" && result.summary.trim()
          ? result.summary
          : fallback.summary,
      complements:
        Array.isArray(result.complements) && result.complements.length > 0
          ? result.complements.filter(Boolean).slice(0, 3)
          : fallback.complements,
      riskPoints:
        Array.isArray(result.riskPoints) && result.riskPoints.length > 0
          ? result.riskPoints.filter(Boolean).slice(0, 3)
          : fallback.riskPoints,
      communicationRules:
        Array.isArray(result.communicationRules) && result.communicationRules.length > 0
          ? result.communicationRules.filter(Boolean).slice(0, 3)
          : fallback.communicationRules,
      workSplitSuggestions:
        Array.isArray(result.workSplitSuggestions) && result.workSplitSuggestions.length > 0
          ? result.workSplitSuggestions.filter(Boolean).slice(0, 3)
          : fallback.workSplitSuggestions,
    };
  } catch {
    return fallback;
  }
}
