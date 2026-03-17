import type { ConflictFlag, Recommendation } from "@dual-core/domain";

const conflictCopy = {
  control_conflict: {
    label: "控制权冲突",
    signal: "双方都倾向掌握节奏或决策权，合作一进入高压状态就容易争主导。",
    action: "先写清谁负责拍板、谁负责提供备选方案，以及分歧升级时的仲裁方式。",
  },
  ambiguity_tolerance_gap: {
    label: "模糊容忍差",
    signal: "一方愿意边试边修，另一方需要更明确的边界和确定性才会投入。",
    action: "把探索窗口、冻结节点和可接受的不确定范围先约好，再开始执行。",
  },
  communication_style_mismatch: {
    label: "沟通风格错位",
    signal: "一个更直接，一个更绕，信息本身没问题，但表达方式会放大误读。",
    action: "把高风险反馈切到异步文档或固定复盘，不要把情绪判断混进即时对话里。",
  },
  execution_rhythm_gap: {
    label: "执行节奏落差",
    signal: "双方对推进速度、反馈频率和任务颗粒度的预期不同，容易互相觉得对方拖或冒进。",
    action: "先对齐节奏单位，例如周目标、同步频率和交付颗粒度，再谈责任归属。",
  },
} satisfies Record<ConflictFlag["type"], { label: string; signal: string; action: string }>;

const severityLabel = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
} as const;

const recommendationCopy = {
  continue: {
    label: "继续深入",
    description: "当前组合具备进入更深协作的基础，可以把重点放在分工和节奏细化上。",
  },
  cautious: {
    label: "可以合作，但先约边界",
    description: "这组人可以成事，但需要在规则、反馈方式和冲突升级路径上先做约定。",
  },
  terminate: {
    label: "建议终止连接",
    description: "系统判断这组组合存在较高的结构性摩擦，继续推进的磨损会大于协作收益。",
  },
} satisfies Record<Recommendation, { label: string; description: string }>;

const riskTagLabelMap: Record<string, string> = {
  authority: "权责边界",
  ambiguity: "模糊容忍",
  execution: "执行方式",
  communication: "沟通方式",
  boundary: "合作边界",
  trust: "信任修复",
  decision: "决策机制",
  rhythm: "协作节奏",
  resilience: "抗压韧性",
};

export function explainConflictFlag(flag: ConflictFlag) {
  const copy = conflictCopy[flag.type];

  return {
    label: copy.label,
    signal: copy.signal,
    action: copy.action,
    severityLabel: severityLabel[flag.severity],
  };
}

export function getRecommendationInsight(recommendation: Recommendation) {
  return recommendationCopy[recommendation];
}

export function getRiskTagLabel(tag: string) {
  return riskTagLabelMap[tag] ?? tag;
}
