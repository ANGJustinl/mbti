import {
  MAX_SANDBOX_ROUNDS,
  applySecondMeCorrection,
  buildCollaborationManual,
  buildDualCoreCard,
  buildPersonalityProfile,
  canAdvanceSandbox,
  canExchangeContacts,
  canFinalizeSandbox,
  canStartMatch,
  type ContactKind,
  type ConflictFlag,
  getStateAfterFinalize,
  getStateAfterRound,
  scoreAssessment,
  type AssessmentAnswer,
  type CollaborationManual,
  type DebateTopic,
  type DualCoreCard,
  type MatchIntent,
  type MatchSignalStatus,
  type PersonalityProfile,
  type PlazaListing,
  type ProfileCorrection,
  type ReconnectCard,
  type Recommendation,
  type SandboxSession,
  type SessionSource,
  type SessionState,
  type SecondMeReview,
  type SecondMeWritebackPreview,
  type UserKind,
  type WmtiResult,
} from "@dual-core/domain";
import type {
  CollaborationManual as CollaborationManualRecord,
  MatchSignal as MatchSignalRecord,
  PersonalityProfile as PersonalityProfileRecord,
  PlazaListing as PlazaListingRecord,
  ReconnectDecision,
  SandboxRound as SandboxRoundRecord,
  SandboxSession as SandboxSessionRecord,
  User,
} from "../generated/prisma/client";

import { recordAnalyticsEvent } from "./analytics";
import { DEMO_USER_ID, buildDefaultDemoProfile } from "./current-user";
import { prisma } from "./db";
import { getDemoIntent, getTopTopics } from "./demo";
import {
  generateCollaborationManual,
  generateDualCoreCard,
  runSandboxSession,
} from "./integrations/secondme";
import { loadCandidates, loadQuestions } from "./loaders";
import { syncSecondMeProfileSnapshot } from "./secondme/profile";
import {
  ensureSecondMeWriteback,
  listSecondMeWritebacks,
} from "./secondme/writeback";

interface SubmitAssessmentInput {
  userId: string;
  name?: string;
  roleTag?: string;
  answers: AssessmentAnswer[];
}

interface StartMatchInput {
  userId: string;
  targetProfileId: string;
  topicId?: string;
}

interface PublishPlazaInput {
  userId: string;
  enabled: boolean;
  headline?: string;
  lookingFor?: string;
  focusTags?: string[];
  availabilityNote?: string;
}

interface MatchSignalInput {
  fromUserId: string;
  toUserId: string;
  sourcePage?: string;
}

interface AdvanceRoundInput {
  sessionId: string;
  roundIndex?: number;
}

interface FinalizeSessionInput {
  sessionId: string;
  userId?: string;
}

interface ReconnectInput {
  sessionId: string;
  userId: string;
  confirmed: boolean;
}

export interface SessionParticipantSummary {
  userId: string;
  name: string;
  roleTag: string;
  kind: UserKind;
  wmtiLetters?: string;
  lifeModeTitle?: string;
  workModeTitle?: string;
}

export interface SessionSummary {
  sessionId: string;
  source: SessionSource;
  state: SessionState;
  currentRound: number;
  fitScore: number;
  recommendation: Recommendation;
  topic: {
    id: string;
    title: string;
    riskTags: string[];
  };
  counterpart: SessionParticipantSummary;
  manualReady: boolean;
  actorConfirmed: boolean;
  counterpartConfirmed: boolean;
  updatedAt: string;
}

export interface UserSessionGroups {
  sandboxing: SessionSummary[];
  reconnect_ready: SessionSummary[];
  exchanged: SessionSummary[];
  filtered_out: SessionSummary[];
}

export interface CurrentUserProfilePayload {
  profile: PersonalityProfile;
  card: DualCoreCard;
}

export interface SecondMeWorkspaceStatus {
  profileSyncedAt: string | null;
  pendingWritebacks: SecondMeWritebackPreview[];
  recentWritebacks: SecondMeWritebackPreview[];
}

export interface PlazaFeedItem {
  listing: PlazaListing;
  relationship: "none" | "incoming" | "outgoing" | "mutual";
  signalStatus: "none" | MatchSignalStatus;
  sessionId?: string;
}

export interface PlazaSignalSummary {
  signalId: string;
  direction: "incoming" | "outgoing";
  status: MatchSignalStatus;
  sessionId?: string;
  counterpart: SessionParticipantSummary;
  headline: string;
  updatedAt: string;
}

export interface PlazaWorkspacePayload {
  listing: PlazaListing | null;
  incoming: PlazaSignalSummary[];
  outgoing: PlazaSignalSummary[];
  mutual: PlazaSignalSummary[];
}

function json<T>(value: T) {
  return JSON.stringify(value);
}

function parse<T>(value: string): T {
  return JSON.parse(value) as T;
}

function parseOptional<T>(value: string | null | undefined): T | null {
  if (!value) {
    return null;
  }

  return JSON.parse(value) as T;
}

async function saveUserRecord(input: {
  id: string;
  name: string;
  roleTag: string;
  kind?: User["kind"];
  contactCard: string;
  isSeedCandidate?: boolean;
}) {
  const existing = await prisma.user.findUnique({
    where: { id: input.id },
  });

  if (existing) {
    return prisma.user.update({
      where: { id: input.id },
      data: {
        name: input.name,
        roleTag: input.roleTag,
        kind: input.kind ?? existing.kind,
        contactCard: input.contactCard,
        isSeedCandidate: input.isSeedCandidate ?? existing.isSeedCandidate,
      },
    });
  }

  return prisma.user.create({
    data: {
      id: input.id,
      name: input.name,
      roleTag: input.roleTag,
      kind: input.kind ?? "human",
      contactCard: input.contactCard,
      isSeedCandidate: input.isSeedCandidate ?? false,
    },
  });
}

function getRecommendation(
  value: string | null | undefined,
): Recommendation {
  return (value ?? "cautious") as Recommendation;
}

function collectSecondMeEvidence(review: SecondMeReview | null | undefined) {
  if (!review) {
    return [];
  }

  const evidence = [
    ...review.evidence,
    ...(review.correction?.correctedAxes.flatMap((axis) => axis.evidence) ?? []),
  ];

  return Array.from(new Set(evidence.filter(Boolean))).slice(0, 3);
}

function buildSecondMeEvidenceSummary(
  profiles: Array<PersonalityProfile | null | undefined>,
): CollaborationManual["secondMeEvidenceSummary"] | undefined {
  const reviews = profiles
    .map((profile) => profile?.secondMeReview)
    .filter((review): review is SecondMeReview => Boolean(review?.enabled));

  if (reviews.length === 0) {
    return undefined;
  }

  const usedCalibration = reviews.some((review) => Boolean(review.correction?.correctedAxes.length));
  const evidence = Array.from(
    new Set(reviews.flatMap((review) => collectSecondMeEvidence(review))),
  ).slice(0, 3);
  const collaborationSignals = Array.from(
    new Set(reviews.flatMap((review) => review.collaborationSignals ?? [])),
  );

  return {
    usedCalibration,
    sourceSummary: reviews
      .map((review) => review.sourceSummary)
      .filter((item): item is string => Boolean(item))
      .join(" / "),
    evidence,
    influencedSections: usedCalibration
      ? ["双核画像", "风险提醒", "沟通规则", "分工建议"]
      : collaborationSignals.length > 0
        ? ["沟通规则", "分工建议"]
        : ["双核画像"],
  };
}

