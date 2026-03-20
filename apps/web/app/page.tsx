import Link from "next/link";

import { EntryHero } from "./_components/entry-hero";
import { NextActionCard } from "./_components/next-action-card";
import { ProofRail } from "./_components/proof-rail";
import { buildHomeEntryViewModel } from "../lib/entry-view";
import { resolveCurrentUserContext, isDemoRequested } from "../lib/current-user";
import { getTopTopics } from "../lib/demo";
import { getQueryValue, withDemoQuery } from "../lib/route-utils";
import { getCurrentUserProfile, listCandidateCards, listPlazaFeed, listUserSessions } from "../lib/workflow";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const flowPreview = [
  {
    eyebrow: "Step 01",
    title: "W-MBTI 测评校准",
    description: "用 40 道二选一题拆出你的能量来源、信息处理、决策逻辑和执行节奏。",
  },
  {
    eyebrow: "Step 02",
    title: "双核名片译码",
    description: "把结果翻译成可协作的语言，明确你在生活态与职场态里的优势、雷区和沟通方式。",
  },
  {
    eyebrow: "Step 03",
    title: "Agent 沙盘预演",
    description: "围绕知乎职场修罗场题目，让双方 Agent 先把合作里的真实摩擦跑一遍。",
  },
  {
    eyebrow: "Step 04",
    title: "Reconnect 落地",
    description: "输出协作说明书、冲突复盘和双向确认后的数字名片，决定要不要走向现实连接。",
  },
];

export default async function HomePage({ searchParams }: PageProps) {
  const query = await searchParams;
  const currentUser = await resolveCurrentUserContext({
    allowDemoFallback: true,
    demoRequested: isDemoRequested(getQueryValue(query.demo)),
  });

  const [candidates, plazaFeed, topics, profilePayload, groups] = await Promise.all([
    listCandidateCards(),
    currentUser && !currentUser.demoMode ? listPlazaFeed(currentUser.userId) : Promise.resolve([]),
    getTopTopics(),
    currentUser?.hasProfile ? getCurrentUserProfile(currentUser.userId) : Promise.resolve(null),
    currentUser ? listUserSessions(currentUser.userId) : Promise.resolve({
      sandboxing: [],
      reconnect_ready: [],
      exchanged: [],
      filtered_out: [],
    }),
  ]);

  const view = buildHomeEntryViewModel({
    currentUser,
    profile: profilePayload,
    groups,
  });

  const spotlightCard = profilePayload?.card ?? plazaFeed[0]?.listing.card ?? candidates[0];
  if (!spotlightCard) {
    throw new Error("featured card not found");
  }

  const heroActions = [
    {
      href: view.nextAction.primaryHref,
      label: view.nextAction.primaryLabel,
      tone: "primary" as const,
    },
    ...(view.nextAction.secondaryHref && view.nextAction.secondaryLabel
      ? [
          {
            href: view.nextAction.secondaryHref,
            label: view.nextAction.secondaryLabel,
            tone: "secondary" as const,
          },
        ]
      : []),
  ];

  return (
    <main className="stack">
      <section className="hero-grid entry-grid">
        <EntryHero
          eyebrow={view.eyebrow}
          title={view.title}
          description={view.description}
          statusLine={view.statusLine}
          metrics={view.metrics}
          actions={heroActions}
        >
          <p className="workspace-note">{view.proofIntro}</p>
        </EntryHero>

        <div className="stack">
          <NextActionCard action={view.nextAction} />
          <article className="panel spotlight-panel">
            <div className="pair-line">
              <span className="eyebrow">{view.spotlightEyebrow}</span>
              <span className="chip">{spotlightCard.profile.wmti.letters}</span>
            </div>
            <h2>{view.spotlightTitle}</h2>
            <p className="lead spotlight-copy">{spotlightCard.summary}</p>
            <p className="muted">{spotlightCard.tagline}</p>
            <div className="subtle-divider" />
            <div className="stack">
              {spotlightCard.actionHints.map((hint) => (
                <div key={hint} className="pair-line">
                  <span className="chip">协作建议</span>
                  <span className="muted">{hint}</span>
                </div>
              ))}
            </div>
            <Link
              href={withDemoQuery(`/card/${encodeURIComponent(spotlightCard.profile.userId)}`, Boolean(currentUser?.demoMode))}
              className="ghost-link section"
            >
              查看完整双核名片
            </Link>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="entry-section-header">
          <div>
            <span className="eyebrow">主链路预览</span>
            <h2 className="section-heading">四段式完成一次真正可恢复的协作验证</h2>
          </div>
          <p className="muted section-copy">
            这不是一次娱乐化测试，而是一条从画像校准到现实连接的工作流。
          </p>
        </div>
        <div className="timeline-grid section">
          {flowPreview.map((step) => (
            <article key={step.title} className="card-block flow-card">
              <span className="eyebrow">{step.eyebrow}</span>
              <h3>{step.title}</h3>
              <p className="muted">{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="split-grid section">
        <ProofRail
          eyebrow={plazaFeed.length > 0 ? "公开广场" : "候选搭子"}
          title="先看协作张力，而不是先看社交名片。"
          description={
            plazaFeed.length > 0
              ? "已经进入公开广场的真实用户，会先露出双核预览，再决定要不要让 A2A 继续替双方试探。"
              : "预置候选对象覆盖不同的执行节奏、决策风格和沟通偏好，方便你快速理解这套机制会在哪些地方产生火花或摩擦。"
          }
        >
          {(plazaFeed.length > 0 ? plazaFeed.map((item) => item.listing.card) : candidates).map((candidate) => (
            <article key={candidate.profile.userId} className="card-block proof-card">
              <div className="pair-line">
                <span className="chip">{candidate.profile.wmti.letters}</span>
                {candidate.profile.userKind === "agent" ? <span className="chip">Agent 用户</span> : null}
                <span className="muted tiny">{candidate.profile.roleTag}</span>
              </div>
              <h3>{candidate.profile.name}</h3>
              <p className="muted">
                {candidate.profile.lifeModeTitle} / {candidate.profile.workModeTitle}
              </p>
              <Link
                href={withDemoQuery(`/card/${encodeURIComponent(candidate.profile.userId)}`, Boolean(currentUser?.demoMode))}
                className="ghost-link section"
              >
                查看名片
              </Link>
            </article>
          ))}
        </ProofRail>

        <ProofRail
          eyebrow="知乎修罗场"
          title="把最容易撕裂合作的题，提前搬上桌面。"
          description="题目先聚焦那些最容易暴露价值观、控制欲、沟通方式和模糊容忍度的真实职场冲突。"
        >
          {topics.slice(0, 3).map((topic) => (
            <article key={topic.id} className="topic-card proof-card">
              <h3 className="mini-title">{topic.title}</h3>
              <p className="muted">{topic.prompt}</p>
              <div className="pill-row section">
                {topic.riskTags.map((tag) => (
                  <span key={tag} className="chip">
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </ProofRail>
      </section>
    </main>
  );
}
