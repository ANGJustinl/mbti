import type {
  AssessmentAnswer,
  AxisScore,
  DualCoreCard,
  PersonalityProfile,
  ProfileCorrection,
  ProfileCorrectionAxis,
  SecondMeAxisHint,
  WmtiQuestion,
  WmtiResult,
} from "./types";

const axisConfig = {
  energy: { left: "E", right: "I" },
  perception: { left: "S", right: "N" },
  decision: { left: "T", right: "F" },
  execution: { left: "J", right: "P" },
} as const;

const lifeModeByLetters: Record<string, string> = {
  ENFP: "生活态的理想主义火种",
  INFJ: "生活态的隐秘秩序诗人",
  INTJ: "生活态的冷静造景师",
  ENTP: "生活态的高压脑暴机",
  ESTJ: "生活态的现实调度台",
  ISFP: "生活态的低噪感知者",
  default: "生活态的慢热观察者",
};

const workModeByLetters: Record<string, string> = {
  ENTJ: "职场态的无情打拍器",
  ESTJ: "职场态的推进调度官",
  INTP: "职场态的系统拆解器",
  INFJ: "职场态的意图校准器",
  ENFJ: "职场态的关系引擎",
  ISTJ: "职场态的稳定执行栈",
  default: "职场态的结果导向协作者",
};

const strengthMap: Record<string, string[]> = {
  NT: ["复杂问题拆解快", "能在冲突里守住目标", "适合承担抽象建模"],
  NF: ["共识感知细腻", "能看到关系中的潜台词", "适合桥接人和事"],
  ST: ["执行标准明确", "面对噪音更稳定", "能把计划压成结果"],
  SF: ["现场照顾感强", "能维护合作氛围", "适合承担体验和反馈整合"],
};

const riskMap: Record<string, string[]> = {
  NP: ["容易边做边改而拉长节奏", "遇到模糊边界时会延后收口"],
  NJ: ["容易在前期过早定论", "对低质量沟通容忍度低"],
  TP: ["表达过于直给时可能伤人", "容易把感受问题推迟处理"],
  FJ: ["为了维持关系而压掉关键分歧", "容易额外承担情绪劳动"],
};

function axisScore(
  dimension: keyof typeof axisConfig,
  leftCount: number,
  rightCount: number,
): AxisScore {
  const { left, right } = axisConfig[dimension];
  const dominantCode = leftCount >= rightCount ? left : right;
  const total = leftCount + rightCount || 1;
  const confidence = Math.abs(leftCount - rightCount) / total;

  return {
    dimension,
    leftCode: left,
    rightCode: right,
    leftCount,
    rightCount,
    dominantCode,
    confidence,
  };
}

export function scoreAssessment(
  questions: WmtiQuestion[],
  answers: AssessmentAnswer[],
): WmtiResult {
  const answerMap = new Map(answers.map((answer) => [answer.questionId, answer.optionKey]));
  const buckets = {
    energy: { left: 0, right: 0 },
    perception: { left: 0, right: 0 },
    decision: { left: 0, right: 0 },
    execution: { left: 0, right: 0 },
  };

  for (const question of questions) {
    const key = answerMap.get(question.id) ?? "A";
    if (key === "A") {
      buckets[question.dimension].left += 1;
    } else {
      buckets[question.dimension].right += 1;
    }
  }

  const axes = [
    axisScore("energy", buckets.energy.left, buckets.energy.right),
    axisScore("perception", buckets.perception.left, buckets.perception.right),
    axisScore("decision", buckets.decision.left, buckets.decision.right),
    axisScore("execution", buckets.execution.left, buckets.execution.right),
  ];

  const letters = axes.map((item) => item.dominantCode).join("");
  const confidence =
    axes.reduce((total, item) => total + item.confidence, 0) / axes.length;

  return { letters, axes, confidence };
}

function replaceAxisCode(axis: AxisScore, nextCode: AxisScore["dominantCode"]): AxisScore {
  const leftDominant = nextCode === axis.leftCode;

  return {
    ...axis,
    dominantCode: nextCode,
    leftCount: leftDominant ? Math.max(axis.leftCount, axis.rightCount) : Math.min(axis.leftCount, axis.rightCount),
    rightCount: leftDominant ? Math.min(axis.leftCount, axis.rightCount) : Math.max(axis.leftCount, axis.rightCount),
  };
}

function clampHintCode(axis: AxisScore, hint: SecondMeAxisHint) {
  if (hint.code === axis.leftCode || hint.code === axis.rightCode) {
    return hint.code;
  }

  return null;
}

