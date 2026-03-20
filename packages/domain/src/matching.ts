import type {
  CollaborationManual,
  ConflictFlag,
  DebateTopic,
  SessionSource,
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
      roundType: "positioning",
      issue: "双方在高压题目下最先守护的原则是什么",
      question: `面对题目「${topic.title}」，你的第一反应是什么？`,
      agentAResponse: `${left.name} 倾向先明确目标和权责，再决定是否正面回应。`,
      agentBResponse: `${right.name} 更关注关系摩擦和团队可持续性，倾向先做缓冲再推进。`,
      observerNote: "第一轮体现的是双方在压力下优先守护什么。",
      tensionPoint: "一个更在意先把目标和责任钉死，另一个更在意先保住关系与合作意愿。",
      concession: `${left.name} 接受先留出一次缓冲沟通窗口，${right.name} 接受尽快补齐决策条件。`,
      boundary: "任何缓冲动作都不能替代明确的任务归属与更新时间点。",
      synthesis: "先用一次低成本沟通稳住关系，再把权责和时间点写进共享文档。",
      fitScore: Math.max(40, fitScore - 10),
    },
    {
      roundIndex: 2,
      topicId: topic.id,
      roundType: "negotiation",
      issue: "当处理方式发生分歧时，双方愿意如何让步",
      question: "如果对方坚持自己的处理方式，你会如何调整？",
      agentAResponse: `${left.name} 会要求先写下可验证标准，避免讨论反复漂移。`,
      agentBResponse: `${right.name} 会提出一个折中试运行方案，先换取合作意愿。`,
      observerNote: "第二轮体现的是双方能否把原则转换成可执行动作。",
      tensionPoint: "一个要求可验证标准，另一个要求先跑折中方案，冲突点在先定规则还是先保推进。",
      concession: `${left.name} 接受试运行一次，${right.name} 接受为试运行补齐退出条件和复盘节点。`,
      boundary: "试运行不能无限延期，必须附带停损条件与复盘时刻。",
      synthesis: "用一次短周期试运行换取合作空间，再用复盘机制决定是否扩大投入。",
      fitScore: Math.max(45, fitScore - 4),
    },
    {
      roundIndex: 3,
      topicId: topic.id,
      roundType: "contract",
      issue: "真正开工前要先约定哪些协作规则",
      question: "这段合作最需要提前约定的边界是什么？",
      agentAResponse: `${left.name} 认为最重要的是决策权和更新时间点。`,
      agentBResponse: `${right.name} 认为最重要的是反馈语气和冲突升级路径。`,
      observerNote: "第三轮开始出现真正的协作契约雏形。",
      tensionPoint: "一个想先锁决策机制，一个想先锁冲突升级路径，核心差异是结构优先还是关系优先。",
      concession: `${left.name} 接受把反馈语气写进规则，${right.name} 接受把决策权和节点评审前置。`,
      boundary: "出现连续两次关键分歧时，必须回到文档和角色分工，而不是继续情绪化加码。",
      synthesis: "先约决策机制、反馈规则和冲突升级路径，再开始真正协作。",
      fitScore,
    },
  ];
}

export function buildSandboxSession(
  sessionId: string,
  topic: DebateTopic,
  left: PersonalityProfile,
  right: PersonalityProfile,
  source: SessionSource = "demo",
): SandboxSession {
  const conflictFlags = detectConflicts(left, right);
  const fitScore = computeFitScore(left, right, conflictFlags);

  return {
    sessionId,
    source,
    topic,
    fitScore,
    conflictFlags,
    recommendation: computeRecommendation(fitScore),
    rounds: buildSandboxRounds(topic, left, right, fitScore),
    currentRound: 0,
    state: fitScore >= 75 ? "reconnect_ready" : fitScore >= 55 ? "sandboxing" : "filtered_out",
    manualReady: false,
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
    summary: `${left.name} ${left.collaborationThesis}，${right.name} ${right.collaborationThesis}。两人最适合在“目标清晰但过程有波动”的任务里，把结构与缓冲同时摆上桌。`,
    complements: [
      `${left.name} 的结构感可以补足 ${right.name} 在模糊局面里的推进迟疑。`,
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