function buildSecondMeReview(input: {
  fetchedAt?: string | null;
  sourceSummary?: string;
  collaborationSignals?: string[];
  evidence?: string[];
  correction?: ProfileCorrection | null;
  signals?: SecondMeReview["signals"];
}): SecondMeReview | null {
  const evidence = Array.from(new Set((input.evidence ?? []).filter(Boolean))).slice(0, 3);
  const collaborationSignals = Array.from(
    new Set((input.collaborationSignals ?? []).filter(Boolean)),
  ).slice(0, 3);
  const hasSignal =
    Boolean(input.sourceSummary) ||
    evidence.length > 0 ||
    collaborationSignals.length > 0 ||
    Boolean(input.correction?.correctedAxes.length) ||
    Boolean(input.fetchedAt);

  if (!hasSignal) {
    return null;
  }

  return {
    enabled: true,
    syncedAt: input.fetchedAt ?? undefined,
    sourceSummary: input.sourceSummary,
    evidence,
    collaborationSignals,
    signals: input.signals,
    correction: input.correction ?? null,
  };
}

function toStoredProfile(record: PersonalityProfileRecord, user: User): PersonalityProfile {
  const secondMeReview = parseOptional<SecondMeReview>(record.secondMeEvidenceJson);
  const wmti = parse<WmtiResult>(record.wmtiJson);
  const fallback = buildPersonalityProfile(record.userId, user.name, user.roleTag, wmti);

  return {
    userId: record.userId,
    name: user.name,
    roleTag: user.roleTag,
    userKind: (user.kind as UserKind) ?? "human",
    wmti,
    baseWmti: parseOptional<WmtiResult>(record.baseWmtiJson) ?? undefined,
    lifeModeTitle: record.lifeModeTitle,
    workModeTitle: record.workModeTitle,
    strengths: parse<string[]>(record.strengthsJson),
    risks: parse<string[]>(record.risksJson),
    collaborationStyle: parse<string[]>(record.collaborationStyleJson),
    collaborationThesis: record.collaborationThesis || fallback.collaborationThesis,
    bestWith: record.bestWith || fallback.bestWith,
    frictionWith: record.frictionWith || fallback.frictionWith,
    preferredWorkSplit: record.preferredWorkSplit || fallback.preferredWorkSplit,
    badStartPattern: record.badStartPattern || fallback.badStartPattern,
    likelyMisread: record.likelyMisread || fallback.likelyMisread,
    suggestedLead: record.suggestedLead || fallback.suggestedLead,
    secondMeReview,
  };
}

function toStoredCard(record: PersonalityProfileRecord, user: User): DualCoreCard {
  const profile = toStoredProfile(record, user);
  const fallbackCard = buildDualCoreCard(profile);
  const storedHints = parse<string[]>(record.actionHintsJson);

  return {
    profile,
    summary: record.cardSummary || fallbackCard.summary,
    tagline: record.cardTagline || fallbackCard.tagline,
    actionHints: storedHints.length > 0 ? storedHints : fallbackCard.actionHints,
  };
}

function buildReconnectCards(
  sessionId: string,
  left: PersonalityProfile,
  right: PersonalityProfile,
  exchanged: boolean,
): ReconnectCard[] {
  function buildCard(profile: PersonalityProfile): ReconnectCard {
    const contactKind: ContactKind =
      profile.userKind === "agent" ? "agent_proxy" : "human";

    return {
      sessionId: `${sessionId}-${profile.userId}`,
      userId: profile.userId,
      displayName: profile.name,
      title: profile.workModeTitle,
      contactKind,
      contactHint:
        contactKind === "agent_proxy"
          ? "双方确认后展示代理名片"
          : "双方确认后展示站内数字名片",
      contactValue: exchanged
        ? contactKind === "agent_proxy"
          ? `dualcore://agent/${profile.userId}`
          : `dualcore://profile/${profile.userId}`
        : undefined,
    };
  }

  return [
    buildCard(left),
    buildCard(right),
  ];
}

function toTopic(record: SandboxSessionRecord): DebateTopic {
  return {
    id: record.topicId,
    title: record.topicTitle,
    sourceUrl: record.topicSourceUrl,
    prompt: record.topicPrompt,
    riskTags: parse<string[]>(record.topicRiskTagsJson),
  };
}

function toStoredSession(
  record: SandboxSessionRecord,
  rounds: SandboxRoundRecord[],
  secondMeEvidenceSummary?: SandboxSession["secondMeEvidenceSummary"],
): SandboxSession {
  return {
    sessionId: record.id,
    source: (record.source as SessionSource) ?? "demo",
    topic: toTopic(record),
    recommendation: getRecommendation(record.recommendation),
    fitScore: record.fitScore ?? 0,
    rounds: rounds
      .sort((left, right) => left.roundIndex - right.roundIndex)
      .map((round) => ({
        roundIndex: round.roundIndex,
        topicId: record.topicId,
        roundType: (round.roundType as SandboxSession["rounds"][number]["roundType"]) ?? "positioning",
        issue: round.issue ?? round.question,
        question: round.question,
        agentAResponse: round.agentAResponse,
        agentBResponse: round.agentBResponse,
        observerNote: round.observerNote,
        tensionPoint: round.tensionPoint ?? "当前回合未提炼出更细的张力描述。",
        concession: round.concession ?? "当前回合仍在观察双方是否愿意让步。",
        boundary: round.boundary ?? "边界尚未明确落下。",
        synthesis: round.synthesis ?? round.observerNote,
        fitScore: round.fitScore,
      })),
    conflictFlags: record.conflictFlagsJson ? parse(record.conflictFlagsJson) : [],
    state: record.state as SessionState,
    currentRound: record.currentRound,
    manualReady: false,
    secondMeEvidenceSummary,
  };
}

function toStoredManual(
  record: CollaborationManualRecord,
  secondMeEvidenceSummary?: CollaborationManual["secondMeEvidenceSummary"],
): CollaborationManual {
  return {
    sessionId: record.sessionId,
    summary: record.summary,
    complements: parse<string[]>(record.complementsJson),
    riskPoints: parse<string[]>(record.riskPointsJson),
    communicationRules: parse<string[]>(record.communicationRulesJson),
    workSplitSuggestions: parse<string[]>(record.workSplitSuggestionsJson),
    zhihuAdviceRefs: parse<CollaborationManual["zhihuAdviceRefs"]>(record.zhihuAdviceRefsJson),
    secondMeEvidenceSummary,
  };
}

