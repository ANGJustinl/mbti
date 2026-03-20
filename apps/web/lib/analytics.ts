import type { UserKind } from "@dual-core/domain";

import { prisma } from "./db";

export type AnalyticsEventName =
  | "plaza_feed_view"
  | "card_view"
  | "signal_sent"
  | "signal_returned"
  | "match_mutual"
  | "arena_view"
  | "manual_view"
  | "reconnect_confirm";

interface AnalyticsEventInput {
  name: AnalyticsEventName;
  actorUserId: string;
  actorKind?: UserKind;
  targetUserId?: string;
  targetKind?: UserKind;
  sessionId?: string;
  sourcePage: string;
  meta?: Record<string, unknown>;
}

async function resolveUserKind(userId?: string | null): Promise<UserKind | undefined> {
  if (!userId) {
    return undefined;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { kind: true },
  });

  return (user?.kind as UserKind | undefined) ?? undefined;
}

export async function recordAnalyticsEvent(input: AnalyticsEventInput) {
  const actorKind = input.actorKind ?? (await resolveUserKind(input.actorUserId)) ?? "human";
  const targetKind = input.targetKind ?? (await resolveUserKind(input.targetUserId)) ?? undefined;

  await prisma.analyticsEvent.create({
    data: {
      name: input.name,
      actorUserId: input.actorUserId,
      actorKind,
      targetUserId: input.targetUserId,
      targetKind,
      sessionId: input.sessionId,
      sourcePage: input.sourcePage,
      metaJson: input.meta ? JSON.stringify(input.meta) : null,
    },
  });
}
