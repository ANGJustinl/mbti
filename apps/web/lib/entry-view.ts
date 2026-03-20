import type { CurrentUserContext } from "./current-user";
import { withDemoQuery } from "./route-utils";
import type { CurrentUserProfilePayload, SessionSummary, UserSessionGroups } from "./workflow";

export type EntryMode = "anonymous" | "needs_assessment" | "ready";

export interface EntryAction {
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  badge?: string;
  note?: string;
}

export interface EntryMetric {
  label: string;
  value: string;
  detail: string;
}

export interface HomeEntryViewModel {
  mode: EntryMode;
  eyebrow: string;
  title: string;
  description: string;
  statusLine: string;
  metrics: EntryMetric[];
  nextAction: EntryAction;
  spotlightTitle: string;
  spotlightEyebrow: string;
  proofIntro: string;
}

export interface WorkspaceSectionCopy {
  eyebrow: string;
  title: string;
  emptyTitle: string;
  emptyDescription: string;
}

export interface WorkspaceViewModel {
  eyebrow: string;
  title: string;
  description: string;
  metrics: EntryMetric[];
  nextAction: EntryAction;
  profileTitle: string;
  profileDescription: string;
  demoNote?: string;
  sections: {
    sandboxing: WorkspaceSectionCopy;
    reconnectReady: WorkspaceSectionCopy;
    exchanged: WorkspaceSectionCopy;
    filteredOut: WorkspaceSectionCopy;
  };
}

interface SessionPriority {
  label: string;
  session: SessionSummary;
}

function getPrioritySession(groups: UserSessionGroups): SessionPriority | null {
  if (groups.reconnect_ready.length > 0) {
    return {
      label: "待确认 Reconnect",
      session: groups.reconnect_ready[0],
    };
  }

  if (groups.sandboxing.length > 0) {
    return {
      label: "进行中的沙盘",
      session: groups.sandboxing[0],
    };
  }

  if (groups.exchanged.length > 0) {
    return {
      label: "最近完成的连接",
      session: groups.exchanged[0],
    };
  }

  if (groups.filtered_out.length > 0) {
    return {
      label: "最新排雷记录",
      session: groups.filtered_out[0],
    };
  }

  return null;
}

export function getSessionHref(summary: SessionSummary, demoMode: boolean) {
  const pathname =
    summary.state === "matched" || summary.state === "sandboxing"
      ? `/arena/${summary.sessionId}`
      : `/reconnect/${summary.sessionId}`;

  return withDemoQuery(pathname, demoMode);
}

function buildReadyAction(groups: UserSessionGroups, demoMode: boolean): EntryAction {
  const priority = getPrioritySession(groups);

  if (!priority) {
    return {
      eyebrow: "下一步动作",
      title: "画像已经就位，可以开始新的协作试探。",
      description:
        "先进入公开广场，让其他真实用户先看到你的双核预览；一旦互选成功，A2A 会自动替你们跑完第一段协商。",
      primaryLabel: "进入公开广场",
      primaryHref: withDemoQuery("/match", demoMode),
      secondaryLabel: "回到我的流程中心",
      secondaryHref: withDemoQuery("/me", demoMode),
      badge: "画像已就绪",
    };
  }

  if (priority.session.state === "reconnect_ready") {
    return {
      eyebrow: "下一步动作",
      title: "你有一份待确认的协作说明书。",
      description:
        "先看完说明书里的互补、风险和沟通建议，再决定是否解锁这次连接的数字名片。",
      primaryLabel: "查看说明书并确认",
      primaryHref: getSessionHref(priority.session, demoMode),
      secondaryLabel: "查看我的流程中心",
      secondaryHref: withDemoQuery("/me", demoMode),
      badge: priority.label,
      note: `当前对象：${priority.session.counterpart.name}`,
    };
  }

  if (priority.session.state === "matched" || priority.session.state === "sandboxing") {
    return {
      eyebrow: "下一步动作",
      title: "你的 A2A 协商回放已经就位。",
      description:
        "先看完双方如何碰撞、让步与定边界，再决定要不要生成说明书并进入 Reconnect。",
      primaryLabel: "查看协商回放",
      primaryHref: getSessionHref(priority.session, demoMode),
      secondaryLabel: "查看我的流程中心",
      secondaryHref: withDemoQuery("/me", demoMode),
      badge: priority.label,
      note: `当前对象：${priority.session.counterpart.name}`,
    };
  }

  if (priority.session.state === "exchanged") {
    return {
      eyebrow: "下一步动作",
      title: "最近一条连接已经落地，可以继续扩展新的协作对象。",
      description: "回看已完成连接的说明书，或者重新回到公开广场，继续寻找更合适的长期搭子。",
      primaryLabel: "查看已完成连接",
      primaryHref: getSessionHref(priority.session, demoMode),
      secondaryLabel: "回到公开广场",
      secondaryHref: withDemoQuery("/match", demoMode),
      badge: priority.label,
      note: `最近连接：${priority.session.counterpart.name}`,
    };
  }

  return {
    eyebrow: "下一步动作",
    title: "上一轮排雷已经完成，下一次试探可以更快切入重点。",
    description: "系统已经帮你提前识别过高风险组合。复盘这次冲突后，再决定要不要回到公开广场发起新的试探。",
    primaryLabel: "查看排雷复盘",
    primaryHref: getSessionHref(priority.session, demoMode),
    secondaryLabel: "回到公开广场",
    secondaryHref: withDemoQuery("/match", demoMode),
    badge: priority.label,
    note: `最近复盘：${priority.session.counterpart.name}`,
  };
}

