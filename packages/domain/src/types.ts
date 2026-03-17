export type OptionKey = "A" | "B";
export type Recommendation = "continue" | "cautious" | "terminate";
export type SessionState =
  | "draft"
  | "assessed"
  | "matched"
  | "sandboxing"
  | "filtered_out"
  | "reconnect_ready"
  | "exchanged";

export type WmtiDimension = "energy" | "perception" | "decision" | "execution";
export type WmtiCode = "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P";

export interface WmtiOption {
  key: OptionKey;
  label: string;
  code: WmtiCode;
}

export interface WmtiQuestion {
  id: string;
  dimension: WmtiDimension;
  prompt: string;
  options: [WmtiOption, WmtiOption];
}

export interface AssessmentAnswer {
  questionId: string;
  optionKey: OptionKey;
}

export interface AxisScore {
  dimension: WmtiDimension;
  leftCode: WmtiCode;
  rightCode: WmtiCode;
  leftCount: number;
  rightCount: number;
  dominantCode: WmtiCode;
  confidence: number;
}

export interface WmtiResult {
  letters: string;
  axes: AxisScore[];
  confidence: number;
}

export interface PersonalityProfile {
  userId: string;
  name: string;
  roleTag: string;
  wmti: WmtiResult;
  lifeModeTitle: string;
  workModeTitle: string;
  strengths: string[];
  risks: string[];
  collaborationStyle: string[];
}

export interface DualCoreCard {
  profile: PersonalityProfile;
  summary: string;
  tagline: string;
  actionHints: string[];
}

export interface MatchIntent {
  userId: string;
  lookingFor: string;
  mustHave: string[];
  redFlags: string[];
  scene: string;
}

export interface DebateTopic {
  id: string;
  title: string;
  sourceUrl: string;
  prompt: string;
  riskTags: string[];
}

export interface SandboxRound {
  roundIndex: number;
  topicId: string;
  question: string;
  agentAResponse: string;
  agentBResponse: string;
  observerNote: string;
  fitScore: number;
}

export interface ConflictFlag {
  type:
    | "control_conflict"
    | "ambiguity_tolerance_gap"
    | "communication_style_mismatch"
    | "execution_rhythm_gap";
  severity: "low" | "medium" | "high";
  reason: string;
}

export interface SandboxSession {
  sessionId: string;
  topic: DebateTopic;
  recommendation: Recommendation;
  fitScore: number;
  rounds: SandboxRound[];
  conflictFlags: ConflictFlag[];
  state: SessionState;
  currentRound: number;
}

export interface CollaborationManual {
  sessionId: string;
  summary: string;
  complements: string[];
  riskPoints: string[];
  communicationRules: string[];
  workSplitSuggestions: string[];
  zhihuAdviceRefs: Array<{
    title: string;
    sourceUrl: string;
    excerpt: string;
  }>;
}

export interface ReconnectCard {
  sessionId: string;
  userId: string;
  displayName: string;
  title: string;
  contactHint: string;
  contactValue?: string;
}

export interface InspirationDraw {
  requestId: string;
  matchedAgentType: string;
  message: string;
  luckyNumber: number;
}
