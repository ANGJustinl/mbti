import {
  MAX_SANDBOX_ROUNDS,
  buildCollaborationManual,
  buildDualCoreCard,
  buildPersonalityProfile,
  canAdvanceSandbox,
  canExchangeContacts,
  canFinalizeSandbox,
  canStartMatch,
  type ConflictFlag,
  getStateAfterFinalize,
  getStateAfterRound,
  scoreAssessment,
  type AssessmentAnswer,
  type CollaborationManual,
  type DebateTopic,
  type DualCoreCard,
  type MatchIntent,
  type PersonalityProfile,
  type ReconnectCard,
  type Recommendation,
  type SandboxSession,
  type SessionState,
  type WmtiResult,
} from "@dual-core/domain";
import type {
  CollaborationManual as CollaborationManualRecord,
  MatchIntent as MatchIntentRecord,
  PersonalityProfile as PersonalityProfileRecord,
  ReconnectDecision,
  SandboxRound as SandboxRoundRecord,
  SandboxSession as SandboxSessionRecord,
  User,
} from "../generated/prisma/client";

import { DEMO_USER_ID, buildDefaultDemoProfile } from "./current-user";
import { prisma } from "./db";
import { getDemoIntent, getTopTopics } from "./demo";
import {
  generateCollaborationManual,
  generateDualCoreCard,
  runSandboxSession,
} from "./integrations/secondme";
import { loadCandidates, loadQuestions } from "./loaders";

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

interface AdvanceRoundInput {
  sessionId: string;
  roundIndex?: number;
}

interface FinalizeSessionInput {
  sessionId: string;
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
  wmtiLetters?: string;
  lifeModeTitle?: string;
  workModeTitle?: string;
}