export function buildHomeEntryViewModel(input: {
  currentUser: CurrentUserContext | null;
  profile: CurrentUserProfilePayload | null;
  groups: UserSessionGroups;
}): HomeEntryViewModel {
  const { currentUser, profile, groups } = input;
  const totalSessions =
    groups.sandboxing.length +
    groups.reconnect_ready.length +
    groups.exchanged.length +
    groups.filtered_out.length;

  if (!currentUser) {
    return {
      mode: "anonymous",
      eyebrow: "Dual Core Workplace",
      title: "我们想知道的，不是你像谁，而是你适合和谁一起把事情做成。",
      description:
        "双核职场把 W-MBTI、Agent 双盲沙盘、知乎职场题和协作说明书串成一条真正可恢复的流程，让工作方式先替你们说一次话。",
      statusLine: "公共入口 / 尚未确认身份",
      metrics: [
        {
          label: "W-MBTI",
          value: "40",
          detail: "用 40 道二选一题校准你的协作底层偏好。",
        },
        {
          label: "A2A 沙盘",
          value: "3",
          detail: "标准 3 回合预演，先由 Agent 试探价值观与执行方式。",
        },
        {
          label: "最终交付",
          value: "1",
          detail: "输出《协作说明书》并在双向确认后解锁数字名片。",
        },
      ],
      nextAction: {
        eyebrow: "下一步动作",
        title: "先确认你此刻认可的身份进入这里。",
        description: "后面的测评、沙盘和说明，都会跟着这个版本的你继续。",
        primaryLabel: "连接 Second Me",
        primaryHref: "/api/auth/login?next=/me",
        secondaryLabel: "先看 W-MBTI 测评",
        secondaryHref: "/assessment",
        badge: "新用户入口",
      },
      spotlightTitle: "示例双核档案",
      spotlightEyebrow: "信号面板",
      proofIntro: "先看公开广场里的双核预览和知乎修罗场题，快速理解这条主链路如何工作。",
    };
  }

  if (currentUser.needsAssessment || !profile) {
    return {
      mode: "needs_assessment",
      eyebrow: "当前身份已连接",
      title: "这不是为了定义你，只是为了看看你如何工作。",
      description:
        "你的工作方式会被轻轻放进当前身份里，成为后续判断的起点。之后的公开广场、A2A 协商与说明书都会从这里开始。",
      statusLine: currentUser.demoMode ? "开发演示 / 待完成画像" : "已连接 / 待完成画像",
      metrics: [
        {
          label: "当前身份",
          value: currentUser.source === "secondme" ? "Second Me" : "Demo",
          detail: currentUser.demoMode ? "开发态演示身份，仅用于本地串联完整流程。" : "后续测评与会话会归属到这个身份。",
        },
        {
          label: "画像状态",
          value: "TODO",
          detail: "先完成 W-MBTI，后续公开广场与 A2A 协商才能解锁。",
        },
        {
          label: "流程恢复",
          value: `${totalSessions}`,
          detail: totalSessions > 0 ? "已有历史流程记录，可在 /me 里继续恢复。" : "完成画像后就能开始累积自己的流程记录。",
        },
      ],
      nextAction: {
        eyebrow: "下一步动作",
        title: "这不是为了定义你，只是为了看看你如何工作。",
        description: "你的工作方式会被轻轻放进当前身份里，成为后续判断的起点。之后的公开广场与协商都会从这里开始。",
        primaryLabel: "先完成 W-MBTI 测评",
        primaryHref: withDemoQuery("/assessment", currentUser.demoMode),
        secondaryLabel: "进入我的流程中心",
        secondaryHref: withDemoQuery("/me", currentUser.demoMode),
        badge: "待完成画像",
        note: currentUser.demoMode ? "当前处于开发演示模式。" : undefined,
      },
      spotlightTitle: "你的入口档案",
      spotlightEyebrow: "当前状态",
      proofIntro: "你的身份已经准备好，下一步只差一份可解释的双核画像。",
    };
  }

  return {
    mode: "ready",
    eyebrow: "当前流程已就位",
    title: "在现实相遇之前，先让工作方式替你们说一次话。",
    description:
      "你已经有了自己的双核名片。现在更重要的，是先替这段关系看一眼它会彼此放大，还是彼此消耗。",
    statusLine: currentUser.demoMode ? "开发演示 / 可恢复流程" : "已连接 / 可恢复流程",
    metrics: [
      {
        label: "双核名片",
        value: profile.card.profile.wmti.letters,
        detail: `${profile.card.profile.lifeModeTitle} / ${profile.card.profile.workModeTitle}`,
      },
      {
        label: "流程记录",
        value: `${totalSessions}`,
        detail: totalSessions > 0 ? "可以从首页或 /me 继续恢复现有会话。" : "还没有历史会话，可以先进入公开广场开始新的试探。",
      },
      {
        label: "待处理",
        value: `${groups.reconnect_ready.length + groups.sandboxing.length}`,
        detail: groups.reconnect_ready.length > 0 ? "有待确认的说明书或正在进行中的沙盘。" : "当前没有挂起动作，可以开始新的试探。",
      },
    ],
    nextAction: buildReadyAction(groups, currentUser.demoMode),
    spotlightTitle: "你的当前双核档案",
    spotlightEyebrow: "信号面板",
    proofIntro: "你已经具备进入公开广场的基础画像。双核预览和知乎题池会决定这次试探的张力。",
  };
}