function toParticipantSummary(
  user: User,
  profileRecord: PersonalityProfileRecord | null | undefined,
): SessionParticipantSummary {
  return {
    userId: user.id,
    name: user.name,
    roleTag: user.roleTag,
    kind: (user.kind as UserKind) ?? "human",
    wmtiLetters: profileRecord?.wmtiLetters,
    lifeModeTitle: profileRecord?.lifeModeTitle,
    workModeTitle: profileRecord?.workModeTitle,
  };
}

function buildPlazaFocusTags(profile: PersonalityProfile) {
  return [
    profile.wmti.letters,
    profile.lifeModeTitle,
    profile.workModeTitle,
  ].slice(0, 3);
}

function defaultPlazaHeadline(profile: PersonalityProfile) {
  return `${profile.name} ${profile.collaborationThesis}`;
}

function defaultPlazaLookingFor(profile: PersonalityProfile) {
  return profile.bestWith;
}

function defaultAvailabilityNote(profile: PersonalityProfile) {
  return profile.preferredWorkSplit;
}

const MIN_PLAZA_FEED_SIZE = 4;

function getPlazaRelationshipState(input: {
  outgoingStatus?: MatchSignalStatus | null;
  incomingStatus?: MatchSignalStatus | null;
}) {
  if (input.outgoingStatus === "mutual" || input.incomingStatus === "mutual") {
    return "mutual" as const;
  }

  if (input.incomingStatus === "pending") {
    return "incoming" as const;
  }

  if (input.outgoingStatus === "pending") {
    return "outgoing" as const;
  }

  return "none" as const;
}

function getPlazaRelationshipPriority(relationship: PlazaFeedItem["relationship"]) {
  switch (relationship) {
    case "mutual":
      return 0;
    case "incoming":
      return 1;
    case "outgoing":
      return 2;
    default:
      return 3;
  }
}

function toPlazaListing(record: PlazaListingRecord, card: DualCoreCard): PlazaListing {
  return {
    userId: record.userId,
    userKind: card.profile.userKind,
    enabled: record.enabled,
    headline: record.headline,
    lookingFor: record.lookingFor,
    focusTags: parse<string[]>(record.focusTagsJson),
    availabilityNote: record.availabilityNote,
    lastActiveAt: record.lastActiveAt?.toISOString(),
    card,
  };
}

function toSessionBucket(state: SessionState): keyof UserSessionGroups {
  if (state === "filtered_out") {
    return "filtered_out";
  }

  if (state === "reconnect_ready") {
    return "reconnect_ready";
  }

  if (state === "exchanged") {
    return "exchanged";
  }

  return "sandboxing";
}

function createEmptySessionGroups(): UserSessionGroups {
  return {
    sandboxing: [],
    reconnect_ready: [],
    exchanged: [],
    filtered_out: [],
  };
}

async function upsertProfile(
  profile: PersonalityProfile,
  card: DualCoreCard,
  isSeedCandidate = false,
  options?: {
    baseWmti?: WmtiResult;
    correction?: ProfileCorrection | null;
    secondMeReview?: SecondMeReview | null;
  },
) {
  await saveUserRecord({
    id: profile.userId,
    name: profile.name,
    roleTag: profile.roleTag,
    kind: profile.userKind,
    isSeedCandidate,
    contactCard: `dualcore://profile/${profile.userId}`,
  });

  const existingProfile = await prisma.personalityProfile.findUnique({
    where: { userId: profile.userId },
  });
  const profileData = {
    userId: profile.userId,
    wmtiLetters: profile.wmti.letters,
    wmtiJson: json(profile.wmti),
    baseWmtiJson: options?.baseWmti ? json(options.baseWmti) : null,
    correctionJson: options?.correction ? json(options.correction) : null,
    secondMeEvidenceJson: options?.secondMeReview ? json(options.secondMeReview) : null,
    lifeModeTitle: profile.lifeModeTitle,
    workModeTitle: profile.workModeTitle,
    strengthsJson: json(profile.strengths),
    risksJson: json(profile.risks),
    collaborationStyleJson: json(profile.collaborationStyle),
    collaborationThesis: profile.collaborationThesis,
    bestWith: profile.bestWith,
    frictionWith: profile.frictionWith,
    preferredWorkSplit: profile.preferredWorkSplit,
    badStartPattern: profile.badStartPattern,
    likelyMisread: profile.likelyMisread,
    suggestedLead: profile.suggestedLead,
    cardSummary: card.summary,
    cardTagline: card.tagline,
    actionHintsJson: json(card.actionHints),
  };

  if (existingProfile) {
    await prisma.personalityProfile.update({
      where: { userId: profile.userId },
      data: profileData,
    });
  } else {
    await prisma.personalityProfile.create({
      data: profileData,
    });
  }
}

async function getProfilesForSession(userId: string, targetUserId: string) {
  const [left, right] = await Promise.all([
    getProfileByUserId(userId),
    getProfileByUserId(targetUserId),
  ]);

  if (!left || !right) {
    return null;
  }

  return { left, right };
}

async function getSessionRecord(sessionId: string) {
  const session = await prisma.sandboxSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      targetUserId: true,
      state: true,
      currentRound: true,
    },
  });

  if (!session) {
    throw new Error("session not found");
  }

  return session;
}

function areBothConfirmed(decisions: ReconnectDecision[], expectedUsers: string[]) {
  return expectedUsers.every((userId) =>
    decisions.some((decision) => decision.userId === userId && decision.confirmed),
  );
}

export async function ensureWorkflowSeedData() {
  const candidateSeeds = await loadCandidates();
  const axisTemplate = buildDefaultDemoProfile().wmti.axes;

  for (const seed of candidateSeeds) {
    const profile = {
      ...buildPersonalityProfile(seed.userId, seed.name, seed.roleTag, {
        letters: seed.letters,
        axes: axisTemplate.map((axis, index) => {
          const dominantCode = seed.letters[index];
          const leftDominant = dominantCode === axis.leftCode;
          return {
            ...axis,
            dominantCode: dominantCode as typeof axis.dominantCode,
            leftCount: leftDominant ? 7 : 3,
            rightCount: leftDominant ? 3 : 7,
          };
        }),
        confidence: 0.4,
      }, "agent"),
      lifeModeTitle: seed.lifeModeTitle,
      workModeTitle: seed.workModeTitle,
      strengths: seed.strengths,
      risks: seed.risks,
      collaborationStyle: seed.collaborationStyle,
    };
    const card = buildDualCoreCard(profile);
    await upsertProfile(profile, card, true);
    await prisma.plazaListing.upsert({
      where: { userId: seed.userId },
      update: {
        enabled: true,
        headline: `${profile.name} ${profile.collaborationThesis}`,
        lookingFor: profile.bestWith,
        focusTagsJson: json(buildPlazaFocusTags(profile)),
        availabilityNote: defaultAvailabilityNote(profile),
        lastActiveAt: new Date(),
      },
      create: {
        userId: seed.userId,
        enabled: true,
        headline: `${profile.name} ${profile.collaborationThesis}`,
        lookingFor: profile.bestWith,
        focusTagsJson: json(buildPlazaFocusTags(profile)),
        availabilityNote: defaultAvailabilityNote(profile),
        lastActiveAt: new Date(),
      },
    });
  }
}