export interface SessionSummary {
  sessionId: string;
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

function json<T>(value: T) {
  return JSON.stringify(value);
}

function parse<T>(value: string): T {
  return JSON.parse(value) as T;
}

async function saveUserRecord(input: {
  id: string;
  name: string;
  roleTag: string;
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

function toStoredProfile(record: PersonalityProfileRecord, user: User): PersonalityProfile {
  return {
    userId: record.userId,
    name: user.name,
    roleTag: user.roleTag,
    wmti: parse<WmtiResult>(record.wmtiJson),
    lifeModeTitle: record.lifeModeTitle,
    workModeTitle: record.workModeTitle,
    strengths: parse<string[]>(record.strengthsJson),
    risks: parse<string[]>(record.risksJson),
    collaborationStyle: parse<string[]>(record.collaborationStyleJson),
  };
}

function toStoredCard(record: PersonalityProfileRecord, user: User): DualCoreCard {
  return {
    profile: toStoredProfile(record, user),
    summary: record.cardSummary,
    tagline: record.cardTagline,
    actionHints: parse<string[]>(record.actionHintsJson),
  };
}

function buildReconnectCards(
  sessionId: string,
  left: PersonalityProfile,
  right: PersonalityProfile,
  exchanged: boolean,
): ReconnectCard[] {
  return [
    {
      sessionId: `${sessionId}-${left.userId}`,
      userId: left.userId,
      displayName: left.name,
      title: left.workModeTitle,
      contactHint: "双方确认后展示站内数字名片",
      contactValue: exchanged ? `dualcore://profile/${left.userId}` : undefined,
    },
    {
      sessionId: `${sessionId}-${right.userId}`,
      userId: right.userId,
      displayName: right.name,
      title: right.workModeTitle,
      contactHint: "双方确认后展示站内数字名片",
      contactValue: exchanged ? `dualcore://profile/${right.userId}` : undefined,
    },
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
): SandboxSession {
  return {
    sessionId: record.id,
    topic: toTopic(record),
    recommendation: getRecommendation(record.recommendation),
    fitScore: record.fitScore ?? 0,
    rounds: rounds
      .sort((left, right) => left.roundIndex - right.roundIndex)
      .map((round) => ({
        roundIndex: round.roundIndex,
        topicId: record.topicId,
        question: round.question,
        agentAResponse: round.agentAResponse,
        agentBResponse: round.agentBResponse,
        observerNote: round.observerNote,
        fitScore: round.fitScore,
      })),
    conflictFlags: record.conflictFlagsJson ? parse(record.conflictFlagsJson) : [],
    state: record.state as SessionState,
    currentRound: record.currentRound,
  };
}

function toStoredManual(record: CollaborationManualRecord): CollaborationManual {
  return {
    sessionId: record.sessionId,
    summary: record.summary,
    complements: parse<string[]>(record.complementsJson),
    riskPoints: parse<string[]>(record.riskPointsJson),
    communicationRules: parse<string[]>(record.communicationRulesJson),
    workSplitSuggestions: parse<string[]>(record.workSplitSuggestionsJson),
    zhihuAdviceRefs: parse<CollaborationManual["zhihuAdviceRefs"]>(record.zhihuAdviceRefsJson),
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
    wmtiLetters: profileRecord?.wmtiLetters,
    lifeModeTitle: profileRecord?.lifeModeTitle,
    workModeTitle: profileRecord?.workModeTitle,
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

async function upsertProfile(profile: PersonalityProfile, card: DualCoreCard, isSeedCandidate = false) {
  await saveUserRecord({
    id: profile.userId,
    name: profile.name,
    roleTag: profile.roleTag,
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
    lifeModeTitle: profile.lifeModeTitle,
    workModeTitle: profile.workModeTitle,
    strengthsJson: json(profile.strengths),
    risksJson: json(profile.risks),
    collaborationStyleJson: json(profile.collaborationStyle),
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
      }),
      lifeModeTitle: seed.lifeModeTitle,
      workModeTitle: seed.workModeTitle,
      strengths: seed.strengths,
      risks: seed.risks,
      collaborationStyle: seed.collaborationStyle,
    };
    const card = buildDualCoreCard(profile);
    await upsertProfile(profile, card, true);
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

  const wmti = scoreAssessment(questions, input.answers);
  const profile = buildPersonalityProfile(input.userId, name, roleTag, wmti);
  const card = await generateDualCoreCard(profile).catch(() => buildDualCoreCard(profile));

  await saveUserRecord({
    id: input.userId,
    name,
    roleTag,
    contactCard: `dualcore://profile/${input.userId}`,
  });

  await prisma.assessmentSubmission.create({
    data: {
      userId: input.userId,
      answersJson: json(input.answers),
      questionCount: input.answers.length,
    },
  });

  await upsertProfile(profile, card, input.userId !== DEMO_USER_ID && input.userId.startsWith("candidate-"));

  return {
    state: "assessed" as SessionState,
    profile,
    card,
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
          question: round.question,
          agentAResponse: round.agentAResponse,
          agentBResponse: round.agentBResponse,
          observerNote: round.observerNote,
          fitScore: round.fitScore,
        })),
      },
    },
    include: {
      rounds: true,
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
    session: toStoredSession(session, session.rounds),
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
    },
  });

  if (!record) {
    return null;
  }

  return toStoredSession(record, record.rounds);
}

export async function advanceSandboxRound(input: AdvanceRoundInput) {
  const session = await prisma.sandboxSession.findUnique({
    where: { id: input.sessionId },
    include: { rounds: true },
  });

  if (!session) {
    throw new Error("session not found");
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

  return {
    session: toStoredSession(updated, updated.rounds),
    manual: toStoredManual(manual),
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

  const profiles = await getProfilesForSession(session.userId, session.targetUserId);
  if (!profiles) {
    throw new Error("profiles not found");
  }

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

  return {
    manual: toStoredManual(manualRecord),
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
    },
    decisions: {
      [session.userId]: session.reconnectDecisions.some(
        (decision) => decision.userId === session.userId && decision.confirmed,
      ),
      [session.targetUserId]: session.reconnectDecisions.some(
        (decision) => decision.userId === session.targetUserId && decision.confirmed,
      ),
    },
  };
}

export async function resetWorkflowData() {
  await prisma.reconnectDecision.deleteMany();
  await prisma.collaborationManual.deleteMany();
  await prisma.sandboxRound.deleteMany();
  await prisma.sandboxSession.deleteMany();
  await prisma.matchIntent.deleteMany();
  await prisma.personalityProfile.deleteMany();
  await prisma.assessmentSubmission.deleteMany();
  await prisma.secondMeAccount.deleteMany();
  await prisma.user.deleteMany();
}