export function buildWorkspaceViewModel(input: {
  currentUser: CurrentUserContext;
  profile: CurrentUserProfilePayload | null;
  groups: UserSessionGroups;
}): WorkspaceViewModel {
  const { currentUser, profile, groups } = input;
  const totalSessions =
    groups.sandboxing.length +
    groups.reconnect_ready.length +
    groups.exchanged.length +
    groups.filtered_out.length;

  return {
    eyebrow: currentUser.demoMode ? "开发演示工作台" : "我的流程中心",
    title: currentUser.displayName,
    description: currentUser.needsAssessment
      ? "先把当前身份补成一份可解释的协作画像，再进入公开广场、A2A 协商与 Reconnect。"
      : "这里保存的，不只是结果，还有这个阶段正在前进的你。每一次判断、每一次推演，都会慢慢沉淀成你可继续往前走的协作轨迹。",
    metrics: [
      {
        label: "身份来源",
        value: currentUser.source === "secondme" ? "Second Me" : "Demo",
        detail: currentUser.demoMode ? "仅在开发态可见，用于本地串联主链路。" : "当前测评与会话都会归属到这个身份。",
      },
      {
        label: "画像状态",
        value: currentUser.hasProfile ? "READY" : "TODO",
        detail: currentUser.needsAssessment ? "还没有完成 W-MBTI 测评。" : "已经具备进入沙盘与协作说明书的基础画像。",
      },
      {
        label: "流程记录",
        value: `${totalSessions}`,
        detail: totalSessions > 0 ? "进行中的沙盘、待确认连接和历史复盘都在这里。" : "还没有历史流程记录，完成画像后就能开始累积。",
      },
    ],
    nextAction: currentUser.needsAssessment || !profile
      ? {
          eyebrow: "最推荐下一步",
          title: "这不是为了定义你，只是为了看看你如何工作。",
          description: "你的工作方式会被轻轻放进当前身份里，成为后续判断的起点。之后的公开广场与协商，都会从这里开始。",
          primaryLabel: "先完成 W-MBTI 测评",
          primaryHref: withDemoQuery("/assessment", currentUser.demoMode),
          secondaryLabel: "先看看匹配入口",
          secondaryHref: withDemoQuery("/match", currentUser.demoMode),
          badge: "待完成画像",
          note: currentUser.demoMode ? "当前为开发演示身份。" : undefined,
        }
      : buildReadyAction(groups, currentUser.demoMode),
    profileTitle: profile ? profile.card.summary : "你的双核名片还没有生成",
    profileDescription: profile
      ? profile.card.tagline
      : "完成测评后，这里会出现你的双核小传、风险提示和协作建议。",
    demoNote: currentUser.demoMode ? "开发演示仅用于评审与测试，不会替代真实用户身份。" : undefined,
    sections: {
      sandboxing: {
        eyebrow: "进行中的沙盘",
        title: "优先处理还没跑完的合作预演",
        emptyTitle: "当前没有进行中的沙盘。",
        emptyDescription: "画像就绪后，你可以随时进入公开广场，让 Agent 先替你试探价值观和执行方式。",
      },
      reconnectReady: {
        eyebrow: "待确认 Reconnect",
        title: "先读说明书，再决定要不要进入现实连接",
        emptyTitle: "当前没有待确认的连接。",
        emptyDescription: "一旦沙盘完成并通过排雷，新的协作说明书会在这里出现。",
      },
      exchanged: {
        eyebrow: "已完成连接",
        title: "回看已经落地的协作记录",
        emptyTitle: "还没有完成交换名片的协作对象。",
        emptyDescription: "完成双方确认后，站内数字名片会在这里保持可追溯。",
      },
      filteredOut: {
        eyebrow: "已终止连接",
        title: "把排雷结果留作下一次试探的参考",
        emptyTitle: "目前没有被系统终止的连接。",
        emptyDescription: "如果系统发现不可调和的冲突，会在这里保留说明书和复盘记录。",
      },
    },
  };
}