export async function listCandidateCards() {
  await ensureWorkflowSeedData();
  const records = await prisma.personalityProfile.findMany({
    where: {
      user: {
        isSeedCandidate: true,
      },
    },
    include: {
      user: true,
    },
    orderBy: {
      userId: "asc",
    },
  });

  return records.map((record) => toStoredCard(record, record.user));
}

export async function getCardByUserId(userId: string) {
  await ensureWorkflowSeedData();
  const record = await prisma.personalityProfile.findUnique({
    where: { userId },
    include: { user: true },
  });

  if (!record) {
    return null;
  }

  return toStoredCard(record, record.user);
}

export async function getProfileByUserId(userId: string) {
  await ensureWorkflowSeedData();
  const record = await prisma.personalityProfile.findUnique({
    where: { userId },
    include: { user: true },
  });

  if (!record) {
    return null;
  }

  return toStoredProfile(record, record.user);
}

export async function getCurrentUserProfile(userId: string): Promise<CurrentUserProfilePayload | null> {
  const card = await getCardByUserId(userId);
  if (!card) {
    return null;
  }

  return {
    profile: card.profile,
    card,
  };
}

export async function getSecondMeWorkspaceStatus(userId: string): Promise<SecondMeWorkspaceStatus> {
  const account = await prisma.secondMeAccount.findUnique({
    where: { userId },
  });
  const writebacks = await listSecondMeWritebacks(userId);

  return {
    profileSyncedAt: account?.profileFetchedAt?.toISOString() ?? null,
    pendingWritebacks: writebacks.pending,
    recentWritebacks: writebacks.recent,
  };
}

export async function getSessionParticipants(sessionId: string) {
  const session = await getSessionRecord(sessionId);
  const users = await prisma.user.findMany({
    where: {
      id: {
        in: [session.userId, session.targetUserId],
      },
    },
    include: {
      personalityProfile: true,
    },
  });

  const userMap = new Map(users.map((user) => [user.id, user]));
  const initiator = userMap.get(session.userId);
  const target = userMap.get(session.targetUserId);

  if (!initiator || !target) {
    throw new Error("profiles not found");
  }

  return {
    userId: session.userId,
    targetUserId: session.targetUserId,
    initiator: toParticipantSummary(initiator, initiator.personalityProfile),
    target: toParticipantSummary(target, target.personalityProfile),
  };
}

export async function assertSessionActor(sessionId: string, userId: string) {
  const session = await getSessionRecord(sessionId);
  if (session.userId !== userId && session.targetUserId !== userId) {
    throw new Error("forbidden");
  }

  return session;
}

