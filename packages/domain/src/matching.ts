import type {
  CollaborationManual,
  ConflictFlag,
  DebateTopic,
  PersonalityProfile,
  Recommendation,
  SandboxRound,
  SandboxSession,
} from "./types";

const conflictReasons = {
  control_conflict: "一方更希望掌控节奏，另一方更排斥被预设流程包围。",
  ambiguity_tolerance_gap: "一方能接受边走边试，另一方需要较高的确定性才会投入。",
  communication_style_mismatch: "表达方式一个过直一个过隐，容易把补充信息误判为冒犯。",
  execution_rhythm_gap: "推进节奏差异大，容易出现一方觉得拖沓、一方觉得粗暴。",
} as const;

export function detectConflicts(
  left: PersonalityProfile,
  right: PersonalityProfile,
): ConflictFlag[] {
  const lettersA = left.wmti.letters;
  const lettersB = right.wmti.letters;
  const flags: ConflictFlag[] = [];

  if (lettersA[3] !== lettersB[3]) {
    flags.push({
      type: "execution_rhythm_gap",
      severity: "medium",
      reason: conflictReasons.execution_rhythm_gap,
    });
  }

  if (lettersA[2] !== lettersB[2]) {
    flags.push({
      type: "communication_style_mismatch",
      severity: "medium",
      reason: conflictReasons.communication_style_mismatch,
    });
  }

  if (lettersA[1] !== lettersB[1]) {
    flags.push({
      type: "ambiguity_tolerance_gap",
      severity: "low",
      reason: conflictReasons.ambiguity_tolerance_gap,
    });
  }

  if (lettersA[0] === "E" && lettersB[3] === "J") {
    flags.push({
      type: "control_conflict",
      severity: "high",
      reason: conflictReasons.control_conflict,
    });
  }

  return flags;
}

export function computeRecommendation(fitScore: number): Recommendation {
  if (fitScore >= 75) {
    return "continue";
  }

  if (fitScore >= 55) {
    return "cautious";
  }

  return "terminate";
}

export function computeFitScore(
  left: PersonalityProfile,
  right: PersonalityProfile,
  conflicts: ConflictFlag[],
): number {
  const lettersA = left.wmti.letters;
  const lettersB = right.wmti.letters;
  const overlap = lettersA
    .split("")
    .reduce((score, letter, index) => score + (letter === lettersB[index] ? 18 : 8), 0);
  const penalty = conflicts.reduce(
    (score, conflict) => score + (conflict.severity === "high" ? 18 : 8),
    0,
  );

  return Math.max(18, Math.min(96, overlap - penalty + 12));
}

export function buildSandboxRounds(
  topic: DebateTopic,
  left: PersonalityProfile,
  right: PersonalityProfile,
  fitScore: number,
): SandboxRound[] {
  return [
    {
      roundIndex: 1,
      topicId: topic.id,
      question: `面对题目「${topic.title}」，你的第一反应是什么？`,
      agentAResponse: `${left.name} 倾向先明确目标和权责，再决定是否正面回应。`,
      agentBResponse: `${right.name} 更关注关系摩擦和团队可持续性，倾向先做缓冲再推进。`,
      observerNote: "第一轮体现的是双方在压力下优先守护什么。",
      fitScore: Math.max(40, fitScore - 10),
    },
    {
      roundIndex: 2,
      topicId: topic.id,
      question: "如果对方坚持自己的处理方式，你会如何调整？",
      agentAResponse: `${left.name} 会要求先写下可验证标准，避免讨论反复漂移。`,
      agentBResponse: `${right.name} 会提出一个折中试运行方案，先换取合作意愿。`,
      observerNote: "第二轮体现的是双方能否把原则转换成可执行动作。",
      fitScore: Math.max(45, fitScore - 4),
    },
    {
      roundIndex: 3,
      topicId: topic.id,
      question: "这段合作最需要提前约定的边界是什么？",
      agentAResponse: `${left.name} 认为最重要的是决策权和更新时间点。`,
      agentBResponse: `${right.name} 认为最重要的是反馈语气和冲突升级路径。`,
      observerNote: "第三轮开始出现真正的协作契约雏形。",
      fitScore,
    },
  ];
}

export function buildSandboxSession(
  sessionId: string,
  topic: DebateTopic,
  left: PersonalityProfile,
  right: PersonalityProfile,
): SandboxSession {
  const conflictFlags = detectConflicts(left, right);
  const fitScore = computeFitScore(left, right, conflictFlags);

  return {
    sessionId,
    topic,
    fitScore,
    conflictFlags,
    recommendation: computeRecommendation(fitScore),
    rounds: buildSandboxRounds(topic, left, right, fitScore),
    currentRound: 0,
    state: fitScore >= 75 ? "reconnect_ready" : fitScore >= 55 ? "sandboxing" : "filtered_out",
  };
}

export function buildCollaborationManual(
  sessionId: string,
  left: PersonalityProfile,
  right: PersonalityProfile,
  topic: DebateTopic,
): CollaborationManual {
  const conflictFlags = detectConflicts(left, right);

  return {
    sessionId,
    summary: `${left.name} 擅长把复杂局面切出优先级，${right.name} 擅长吸收摩擦并维护关系缓冲。两人最适合在“目标清晰但过程有波动”的任务中协作。`,
    complements: [
      `${left.name} 的结构感可以补足 ${right.name} 的推进犹豫。`,
      `${right.name} 的关系敏感度可以缓冲 ${left.name} 的直推进攻性。`,
      `两人若能先约定决策机制，再分工执行，互补价值会明显放大。`,
    ],
    riskPoints: conflictFlags.map((item) => item.reason),
    communicationRules: [
      "关键分歧先写进共享文档，再讨论态度问题。",
      "周中异步对齐，周末再做集中决策，避免节奏互相拖拽。",
      "情绪上升时先暂停 20 分钟，再回到具体任务条目。",
    ],
    workSplitSuggestions: [
      `${left.name} 负责目标拆解、优先级排序和阶段性拍板。`,
      `${right.name} 负责关系沟通、协作缓冲和细节回访。`,
      `共用一个任务看板，状态变更必须留痕。`,
    ],
    zhihuAdviceRefs: [
      {
        title: topic.title,
        sourceUrl: topic.sourceUrl,
        excerpt: "真正高质量的合作，不是意见一致，而是冲突出现时仍有继续工作的机制。",
      },
    ],
  };
}
