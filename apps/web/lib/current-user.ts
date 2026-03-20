import { buildDualCoreCard, buildPersonalityProfile, type DualCoreCard } from "@dual-core/domain";
import type { PersonalityProfile as PersonalityProfileRecord, User } from "../generated/prisma/client";

import { prisma } from "./db";
import { readSecondMeSession, type SecondMeSession } from "./secondme/session";

export const DEMO_USER_ID = "demo-you";
export const SECOND_ME_USER_PREFIX = "sm:";

export interface CurrentUserContext {
  userId: string;
  displayName: string;
  roleTag: string;
  source: "secondme" | "demo";
  hasProfile: boolean;
  needsAssessment: boolean;
  secondmeUserId?: string;
  route?: string;
  demoMode: boolean;
}

function json<T>(value: T) {
  return JSON.stringify(value);
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

export function buildDefaultDemoProfile() {
  return buildPersonalityProfile(
    DEMO_USER_ID,
    "你",
    "正在寻找双核搭子的人",
    {
      letters: "INTJ",
      axes: [
        { dimension: "energy", leftCode: "E", rightCode: "I", leftCount: 3, rightCount: 7, dominantCode: "I", confidence: 0.4 },
        { dimension: "perception", leftCode: "S", rightCode: "N", leftCount: 3, rightCount: 7, dominantCode: "N", confidence: 0.4 },
        { dimension: "decision", leftCode: "T", rightCode: "F", leftCount: 7, rightCount: 3, dominantCode: "T", confidence: 0.4 },
        { dimension: "execution", leftCode: "J", rightCode: "P", leftCount: 7, rightCount: 3, dominantCode: "J", confidence: 0.4 },
      ],
      confidence: 0.4,
    },
  );
}

function toSecondMeUserId(secondmeUserId: string) {
  return `${SECOND_ME_USER_PREFIX}${secondmeUserId}`;
}

export function isDevelopmentMode() {
  return process.env.NODE_ENV !== "production";
}

export function isDemoRequested(value: string | null | undefined) {
  return value === "1" || value === "true" || value === "demo";
}

async function loadProfileRecord(userId: string) {
  return prisma.personalityProfile.findUnique({
    where: { userId },
  });
}

async function ensureDemoFallbackUser() {
  const profile = buildDefaultDemoProfile();
  const card = buildDualCoreCard(profile);

  await saveUserRecord({
    id: DEMO_USER_ID,
    name: profile.name,
    roleTag: profile.roleTag,
    contactCard: `dualcore://profile/${DEMO_USER_ID}`,
    isSeedCandidate: false,
  });

  const existingProfile = await prisma.personalityProfile.findUnique({
    where: { userId: DEMO_USER_ID },
  });
  const profileData = {
    userId: DEMO_USER_ID,
    wmtiLetters: profile.wmti.letters,
    wmtiJson: json(profile.wmti),
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
      where: { userId: DEMO_USER_ID },
      data: profileData,
    });
  } else {
    await prisma.personalityProfile.create({
      data: profileData,
    });
  }
}

async function upsertSecondMeUser(session: SecondMeSession) {
  if (!session.user?.secondmeUserId) {
    return null;
  }

  const userId = toSecondMeUserId(session.user.secondmeUserId);
  const displayName = session.user.name ?? session.user.route ?? "Second Me 用户";
  const roleTag = "已连接 Second Me，等待完善协作画像";

  const user = await saveUserRecord({
    id: userId,
    name: displayName,
    roleTag,
    contactCard: `dualcore://profile/${userId}`,
  });

  const existingAccount = await prisma.secondMeAccount.findUnique({
    where: {
      secondmeUserId: session.user.secondmeUserId,
    },
  });
  const accountData = {
    userId: user.id,
    secondmeUserId: session.user.secondmeUserId,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    tokenExpiresAt: new Date(session.expiresAt),
    scopeJson: json(session.scope),
    name: session.user.name,
    email: session.user.email,
    avatarUrl: session.user.avatarUrl,
    route: session.user.route,
  };

  if (existingAccount) {
    await prisma.secondMeAccount.update({
      where: {
        secondmeUserId: session.user.secondmeUserId,
      },
      data: accountData,
    });
  } else {
    await prisma.secondMeAccount.create({
      data: accountData,
    });
  }

  return user;
}

function buildContextFromUser(
  user: User,
  profile: PersonalityProfileRecord | null,
  source: CurrentUserContext["source"],
  options?: {
    demoMode?: boolean;
    secondmeUserId?: string;
    route?: string;
  },
): CurrentUserContext {
  return {
    userId: user.id,
    displayName: user.name,
    roleTag: user.roleTag,
    source,
    hasProfile: Boolean(profile),
    needsAssessment: !profile,
    secondmeUserId: options?.secondmeUserId,
    route: options?.route,
    demoMode: Boolean(options?.demoMode),
  };
}

export async function saveSecondMeAccount(session: {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string[];
  user?: {
    secondmeUserId?: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
    route?: string;
  };
}) {
  if (!session.user?.secondmeUserId) {
    return null;
  }

  return upsertSecondMeUser(session as SecondMeSession);
}

export async function resolveCurrentUserContext(options?: {
  allowDemoFallback?: boolean;
  demoRequested?: boolean;
}) {
  const session = await readSecondMeSession();

  if (session?.user?.secondmeUserId) {
    const user = await upsertSecondMeUser(session);
    if (!user) {
      return null;
    }

    const profile = await loadProfileRecord(user.id);
    return buildContextFromUser(user, profile, "secondme", {
      secondmeUserId: session.user.secondmeUserId,
      route: session.user.route,
    });
  }

  if (options?.allowDemoFallback && options.demoRequested && isDevelopmentMode()) {
    await ensureDemoFallbackUser();
    const user = await prisma.user.findUnique({
      where: { id: DEMO_USER_ID },
    });
    if (!user) {
      return null;
    }

    const profile = await loadProfileRecord(user.id);
    return buildContextFromUser(user, profile, "demo", {
      demoMode: true,
    });
  }

  return null;
}
