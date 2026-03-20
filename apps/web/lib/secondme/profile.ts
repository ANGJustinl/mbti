import type {
  SecondMeAxisHint,
  SecondMeProfileSignals,
  WmtiDimension,
  WmtiCode,
} from "@dual-core/domain";

import { prisma } from "../db";
import { SECOND_ME_USER_PREFIX } from "../current-user";
import { getSecondMeProfileData, runSecondMeActJson } from "./auth";
import type { SecondMeShade, SecondMeSoftMemoryItem } from "./client";

const PROFILE_SYNC_TTL_MS = 24 * 60 * 60 * 1000;

interface SignalsActResult {
  axisHints?: Array<{
    dimension?: string;
    code?: string;
    confidence?: number;
    evidence?: string[];
  }>;
  collaborationSignals?: string[];
  sourceSummary?: string;
}

type RawAxisHint = NonNullable<SignalsActResult["axisHints"]>[number];

function json<T>(value: T) {
  return JSON.stringify(value);
}

function parse<T>(value: string | null | undefined): T | null {
  if (!value) {
    return null;
  }

  return JSON.parse(value) as T;
}

function isSecondMeUserId(userId: string) {
  return userId.startsWith(SECOND_ME_USER_PREFIX);
}

function normalizeEvidence(items: unknown) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, 3);
}

function normalizeAxisHint(raw: RawAxisHint): SecondMeAxisHint | null {
  if (!raw) {
    return null;
  }

  const dimension = raw.dimension as WmtiDimension | undefined;
  const code = raw.code as WmtiCode | undefined;
  if (
    !dimension ||
    !code ||
    !["energy", "perception", "decision", "execution"].includes(dimension) ||
    !["E", "I", "S", "N", "T", "F", "J", "P"].includes(code)
  ) {
    return null;
  }

  const confidence =
    typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
      ? Math.max(0, Math.min(1, raw.confidence))
      : 0;

  return {
    dimension,
    code,
    confidence,
    evidence: normalizeEvidence(raw.evidence),
  };
}

function summarizeShades(shades: SecondMeShade[]) {
  return shades
    .slice(0, 8)
    .map((shade) =>
      [
        shade.shadeName ?? "未命名侧写",
        shade.confidenceLevel ? `置信 ${shade.confidenceLevel}` : null,
        shade.shadeDescriptionThirdView ?? shade.shadeDescription ?? null,
        shade.shadeContentThirdView ?? shade.shadeContent ?? null,
      ]
        .filter(Boolean)
        .join(" | "),
    );
}

function summarizeSoftMemory(items: SecondMeSoftMemoryItem[]) {
  return items
    .slice(0, 12)
    .map((item) =>
      [item.factObject ?? "记忆条目", item.factContent ?? ""].filter(Boolean).join(": "),
    );
}

async function inferSecondMeSignals(
  shades: SecondMeShade[],
  softMemory: SecondMeSoftMemoryItem[],
  fetchedAt: string,
) {
  if (shades.length === 0 || softMemory.length === 0) {
    return null;
  }

  const result = await runSecondMeActJson<SignalsActResult>({
    systemPrompt: "你是双核职场的画像复核器，只能根据用户已授权的 Second Me 侧写与软记忆提炼结构化协作信号。",
    message: [
      "[Shades]",
      summarizeShades(shades).join("\n"),
      "",
      "[Soft Memory]",
      summarizeSoftMemory(softMemory).join("\n"),
    ].join("\n"),
    actionControl: [
      "仅输出合法 JSON，不要解释。",
      '结构: {"axisHints": [{"dimension": "energy"|"perception"|"decision"|"execution", "code": "E"|"I"|"S"|"N"|"T"|"F"|"J"|"P", "confidence": number, "evidence": string[]}], "collaborationSignals": string[], "sourceSummary": string}',
      "只在证据充分时输出 axisHints；confidence 为 0 到 1。",
      "evidence 必须来自输入材料，不要编造。",
      "collaborationSignals 返回最多 3 条具体协作倾向。",
      '如果证据不足，axisHints 返回 []，sourceSummary 写为 "Second Me 侧写不足以复核量表"。',
    ].join("\n"),
  });

  const axisHints = (result.axisHints ?? []).map(normalizeAxisHint).filter(Boolean) as SecondMeAxisHint[];
  const collaborationSignals = Array.isArray(result.collaborationSignals)
    ? result.collaborationSignals.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 3)
    : [];

  return {
    axisHints,
    collaborationSignals,
    sourceSummary:
      typeof result.sourceSummary === "string" && result.sourceSummary.trim().length > 0
        ? result.sourceSummary.trim()
        : "Second Me 已完成侧写同步。",
    fetchedAt,
  } satisfies SecondMeProfileSignals;
}

export async function getStoredSecondMeSignals(userId: string) {
  if (!isSecondMeUserId(userId)) {
    return null;
  }

  const account = await prisma.secondMeAccount.findUnique({
    where: { userId },
  });
  if (!account) {
    return null;
  }

  return {
    shades: parse<SecondMeShade[]>(account.shadesJson) ?? [],
    softMemory: parse<SecondMeSoftMemoryItem[]>(account.softMemoryJson) ?? [],
    signals: parse<SecondMeProfileSignals>(account.profileSignalsJson),
    fetchedAt: account.profileFetchedAt?.toISOString() ?? null,
  };
}

export async function syncSecondMeProfileSnapshot(userId: string, options?: { force?: boolean }) {
  if (!isSecondMeUserId(userId)) {
    return null;
  }

  const account = await prisma.secondMeAccount.findUnique({
    where: { userId },
  });
  const now = Date.now();
  const cachedSignals = parse<SecondMeProfileSignals>(account?.profileSignalsJson);
  const fetchedAt = account?.profileFetchedAt?.getTime() ?? 0;

  if (!options?.force && cachedSignals && fetchedAt && now - fetchedAt < PROFILE_SYNC_TTL_MS) {
    return {
      shades: parse<SecondMeShade[]>(account?.shadesJson) ?? [],
      softMemory: parse<SecondMeSoftMemoryItem[]>(account?.softMemoryJson) ?? [],
      signals: cachedSignals,
      fetchedAt: account?.profileFetchedAt?.toISOString() ?? null,
    };
  }

  const { session, shades, softMemory } = await getSecondMeProfileData();
  const secondmeUserId = session.user?.secondmeUserId;
  if (!secondmeUserId || `${SECOND_ME_USER_PREFIX}${secondmeUserId}` !== userId) {
    return null;
  }

  const syncedAt = new Date().toISOString();
  const signals = await inferSecondMeSignals(shades, softMemory, syncedAt).catch(() => null);

  await prisma.secondMeAccount.update({
    where: { secondmeUserId },
    data: {
      shadesJson: json(shades),
      softMemoryJson: json(softMemory),
      profileSignalsJson: signals ? json(signals) : null,
      profileFetchedAt: new Date(syncedAt),
    },
  });

  return {
    shades,
    softMemory,
    signals,
    fetchedAt: syncedAt,
  };
}