export function applySecondMeCorrection(
  base: WmtiResult,
  hints: SecondMeAxisHint[],
  options?: {
    maxCorrections?: number;
    maxAxisConfidence?: number;
    minHintConfidence?: number;
  },
): {
  effective: WmtiResult;
  correction: ProfileCorrection | null;
} {
  const maxCorrections = options?.maxCorrections ?? 2;
  const maxAxisConfidence = options?.maxAxisConfidence ?? 0.2;
  const minHintConfidence = options?.minHintConfidence ?? 0.75;
  const hintMap = new Map(hints.map((hint) => [hint.dimension, hint]));
  const correctedAxes: ProfileCorrectionAxis[] = [];

  const axes = base.axes.map((axis) => {
    if (correctedAxes.length >= maxCorrections || axis.confidence > maxAxisConfidence) {
      return axis;
    }

    const hint = hintMap.get(axis.dimension);
    if (!hint || hint.confidence < minHintConfidence) {
      return axis;
    }

    const nextCode = clampHintCode(axis, hint);
    if (!nextCode || nextCode === axis.dominantCode) {
      return axis;
    }

    correctedAxes.push({
      dimension: axis.dimension,
      baseCode: axis.dominantCode,
      effectiveCode: nextCode,
      baseConfidence: axis.confidence,
      hintConfidence: hint.confidence,
      reason: `Second Me 在 ${axis.dimension} 维度给出了相反且更稳定的协作倾向信号。`,
      evidence: hint.evidence,
    });

    return replaceAxisCode(axis, nextCode);
  });

  const effective: WmtiResult = {
    axes,
    letters: axes.map((axis) => axis.dominantCode).join(""),
    confidence: axes.reduce((total, axis) => total + axis.confidence, 0) / axes.length,
  };

  if (correctedAxes.length === 0) {
    return {
      effective: base,
      correction: null,
    };
  }

  return {
    effective,
    correction: {
      baseLetters: base.letters,
      effectiveLetters: effective.letters,
      correctedAxes,
      rationale: "仅对量表低置信度维度启用 Second Me 复核，高置信度结论保持不变。",
    },
  };
}

function lifeModeTitle(letters: string) {
  return lifeModeByLetters[letters] ?? lifeModeByLetters.default;
}

function workModeTitle(letters: string) {
  return workModeByLetters[letters] ?? workModeByLetters.default;
}

function pickTraits(map: Record<string, string[]>, first: string, second: string) {
  return [...(map[first] ?? []), ...(map[second] ?? [])].slice(0, 4);
}

function collaborationThesis(letters: string) {
  if (letters.endsWith("J")) {
    return "更适合把一段合作从混乱里拎出顺序，而不是在长期含糊里消耗。";
  }

  return "更适合在保留试错空间的前提下推进，而不是被过早定死在单一路径里。";
}

function bestWith(letters: string) {
  if (letters[2] === "T") {
    return "适合和愿意把问题写清、把分工说透的人一起做成事。";
  }

  return "适合和能给出明确反馈、又不把分歧处理成对抗的人一起做成事。";
}

function frictionWith(letters: string) {
  if (letters[3] === "J") {
    return "最容易在反复改口、节奏漂移和边界模糊的合作里被消耗。";
  }

  return "最容易在过早锁死规则、不给试运行空间的合作里被消耗。";
}

function preferredWorkSplit(letters: string) {
  if (letters[0] === "I") {
    return "更适合先独立整理判断，再回到共用文档里和对方做关键对齐。";
  }

  return "更适合边推进边对齐，在高频同步里把问题尽快推向可执行结论。";
}

function badStartPattern(letters: string) {
  if (letters[1] === "N") {
    return "不适合从模糊寒暄开始，最好一开始就给出任务、边界和想验证的假设。";
  }

  return "不适合一上来只谈愿景，最好先落到角色、交付物和现实约束。";
}

function likelyMisread(letters: string) {
  if (letters[2] === "T") {
    return "最怕被误读成只在乎结果、不在乎人，其实只是习惯先处理问题本身。";
  }

  return "最怕被误读成回避冲突或不够坚定，其实是在先判断关系还能不能承载这次分歧。";
}

function suggestedLead(letters: string) {
  if (letters[3] === "J" || letters[2] === "T") {
    return "更适合由你先主导节奏和决策框架，再把反馈入口留给对方。";
  }

  return "更适合由对方先锁定目标和边界，再由你主导关系缓冲与执行细节。";
}

export function buildPersonalityProfile(
  userId: string,
  name: string,
  roleTag: string,
  wmti: WmtiResult,
  userKind: PersonalityProfile["userKind"] = "human",
): PersonalityProfile {
  const letters = wmti.letters;
  const middle = `${letters[1]}${letters[2]}`;
  const tail = `${letters[2]}${letters[3]}`;

  return {
    userId,
    name,
    roleTag,
    userKind,
    wmti,
    lifeModeTitle: lifeModeTitle(letters),
    workModeTitle: workModeTitle(letters),
    strengths: pickTraits(strengthMap, middle, `${letters[0]}${letters[2]}`),
    risks: pickTraits(riskMap, `${letters[1]}${letters[3]}`, tail),
    collaborationStyle: [
      "先对齐目标，再进入分工。",
      "适合异步文档和明确责任边界。",
      "冲突出现时先处理节奏，再处理立场。",
    ],
    collaborationThesis: collaborationThesis(letters),
    bestWith: bestWith(letters),
    frictionWith: frictionWith(letters),
    preferredWorkSplit: preferredWorkSplit(letters),
    badStartPattern: badStartPattern(letters),
    likelyMisread: likelyMisread(letters),
    suggestedLead: suggestedLead(letters),
  };
}

export function buildDualCoreCard(profile: PersonalityProfile): DualCoreCard {
  return {
    profile,
    summary: `${profile.lifeModeTitle} / ${profile.workModeTitle}`,
    tagline: `${profile.name} ${profile.collaborationThesis}`,
    actionHints: [
      profile.preferredWorkSplit,
      profile.badStartPattern,
      "合作初期先约定决策机制，比约定态度更重要。",
    ],
  };
}
