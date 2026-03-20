export type OptionKey = "A" | "B";
export type Recommendation = "continue" | "cautious" | "terminate";
export type SecondMeWritebackMilestone =
  | "assessment_completed"
  | "sandbox_finalized"
  | "manual_generated"
  | "reconnect_exchanged";
export type SecondMeWritebackStatus = "pending" | "skipped" | "synced" | "failed";
export type MatchSignalStatus = "pending" | "mutual" | "dismissed";
export type SessionSource = "demo" | "plaza";
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

export interface SecondMeAxisHint {
  dimension: WmtiDimension;
  code: WmtiCode;
  confidence: number;
  evidence: string[];
}

export interface SecondMeProfileSignals {
  axisHints: SecondMeAxisHint[];
  collaborationSignals: string[];
  sourceSummary: string;
  fetchedAt: string;
}

export interface ProfileCorrectionAxis {
  dimension: WmtiDimension;
  baseCode: WmtiCode;
  effectiveCode: WmtiCode;
  baseConfidence: number;
  hintConfidence: number;
  reason: string;
  evidence: string[];
}

export interface ProfileCorrection {
  baseLetters: string;
  effectiveLetters: string;
  correctedAxes: ProfileCorrectionAxis[];
  rationale: string;
}

export interface SecondMeReview {
  enabled: boolean;
  syncedAt?: string;
  sourceSummary?: string;
  evidence: string[];
  collaborationSignals: string[];
  signals?: SecondMeProfileSignals;
  correction?: ProfileCorrection | null;
}

export interface PersonalityProfile {
  userId: string;
  name: string;
  roleTag: string;
  wmti: WmtiResult;
  baseWmti?: WmtiResult;
  lifeModeTitle: string;
  workModeTitle: string;
  strengths: string[];
  risks: string[];
  collaborationStyle: string[];
  collaborationThesis: string;
  bestWith: string;
  frictionWith: string;
  preferredWorkSplit: string;
  badStartPattern: string;
  likelyMisread: string;
  suggestedLead: string;
  secondMeReview?: SecondMeReview | null;
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

export interface PlazaListing {
  userId: string;
  enabled: boolean;
  headline: string;
  lookingFor: string;
  focusTags: string[];
  availabilityNote: string;
  lastActiveAt?: string;
  card: DualCoreCard;
}

export interface MatchSignal {
  fromUserId: string;
  toUserId: string;
  status: MatchSignalStatus;
  sessionId?: string;
  createdAt: string;
  updatedAt: string;
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
  roundType: "positioning" | "negotiation" | "contract";
  issue: string;
  question: string;
  agentAResponse: string;
  agentBResponse: string;
  observerNote: string;
  tensionPoint: string;
  concession: string;
  boundary: string;
  synthesis: string;
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
  source: SessionSource;
  topic: DebateTopic;
  recommendation: Recommendation;
  fitScore: number;
  rounds: SandboxRound[];
  conflictFlags: ConflictFlag[];
  state: SessionState;
  currentRound: number;
  manualReady?: boolean;
  secondMeEvidenceSummary?: CollaborationManual["secondMeEvidenceSummary"];
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
  secondMeEvidenceSummary?: {
    usedCalibration: boolean;
    sourceSummary: string;
    evidence: string[];
    influencedSections: string[];
  };
}

export interface ReconnectCard {
  sessionId: string;
  userId: string;
  displayName: string;
  title: string;
  contactHint: string;
  contactValue?: string;
}

export interface SecondMeWritebackPreview {
  targetKey: string;
  milestone: SecondMeWritebackMilestone;
  sessionId?: string;
  assessmentId?: string;
  status: SecondMeWritebackStatus;
  title: string;
  description: string;
  summaryLines: string[];
  consented: boolean;
  lastError?: string;
  writtenAt?: string;
}
