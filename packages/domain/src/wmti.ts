import type {
  AssessmentAnswer,
  AxisScore,
  DualCoreCard,
  PersonalityProfile,
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

function lifeModeTitle(letters: string) {
  return lifeModeByLetters[letters] ?? lifeModeByLetters.default;
}

function workModeTitle(letters: string) {
  return workModeByLetters[letters] ?? workModeByLetters.default;
}

function pickTraits(map: Record<string, string[]>, first: string, second: string) {
  return [...(map[first] ?? []), ...(map[second] ?? [])].slice(0, 4);
}

export function buildPersonalityProfile(
  userId: string,
  name: string,
  roleTag: string,
  wmti: WmtiResult,
): PersonalityProfile {
  const letters = wmti.letters;
  const middle = `${letters[1]}${letters[2]}`;
  const tail = `${letters[2]}${letters[3]}`;

  return {
    userId,
    name,
    roleTag,
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
  };
}

export function buildDualCoreCard(profile: PersonalityProfile): DualCoreCard {
  return {
    profile,
    summary: `${profile.lifeModeTitle} / ${profile.workModeTitle}`,
    tagline: `${profile.name} 更适合在明确目标和高质量协作中释放能力，而不是在人情往返里耗散精力。`,
    actionHints: [
      "把关键结论写下来，不要只停留在口头同步。",
      "对方如果反复追问细节，说明他在建立安全感，不一定是在质疑你。",
      "合作初期先约定决策机制，比约定态度更重要。",
    ],
  };
}

