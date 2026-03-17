import {
  buildCollaborationManual,
  buildDualCoreCard,
  buildPersonalityProfile,
  buildSandboxSession,
  type AxisScore,
  type DebateTopic,
  type MatchIntent,
  type PersonalityProfile,
  type ReconnectCard,
  type WmtiDimension,
  type WmtiResult,
} from "@dual-core/domain";

import { getZhihuTopics } from "./integrations/zhihu";
import { loadCandidates, loadTopics, type CandidateSeed } from "./loaders";

const presetMap: Record<WmtiDimension, [string, string]> = {
  energy: ["E", "I"],
  perception: ["S", "N"],
  decision: ["T", "F"],
  execution: ["J", "P"],
};

function buildAxisScore(
  dimension: WmtiDimension,
  dominantCode: string,
): AxisScore {
  const [leftCode, rightCode] = presetMap[dimension];
  const leftDominant = dominantCode === leftCode;

  return {
    dimension,
    leftCode: leftCode as AxisScore["leftCode"],
    rightCode: rightCode as AxisScore["rightCode"],
    leftCount: leftDominant ? 7 : 3,
    rightCount: leftDominant ? 3 : 7,
    dominantCode: dominantCode as AxisScore["dominantCode"],
    confidence: 0.4,
  };
}

export function buildPresetWmtiResult(letters: string): WmtiResult {
  const axes = [
    buildAxisScore("energy", letters[0]),
    buildAxisScore("perception", letters[1]),
    buildAxisScore("decision", letters[2]),
    buildAxisScore("execution", letters[3]),
  ];

  return {
    letters,
    axes,
    confidence: 0.4,
  };
}

function seedToProfile(seed: CandidateSeed): PersonalityProfile {
  const profile = buildPersonalityProfile(
    seed.userId,
    seed.name,
    seed.roleTag,
    buildPresetWmtiResult(seed.letters),
  );

  return {
    ...profile,
    lifeModeTitle: seed.lifeModeTitle,
    workModeTitle: seed.workModeTitle,
    strengths: seed.strengths,
    risks: seed.risks,
    collaborationStyle: seed.collaborationStyle,
  };
}

export async function getCandidateProfiles() {
  const seeds = await loadCandidates();
  return seeds.map(seedToProfile);
}

export function getDemoUserProfile() {
  return buildPersonalityProfile(
    "demo-you",
    "你",
    "正在寻找双核搭子的人",
    buildPresetWmtiResult("INTJ"),
  );
}

export function getDemoIntent(): MatchIntent {
  return {
    userId: "demo-you",
    lookingFor: "技术与产品能互补、能扛住冲突的长期搭子",
    mustHave: ["能接受异步协作", "愿意写文档", "遇到分歧能讨论机制"],
    redFlags: ["只靠感觉拍板", "高频失联", "回避冲突"],
    scene: "创业 / Side Project / 高压协作",
  };
}

export async function getTopicById(topicId?: string) {
  const topics = await getTopTopics();

  if (topicId) {
    const topic = topics.find((item) => item.id === topicId);
    if (topic) {
      return topic;
    }
  }

  return topics[0];
}

export async function getCandidateById(candidateId?: string) {
  const candidates = await getCandidateProfiles();
  if (candidateId) {
    const candidate = candidates.find((item) => item.userId === candidateId);
    if (candidate) {
      return candidate;
    }
  }

  return candidates[0];
}

export async function getDemoCard(userId?: string) {
  const profile =
    userId && userId !== "demo-you"
      ? await getCandidateById(userId)
      : getDemoUserProfile();

  return buildDualCoreCard(profile);
}

export async function getDemoSession(candidateId?: string, topicId?: string) {
  const [topic, candidate] = await Promise.all([
    getTopicById(topicId),
    getCandidateById(candidateId),
  ]);

  return buildSandboxSession(
    `session-${candidate.userId}-${topic.id}`,
    topic,
    getDemoUserProfile(),
    candidate,
  );
}

export async function getDemoManual(candidateId?: string, topicId?: string) {
  const [topic, candidate] = await Promise.all([
    getTopicById(topicId),
    getCandidateById(candidateId),
  ]);

  return buildCollaborationManual(
    `manual-${candidate.userId}-${topic.id}`,
    getDemoUserProfile(),
    candidate,
    topic,
  );
}

export async function getReconnectCards(candidateId?: string): Promise<ReconnectCard[]> {
  const candidate = await getCandidateById(candidateId);

  return [
    {
      sessionId: `reconnect-demo-you`,
      userId: "demo-you",
      displayName: "你",
      title: getDemoUserProfile().workModeTitle,
      contactHint: "已确认后展示站内数字名片",
      contactValue: "dualcore://profile/demo-you",
    },
    {
      sessionId: `reconnect-${candidate.userId}`,
      userId: candidate.userId,
      displayName: candidate.name,
      title: candidate.workModeTitle,
      contactHint: "已确认后展示站内数字名片",
      contactValue: `dualcore://profile/${candidate.userId}`,
    },
  ];
}

export async function getTopTopics(): Promise<DebateTopic[]> {
  return getZhihuTopics().catch(() => loadTopics());
}