export async function listUserSessions(userId: string) {
  const sessions = await prisma.sandboxSession.findMany({
    where: {
      OR: [{ userId }, { targetUserId: userId }],
    },
    include: {
      manual: true,
      reconnectDecisions: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const groups = createEmptySessionGroups();
  if (sessions.length === 0) {
    return groups;
  }

  const participantIds = Array.from(
    new Set(
      sessions.map((session) =>
        session.userId === userId ? session.targetUserId : session.userId,
      ),
    ),
  );

  const participants = await prisma.user.findMany({
    where: {
      id: {
        in: participantIds,
      },
    },
    include: {
      personalityProfile: true,
    },
  });
  const participantMap = new Map(participants.map((user) => [user.id, user]));

  for (const session of sessions) {
    const counterpartId = session.userId === userId ? session.targetUserId : session.userId;
    const counterpart = participantMap.get(counterpartId);
    if (!counterpart) {
      continue;
    }

    const actorConfirmed = session.reconnectDecisions.some(
      (decision) => decision.userId === userId && decision.confirmed,
    );
    const counterpartConfirmed = session.reconnectDecisions.some(
      (decision) => decision.userId === counterpartId && decision.confirmed,
    );

    const summary: SessionSummary = {
      sessionId: session.id,
      source: (session.source as SessionSource) ?? "demo",
      state: session.state as SessionState,
      currentRound: session.currentRound,
      fitScore: session.fitScore ?? 0,
      recommendation: getRecommendation(session.recommendation),
      topic: {
        id: session.topicId,
        title: session.topicTitle,
        riskTags: parse<string[]>(session.topicRiskTagsJson),
      },
      counterpart: toParticipantSummary(counterpart, counterpart.personalityProfile),
      manualReady: Boolean(session.manual),
      actorConfirmed,
      counterpartConfirmed,
      updatedAt: session.updatedAt.toISOString(),
    };

    groups[toSessionBucket(summary.state)].push(summary);
  }

  return groups;
}

function buildLiveIntentFromProfile(profile: PersonalityProfile, listing?: PlazaListingRecord | null): MatchIntent {
  return {
    userId: profile.userId,
    lookingFor: listing?.lookingFor ?? profile.bestWith,
    mustHave: [profile.preferredWorkSplit, profile.suggestedLead],
    redFlags: [profile.frictionWith, profile.badStartPattern],
    scene: "公开广场 / 双向协作试探",
  };
}

export async function getPlazaListing(userId: string): Promise<PlazaListing | null> {
  const [listing, card] = await Promise.all([
    prisma.plazaListing.findUnique({
      where: { userId },
    }),
    getCardByUserId(userId),
  ]);

  if (!listing || !card) {
    return null;
  }

  return toPlazaListing(listing, card);
}

export async function getPlazaRelationship(userId: string, targetUserId: string) {
  const [targetListing, targetProfile, signals] = await Promise.all([
    prisma.plazaListing.findUnique({
      where: { userId: targetUserId },
    }),
    getProfileByUserId(targetUserId),
    prisma.matchSignal.findMany({
      where: {
        OR: [
          {
            fromUserId: userId,
            toUserId: targetUserId,
          },
          {
            fromUserId: targetUserId,
            toUserId: userId,
          },
        ],
      },
    }),
  ]);

  const outgoing = signals.find(
    (signal) => signal.fromUserId === userId && signal.toUserId === targetUserId,
  );
  const incoming = signals.find(
    (signal) => signal.fromUserId === targetUserId && signal.toUserId === userId,
  );
  const relationship = getPlazaRelationshipState({
    outgoingStatus: (outgoing?.status as MatchSignalStatus | undefined) ?? undefined,
    incomingStatus: (incoming?.status as MatchSignalStatus | undefined) ?? undefined,
  });

  return {
    relationship,
    sessionId: outgoing?.sessionId ?? incoming?.sessionId ?? undefined,
    targetAvailable: Boolean(targetListing?.enabled && targetProfile),
    targetKind: targetProfile?.userKind ?? ((targetListing ? "human" : undefined) as UserKind | undefined),
  };
}

export async function publishPlazaListing(input: PublishPlazaInput): Promise<PlazaListing> {
  const card = await getCardByUserId(input.userId);
  if (!card) {
    throw new Error("profile is required before publishing");
  }

  const profile = card.profile;
  const listing = await prisma.plazaListing.upsert({
    where: { userId: input.userId },
    update: {
      enabled: input.enabled,
      headline: input.headline?.trim() || defaultPlazaHeadline(profile),
      lookingFor: input.lookingFor?.trim() || defaultPlazaLookingFor(profile),
      focusTagsJson: json(
        input.focusTags?.filter(Boolean).slice(0, 4) ?? buildPlazaFocusTags(profile),
      ),
      availabilityNote: input.availabilityNote?.trim() || defaultAvailabilityNote(profile),
      lastActiveAt: input.enabled ? new Date() : null,
    },
    create: {
      userId: input.userId,
      enabled: input.enabled,
      headline: input.headline?.trim() || defaultPlazaHeadline(profile),
      lookingFor: input.lookingFor?.trim() || defaultPlazaLookingFor(profile),
      focusTagsJson: json(
        input.focusTags?.filter(Boolean).slice(0, 4) ?? buildPlazaFocusTags(profile),
      ),
      availabilityNote: input.availabilityNote?.trim() || defaultAvailabilityNote(profile),
      lastActiveAt: input.enabled ? new Date() : null,
    },
  });

  return toPlazaListing(listing, card);
}

export async function listPlazaFeed(userId: string): Promise<PlazaFeedItem[]> {
  const listings = await prisma.plazaListing.findMany({
    where: {
      enabled: true,
      userId: {
        not: userId,
      },
    },
    include: {
      user: {
        include: {
          personalityProfile: true,
        },
      },
    },
    orderBy: [
      {
        lastActiveAt: "desc",
      },
      {
        updatedAt: "desc",
      },
    ],
  });

  const eligibleListings = listings.filter(
    (listing) => Boolean(listing.user.personalityProfile),
  );
  const humanListings = eligibleListings.filter((listing) => listing.user.kind !== "agent");
  const agentListings = eligibleListings.filter((listing) => listing.user.kind === "agent");
  const visibleListings = [
    ...humanListings,
    ...agentListings.slice(0, Math.max(0, MIN_PLAZA_FEED_SIZE - humanListings.length)),
  ];

  if (visibleListings.length === 0) {
    return [];
  }

  const cards = visibleListings.map((listing) =>
    toStoredCard(listing.user.personalityProfile!, listing.user),
  );
  const listingByUserId = new Map(
    visibleListings.map((listing, index) => [listing.userId, toPlazaListing(listing, cards[index])]),
  );

  const counterpartIds = visibleListings.map((listing) => listing.userId);
  const signals = await prisma.matchSignal.findMany({
    where: {
      OR: [
        {
          fromUserId: userId,
          toUserId: {
            in: counterpartIds,
          },
        },
        {
          toUserId: userId,
          fromUserId: {
            in: counterpartIds,
          },
        },
      ],
    },
  });

  const items: PlazaFeedItem[] = [];

  for (const counterpartId of counterpartIds) {
      const listing = listingByUserId.get(counterpartId);
      if (!listing) {
        continue;
      }

      const outgoing = signals.find(
        (signal) => signal.fromUserId === userId && signal.toUserId === counterpartId,
      );
      const incoming = signals.find(
        (signal) => signal.toUserId === userId && signal.fromUserId === counterpartId,
      );
      const relationship = getPlazaRelationshipState({
        outgoingStatus: (outgoing?.status as MatchSignalStatus | undefined) ?? undefined,
        incomingStatus: (incoming?.status as MatchSignalStatus | undefined) ?? undefined,
      });

      items.push({
        listing,
        relationship,
        signalStatus: (outgoing?.status ?? incoming?.status ?? "none") as PlazaFeedItem["signalStatus"],
        sessionId: outgoing?.sessionId ?? incoming?.sessionId ?? undefined,
      });
  }

  return items.sort((left, right) => {
    const byRelationship =
      getPlazaRelationshipPriority(left.relationship) -
      getPlazaRelationshipPriority(right.relationship);
    if (byRelationship !== 0) {
      return byRelationship;
    }

    const leftActiveAt = left.listing.lastActiveAt ? Date.parse(left.listing.lastActiveAt) : 0;
    const rightActiveAt = right.listing.lastActiveAt ? Date.parse(right.listing.lastActiveAt) : 0;
    return rightActiveAt - leftActiveAt;
  });
}

async function createPlazaSession(input: MatchSignalInput) {
  const existing = await prisma.sandboxSession.findFirst({
    where: {
      source: "plaza",
      OR: [
        {
          userId: input.fromUserId,
          targetUserId: input.toUserId,
        },
        {
          userId: input.toUserId,
          targetUserId: input.fromUserId,
        },
      ],
      state: {
        in: ["matched", "sandboxing", "reconnect_ready"],
      },
    },
    include: {
      rounds: true,
      manual: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  if (existing) {
    return existing;
  }

  const [profiles, topics, initiatorListing] = await Promise.all([
    getProfilesForSession(input.fromUserId, input.toUserId),
    getTopTopics(),
    prisma.plazaListing.findUnique({
      where: { userId: input.fromUserId },
    }),
  ]);

  if (!profiles) {
    throw new Error("profiles not found");
  }

  const topic = topics[0];
  const sessionBlueprint = await runSandboxSession(topic, profiles.left, profiles.right);
  const liveIntent = buildLiveIntentFromProfile(profiles.left, initiatorListing);

  const intent = await prisma.matchIntent.create({
    data: {
      userId: input.fromUserId,
      targetUserId: input.toUserId,
      lookingFor: liveIntent.lookingFor,
      mustHaveJson: json(liveIntent.mustHave),
      redFlagsJson: json(liveIntent.redFlags),
      scene: liveIntent.scene,
    },
  });

  return prisma.sandboxSession.create({
    data: {
      matchIntentId: intent.id,
      userId: input.fromUserId,
      targetUserId: input.toUserId,
      source: "plaza",
      topicId: sessionBlueprint.topic.id,
      topicTitle: sessionBlueprint.topic.title,
      topicSourceUrl: sessionBlueprint.topic.sourceUrl,
      topicPrompt: sessionBlueprint.topic.prompt,
      topicRiskTagsJson: json(sessionBlueprint.topic.riskTags),
      fitScore: sessionBlueprint.fitScore,
      recommendation: sessionBlueprint.recommendation,
      conflictFlagsJson: json(sessionBlueprint.conflictFlags),
      currentRound: MAX_SANDBOX_ROUNDS,
      state: "sandboxing",
      rounds: {
        create: sessionBlueprint.rounds.map((round) => ({
          roundIndex: round.roundIndex,
          roundType: round.roundType,
          issue: round.issue,
          question: round.question,
          agentAResponse: round.agentAResponse,
          agentBResponse: round.agentBResponse,
          observerNote: round.observerNote,
          tensionPoint: round.tensionPoint,
          concession: round.concession,
          boundary: round.boundary,
          synthesis: round.synthesis,
          roundJson: json(round),
          fitScore: round.fitScore,
        })),
      },
    },
    include: {
      rounds: true,
      manual: true,
    },
  });
}

export async function sendMatchSignal(input: MatchSignalInput) {
  if (input.fromUserId === input.toUserId) {
    throw new Error("can not signal self");
  }

  const [fromProfile, toProfile, targetListing] = await Promise.all([
    getProfileByUserId(input.fromUserId),
    getProfileByUserId(input.toUserId),
    prisma.plazaListing.findUnique({
      where: { userId: input.toUserId },
    }),
  ]);

  if (!fromProfile) {
    throw new Error("profile is required before signaling");
  }

  if (!toProfile || !targetListing?.enabled) {
    throw new Error("target is not available in plaza");
  }

  await prisma.matchSignal.upsert({
    where: {
      fromUserId_toUserId: {
        fromUserId: input.fromUserId,
        toUserId: input.toUserId,
      },
    },
    update: {
      status: "pending",
    },
    create: {
      fromUserId: input.fromUserId,
      toUserId: input.toUserId,
      status: "pending",
    },
  });

  const reverse = await prisma.matchSignal.findUnique({
    where: {
      fromUserId_toUserId: {
        fromUserId: input.toUserId,
        toUserId: input.fromUserId,
      },
    },
  });

  if (!reverse || reverse.status === "dismissed") {
    await recordAnalyticsEvent({
      name: "signal_sent",
      actorUserId: input.fromUserId,
      actorKind: fromProfile.userKind,
      targetUserId: input.toUserId,
      targetKind: toProfile.userKind,
      sourcePage: input.sourcePage ?? "/match",
      meta: {
        flow: "plaza",
      },
    }).catch(() => null);

    return {
      state: "pending" as const,
      sessionId: undefined,
    };
  }

  const session = await createPlazaSession(input);

  await prisma.matchSignal.updateMany({
    where: {
      OR: [
        {
          fromUserId: input.fromUserId,
          toUserId: input.toUserId,
        },
        {
          fromUserId: input.toUserId,
          toUserId: input.fromUserId,
        },
      ],
    },
    data: {
      status: "mutual",
      sessionId: session.id,
    },
  });

  await Promise.all([
    recordAnalyticsEvent({
      name: "signal_returned",
      actorUserId: input.fromUserId,
      actorKind: fromProfile.userKind,
      targetUserId: input.toUserId,
      targetKind: toProfile.userKind,
      sessionId: session.id,
      sourcePage: input.sourcePage ?? "/match",
      meta: {
        flow: "plaza",
      },
    }).catch(() => null),
    recordAnalyticsEvent({
      name: "match_mutual",
      actorUserId: input.fromUserId,
      actorKind: fromProfile.userKind,
      targetUserId: input.toUserId,
      targetKind: toProfile.userKind,
      sessionId: session.id,
      sourcePage: input.sourcePage ?? "/match",
      meta: {
        flow: "plaza",
      },
    }).catch(() => null),
  ]);

  return {
    state: "mutual" as const,
    sessionId: session.id,
  };
}

export async function getPlazaWorkspace(userId: string): Promise<PlazaWorkspacePayload> {
  const [listing, signals] = await Promise.all([
    getPlazaListing(userId),
    prisma.matchSignal.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
  ]);

  const counterpartIds = Array.from(
    new Set(
      signals.map((signal) => (signal.fromUserId === userId ? signal.toUserId : signal.fromUserId)),
    ),
  );

  const counterparts = await prisma.user.findMany({
    where: {
      id: {
        in: counterpartIds,
      },
    },
    include: {
      personalityProfile: true,
      plazaListing: true,
    },
  });
  const counterpartMap = new Map(counterparts.map((user) => [user.id, user]));

  const incoming: PlazaSignalSummary[] = [];
  const outgoing: PlazaSignalSummary[] = [];
  const mutualMap = new Map<string, PlazaSignalSummary>();

  for (const signal of signals) {
    const counterpartId = signal.fromUserId === userId ? signal.toUserId : signal.fromUserId;
    const counterpart = counterpartMap.get(counterpartId);
    if (!counterpart) {
      continue;
    }

    const summary: PlazaSignalSummary = {
      signalId: signal.id,
      direction: signal.fromUserId === userId ? "outgoing" : "incoming",
      status: signal.status as MatchSignalStatus,
      sessionId: signal.sessionId ?? undefined,
      counterpart: toParticipantSummary(counterpart, counterpart.personalityProfile),
      headline:
        counterpart.plazaListing?.headline ??
        counterpart.personalityProfile?.cardSummary ??
        `${counterpart.name} 的双核预览`,
      updatedAt: signal.updatedAt.toISOString(),
    };

    if (summary.status === "mutual") {
      const mutualKey = summary.sessionId ?? [userId, counterpartId].sort().join(":");
      if (!mutualMap.has(mutualKey) || summary.direction === "outgoing") {
        mutualMap.set(mutualKey, summary);
      }
      continue;
    }

    if (summary.direction === "incoming") {
      incoming.push(summary);
    } else {
      outgoing.push(summary);
    }
  }

  return {
    listing,
    incoming,
    outgoing,
    mutual: Array.from(mutualMap.values()),
  };
}

export async function submitAssessment(input: SubmitAssessmentInput) {
  const name = input.name ?? "你";
  const roleTag = input.roleTag ?? "正在寻找双核搭子的人";
  const questions = await loadQuestions();

  if (input.answers.length !== questions.length) {
    throw new Error(`answers must include ${questions.length} items`);
  }

  const questionIds = new Set(questions.map((item) => item.id));
  const seen = new Set<string>();
  for (const answer of input.answers) {
    if (!questionIds.has(answer.questionId)) {
      throw new Error(`unknown questionId: ${answer.questionId}`);
    }

    if (seen.has(answer.questionId)) {
      throw new Error(`duplicate questionId: ${answer.questionId}`);
    }

    seen.add(answer.questionId);
  }

  const baseWmti = scoreAssessment(questions, input.answers);
  const synced = await syncSecondMeProfileSnapshot(input.userId).catch(() => null);
  const correctionResult = synced?.signals
    ? applySecondMeCorrection(baseWmti, synced.signals.axisHints)
    : { effective: baseWmti, correction: null };
  const baseProfile = buildPersonalityProfile(input.userId, name, roleTag, baseWmti);
  const reviewEvidence = Array.from(
    new Set(
      (synced?.signals?.axisHints ?? []).flatMap((hint) => hint.evidence).filter(Boolean),
    ),
  ).slice(0, 3);
  const secondMeReview = buildSecondMeReview({
    fetchedAt: synced?.fetchedAt ?? synced?.signals?.fetchedAt ?? null,
    sourceSummary: synced?.signals?.sourceSummary,
    collaborationSignals: synced?.signals?.collaborationSignals ?? [],
    evidence: reviewEvidence,
    correction: correctionResult.correction,
    signals: synced?.signals ?? undefined,
  });
  const profile = {
    ...buildPersonalityProfile(input.userId, name, roleTag, correctionResult.effective),
    baseWmti,
    secondMeReview,
  } satisfies PersonalityProfile;
  const card = await generateDualCoreCard(profile).catch(() => buildDualCoreCard(profile));

  await saveUserRecord({
    id: input.userId,
    name,
    roleTag,
    kind: "human",
    contactCard: `dualcore://profile/${input.userId}`,
  });

  const submission = await prisma.assessmentSubmission.create({
    data: {
      userId: input.userId,
      answersJson: json(input.answers),
      questionCount: input.answers.length,
    },
  });

  await upsertProfile(
    profile,
    card,
    input.userId !== DEMO_USER_ID && input.userId.startsWith("candidate-"),
    {
      baseWmti,
      correction: correctionResult.correction,
      secondMeReview,
    },
  );

  const writebackPrompt = await ensureSecondMeWriteback({
    userId: input.userId,
    milestone: "assessment_completed",
    assessmentId: submission.id,
  }).catch(() => null);

  return {
    state: "assessed" as SessionState,
    assessmentId: submission.id,
    baseProfile,
    effectiveProfile: profile,
    correction: correctionResult.correction,
    profile,
    card,
    writebackPrompt,
  };
}

export async function startMatch(input: StartMatchInput) {
  await ensureWorkflowSeedData();

  const defaultIntent = getDemoIntent();
  const currentUserProfile = await getProfileByUserId(input.userId);

  if (!canStartMatch(Boolean(currentUserProfile))) {
    throw new Error("profile is required before match");
  }

  const targetProfile = await getProfileByUserId(input.targetProfileId);
  if (!targetProfile) {
    throw new Error("target profile not found");
  }

  const topics = await getTopTopics();
  const topic = topics.find((item) => item.id === input.topicId) ?? topics[0];
  const sessionBlueprint = await runSandboxSession(topic, currentUserProfile!, targetProfile);
  const secondMeEvidenceSummary = buildSecondMeEvidenceSummary([currentUserProfile, targetProfile]);

  const intent = await prisma.matchIntent.create({
    data: {
      userId: input.userId,
      targetUserId: targetProfile.userId,
      lookingFor: defaultIntent.lookingFor,
      mustHaveJson: json(defaultIntent.mustHave),
      redFlagsJson: json(defaultIntent.redFlags),
      scene: defaultIntent.scene,
    },
  });

  const session = await prisma.sandboxSession.create({
    data: {
      matchIntentId: intent.id,
      userId: input.userId,
      targetUserId: targetProfile.userId,
      source: "demo",
      topicId: sessionBlueprint.topic.id,
      topicTitle: sessionBlueprint.topic.title,
      topicSourceUrl: sessionBlueprint.topic.sourceUrl,
      topicPrompt: sessionBlueprint.topic.prompt,
      topicRiskTagsJson: json(sessionBlueprint.topic.riskTags),
      fitScore: sessionBlueprint.fitScore,
      recommendation: sessionBlueprint.recommendation,
      conflictFlagsJson: json(sessionBlueprint.conflictFlags),
      state: "matched",
      rounds: {
        create: sessionBlueprint.rounds.map((round) => ({
          roundIndex: round.roundIndex,
          roundType: round.roundType,
          issue: round.issue,
          question: round.question,
          agentAResponse: round.agentAResponse,
          agentBResponse: round.agentBResponse,
          observerNote: round.observerNote,
          tensionPoint: round.tensionPoint,
          concession: round.concession,
          boundary: round.boundary,
          synthesis: round.synthesis,
          roundJson: json(round),
          fitScore: round.fitScore,
        })),
      },
    },
    include: {
      rounds: true,
      manual: true,
    },
  });

  return {
    intent: {
      userId: intent.userId,
      lookingFor: intent.lookingFor,
      mustHave: parse<string[]>(intent.mustHaveJson),
      redFlags: parse<string[]>(intent.redFlagsJson),
      scene: intent.scene,
    } satisfies MatchIntent,
    session: {
      ...toStoredSession(session, session.rounds, secondMeEvidenceSummary),
      manualReady: Boolean(session.manual),
    },
  };
}

export async function getSessionById(sessionId: string, actorUserId?: string) {
  if (actorUserId) {
    await assertSessionActor(sessionId, actorUserId);
  }

  const record = await prisma.sandboxSession.findUnique({
    where: { id: sessionId },
    include: {
      rounds: true,
      manual: true,
    },
  });

  if (!record) {
    return null;
  }

  const profiles = await getProfilesForSession(record.userId, record.targetUserId);
  const secondMeEvidenceSummary = profiles
    ? buildSecondMeEvidenceSummary([profiles.left, profiles.right])
    : undefined;

  return {
    ...toStoredSession(record, record.rounds, secondMeEvidenceSummary),
    manualReady: Boolean(record.manual),
  };
}

export async function advanceSandboxRound(input: AdvanceRoundInput) {
  const session = await prisma.sandboxSession.findUnique({
    where: { id: input.sessionId },
    include: { rounds: true },
  });

  if (!session) {
    throw new Error("session not found");
  }

  if (session.source === "plaza") {
    throw new Error("live plaza session is already generated");
  }

  if (!canAdvanceSandbox(session.state as SessionState)) {
    throw new Error("session can not advance");
  }

  const requestedRound = input.roundIndex ?? session.currentRound + 1;
  if (requestedRound < 1 || requestedRound > MAX_SANDBOX_ROUNDS) {
    throw new Error("round out of range");
  }

  if (requestedRound > session.currentRound + 1) {
    throw new Error("round must advance sequentially");
  }

  const round = session.rounds.find((item) => item.roundIndex === requestedRound);
  if (!round) {
    throw new Error("round not found");
  }

  const nextRound = Math.max(session.currentRound, requestedRound);
  const updated = await prisma.sandboxSession.update({
    where: { id: session.id },
    data: {
      currentRound: nextRound,
      state: getStateAfterRound(nextRound),
    },
  });

  return {
    session: toStoredSession(updated, session.rounds),
    round: {
      roundIndex: round.roundIndex,
      topicId: session.topicId,
      question: round.question,
      agentAResponse: round.agentAResponse,
      agentBResponse: round.agentBResponse,
      observerNote: round.observerNote,
      fitScore: round.fitScore,
    },
  };
}

export async function finalizeSandboxSession(input: FinalizeSessionInput) {
  const record = await prisma.sandboxSession.findUnique({
    where: { id: input.sessionId },
    include: {
      rounds: true,
      manual: true,
    },
  });

  if (!record) {
    throw new Error("session not found");
  }

  if (!canFinalizeSandbox(record.state as SessionState, record.currentRound)) {
    throw new Error("session is not ready to finalize");
  }

  const profiles = await getProfilesForSession(record.userId, record.targetUserId);
  if (!profiles) {
    throw new Error("profiles not found");
  }

  let manual = record.manual;
  if (!manual) {
    const topic = toTopic(record);
    const manualPayload = await generateCollaborationManual(topic, profiles.left, profiles.right).catch(
      () => buildCollaborationManual(record.id, profiles.left, profiles.right, topic),
    );

    manual = await prisma.collaborationManual.create({
      data: {
        sessionId: record.id,
        summary: manualPayload.summary,
        complementsJson: json(manualPayload.complements),
        riskPointsJson: json(manualPayload.riskPoints),
        communicationRulesJson: json(manualPayload.communicationRules),
        workSplitSuggestionsJson: json(manualPayload.workSplitSuggestions),
        zhihuAdviceRefsJson: json(manualPayload.zhihuAdviceRefs),
      },
    });
  }

  const secondMeEvidenceSummary = buildSecondMeEvidenceSummary([profiles.left, profiles.right]);

  const nextState = getStateAfterFinalize(getRecommendation(record.recommendation));
  const updated = await prisma.sandboxSession.update({
    where: { id: record.id },
    data: {
      state: nextState,
      finalizedAt: new Date(),
    },
    include: {
      rounds: true,
    },
  });

  if (input.userId) {
    await Promise.all([
      ensureSecondMeWriteback({
        userId: input.userId,
        milestone: "sandbox_finalized",
        sessionId: record.id,
      }).catch(() => null),
      ensureSecondMeWriteback({
        userId: input.userId,
        milestone: "manual_generated",
        sessionId: record.id,
      }).catch(() => null),
    ]);
  }

  return {
    session: {
      ...toStoredSession(updated, updated.rounds, secondMeEvidenceSummary),
      manualReady: true,
    },
    manual: toStoredManual(manual, secondMeEvidenceSummary),
    secondMeEvidenceSummary,
  };
}

export async function confirmReconnect(input: ReconnectInput) {
  const session = await prisma.sandboxSession.findUnique({
    where: { id: input.sessionId },
    include: {
      reconnectDecisions: true,
    },
  });

  if (!session) {
    throw new Error("session not found");
  }

  if (session.userId !== input.userId && session.targetUserId !== input.userId) {
    throw new Error("forbidden");
  }

  if (!canExchangeContacts(session.state as SessionState)) {
    throw new Error("session can not exchange contacts");
  }

  await prisma.reconnectDecision.upsert({
    where: {
      sessionId_userId: {
        sessionId: session.id,
        userId: input.userId,
      },
    },
    update: {
      confirmed: input.confirmed,
    },
    create: {
      sessionId: session.id,
      userId: input.userId,
      confirmed: input.confirmed,
    },
  });

  const refreshed = await prisma.sandboxSession.findUnique({
    where: { id: session.id },
    include: {
      reconnectDecisions: true,
    },
  });

  const decisions = refreshed?.reconnectDecisions ?? [];
  const exchanged = areBothConfirmed(decisions, [session.userId, session.targetUserId]);

  if (exchanged && refreshed?.state !== "exchanged") {
    await prisma.sandboxSession.update({
      where: { id: session.id },
      data: {
        state: "exchanged",
      },
    });
  }

  if (exchanged) {
    await ensureSecondMeWriteback({
      userId: input.userId,
      milestone: "reconnect_exchanged",
      sessionId: session.id,
    }).catch(() => null);
  }

  const profiles = await getProfilesForSession(session.userId, session.targetUserId);
  if (!profiles) {
    throw new Error("profiles not found");
  }

  const actorProfile =
    profiles.left.userId === input.userId ? profiles.left : profiles.right.userId === input.userId ? profiles.right : null;
  const targetProfile =
    profiles.left.userId === input.userId ? profiles.right : profiles.left;

  await recordAnalyticsEvent({
    name: "reconnect_confirm",
    actorUserId: input.userId,
    actorKind: actorProfile?.userKind ?? "human",
    targetUserId: targetProfile.userId,
    targetKind: targetProfile.userKind,
    sessionId: session.id,
    sourcePage: "/reconnect",
    meta: {
      confirmed: input.confirmed,
      exchanged,
    },
  }).catch(() => null);

  return {
    state: exchanged ? "exchanged" : "reconnect_ready",
    cards: buildReconnectCards(session.id, profiles.left, profiles.right, exchanged),
  };
}

export async function getReconnectPayload(sessionId: string, actorUserId?: string) {
  if (actorUserId) {
    await assertSessionActor(sessionId, actorUserId);
  }

  const [session, manualRecord] = await Promise.all([
    prisma.sandboxSession.findUnique({
      where: { id: sessionId },
      include: {
        reconnectDecisions: true,
      },
    }),
    prisma.collaborationManual.findUnique({
      where: { sessionId },
    }),
  ]);

  if (!session || !manualRecord) {
    return null;
  }

  const profiles = await getProfilesForSession(session.userId, session.targetUserId);
  if (!profiles) {
    return null;
  }

  const exchanged = areBothConfirmed(session.reconnectDecisions, [session.userId, session.targetUserId]);
  const secondMeEvidenceSummary = buildSecondMeEvidenceSummary([profiles.left, profiles.right]);

  if (actorUserId) {
    await Promise.all([
      ensureSecondMeWriteback({
        userId: actorUserId,
        milestone: "sandbox_finalized",
        sessionId,
      }).catch(() => null),
      ensureSecondMeWriteback({
        userId: actorUserId,
        milestone: "manual_generated",
        sessionId,
      }).catch(() => null),
      ...(exchanged
        ? [
            ensureSecondMeWriteback({
              userId: actorUserId,
              milestone: "reconnect_exchanged",
              sessionId,
            }).catch(() => null),
          ]
        : []),
    ]);
  }

  const sessionWritebacks = actorUserId
    ? await listSecondMeWritebacks(actorUserId).then((items) =>
        [...items.pending, ...items.recent].filter((item) => item.targetKey.endsWith(`:${sessionId}`)),
      )
    : [];

  return {
    manual: toStoredManual(manualRecord, secondMeEvidenceSummary),
    cards: buildReconnectCards(session.id, profiles.left, profiles.right, exchanged),
    state: (exchanged ? "exchanged" : session.state) as SessionState,
    session: {
      sessionId: session.id,
      fitScore: session.fitScore ?? 0,
      recommendation: getRecommendation(session.recommendation),
      topic: {
        id: session.topicId,
        title: session.topicTitle,
        sourceUrl: session.topicSourceUrl,
        prompt: session.topicPrompt,
        riskTags: parse<string[]>(session.topicRiskTagsJson),
      },
      conflictFlags: session.conflictFlagsJson ? parse<ConflictFlag[]>(session.conflictFlagsJson) : [],
      secondMeEvidenceSummary,
    },
    decisions: {
      [session.userId]: session.reconnectDecisions.some(
        (decision) => decision.userId === session.userId && decision.confirmed,
      ),
      [session.targetUserId]: session.reconnectDecisions.some(
        (decision) => decision.userId === session.targetUserId && decision.confirmed,
      ),
    },
    writebacks: sessionWritebacks,
  };
}

export async function resetWorkflowData() {
  await prisma.analyticsEvent.deleteMany();
  await prisma.secondMeWriteback.deleteMany();
  await prisma.reconnectDecision.deleteMany();
  await prisma.collaborationManual.deleteMany();
  await prisma.sandboxRound.deleteMany();
  await prisma.sandboxSession.deleteMany();
  await prisma.matchSignal.deleteMany();
  await prisma.matchIntent.deleteMany();
  await prisma.plazaListing.deleteMany();
  await prisma.personalityProfile.deleteMany();
  await prisma.assessmentSubmission.deleteMany();
  await prisma.secondMeAccount.deleteMany();
  await prisma.user.deleteMany();
}
