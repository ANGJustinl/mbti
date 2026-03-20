import { buildDualCoreCard } from "@dual-core/domain";
import { describe, expect, it } from "vitest";

import { buildDefaultDemoProfile, type CurrentUserContext } from "../apps/web/lib/current-user";
import { buildHomeEntryViewModel, buildWorkspaceViewModel } from "../apps/web/lib/entry-view";
import type { CurrentUserProfilePayload, SessionSummary, UserSessionGroups } from "../apps/web/lib/workflow";

function createEmptyGroups(): UserSessionGroups {
  return {
    sandboxing: [],
    reconnect_ready: [],
    exchanged: [],
    filtered_out: [],
  };
}

function createProfilePayload(): CurrentUserProfilePayload {
  const profile = buildDefaultDemoProfile();
  const card = buildDualCoreCard(profile);

  return {
    profile,
    card,
  };
}

function createCurrentUser(overrides?: Partial<CurrentUserContext>): CurrentUserContext {
  return {
    userId: "demo-you",
    displayName: "你",
    roleTag: "正在寻找双核搭子的人",
    source: "demo",
    hasProfile: true,
    needsAssessment: false,
    demoMode: true,
    ...overrides,
  };
}

function createSession(state: SessionSummary["state"]): SessionSummary {
  return {
    sessionId: "session-1",
    source: "demo",
    state,
    currentRound: state === "sandboxing" ? 1 : 3,
    fitScore: 62,
    recommendation: "cautious",
    topic: {
      id: "zh-001",
      title: "如何应对空降领导的瞎指挥？",
      riskTags: ["authority", "ambiguity"],
    },
    counterpart: {
      userId: "candidate-chen",
      name: "陈火山",
      roleTag: "产品 / 运营型合伙人",
      wmtiLetters: "ENFJ",
      lifeModeTitle: "生活态的热场共振体",
      workModeTitle: "职场态的关系调度官",
    },
    manualReady: state !== "matched" && state !== "sandboxing",
    actorConfirmed: false,
    counterpartConfirmed: false,
    updatedAt: "2026-03-17T00:00:00.000Z",
  };
}

describe("entry view models", () => {
  it("builds an anonymous home entry with product-first CTAs", () => {
    const view = buildHomeEntryViewModel({
      currentUser: null,
      profile: null,
      groups: createEmptyGroups(),
    });

    expect(view.mode).toBe("anonymous");
    expect(view.title).toBe("我们想知道的，不是你像谁，而是你适合和谁一起把事情做成。");
    expect(view.nextAction.primaryLabel).toBe("连接 Second Me");
    expect(view.nextAction.secondaryLabel).toBe("先看 W-MBTI 测评");
    expect(view.description).not.toContain("继续往真实用户上下文推进");
    expect(view.description).not.toContain("建设中");
  });

  it("prioritizes sandbox recovery on the home entry when a session is in progress", () => {
    const groups = createEmptyGroups();
    groups.sandboxing.push(createSession("sandboxing"));

    const view = buildHomeEntryViewModel({
      currentUser: createCurrentUser(),
      profile: createProfilePayload(),
      groups,
    });

    expect(view.mode).toBe("ready");
    expect(view.nextAction.primaryLabel).toBe("查看协商回放");
    expect(view.nextAction.badge).toBe("进行中的沙盘");
    expect(view.nextAction.primaryHref).toContain("/arena/session-1");
  });

  it("guides the workspace back to assessment when the current user has no profile", () => {
    const view = buildWorkspaceViewModel({
      currentUser: createCurrentUser({
        hasProfile: false,
        needsAssessment: true,
      }),
      profile: null,
      groups: createEmptyGroups(),
    });

    expect(view.nextAction.title).toBe("这不是为了定义你，只是为了看看你如何工作。");
    expect(view.nextAction.primaryLabel).toBe("先完成 W-MBTI 测评");
    expect(view.nextAction.badge).toBe("待完成画像");
    expect(view.demoNote).toContain("开发演示");
  });

  it("prioritizes reconnect confirmation above other session buckets", () => {
    const groups = createEmptyGroups();
    groups.sandboxing.push(createSession("sandboxing"));
    groups.reconnect_ready.push(createSession("reconnect_ready"));

    const view = buildWorkspaceViewModel({
      currentUser: createCurrentUser(),
      profile: createProfilePayload(),
      groups,
    });

    expect(view.nextAction.primaryLabel).toBe("查看说明书并确认");
    expect(view.nextAction.badge).toBe("待确认 Reconnect");
    expect(view.sections.sandboxing.title).toContain("优先处理");
    expect(view.sections.reconnectReady.title).toContain("先读说明书");
  });
});
