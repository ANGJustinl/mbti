import Link from "next/link";

import { EntryHero } from "../_components/entry-hero";
import { NextActionCard } from "../_components/next-action-card";
import { SessionList } from "../_components/session-list";
import { buildWorkspaceViewModel } from "../../lib/entry-view";
import { isDemoRequested, isDevelopmentMode, resolveCurrentUserContext } from "../../lib/current-user";
import { getQueryValue, withDemoQuery } from "../../lib/route-utils";
import { getCurrentUserProfile, listUserSessions } from "../../lib/workflow";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MePage({ searchParams }: PageProps) {
  const query = await searchParams;
  const currentUser = await resolveCurrentUserContext({
    allowDemoFallback: true,
    demoRequested: isDemoRequested(getQueryValue(query.demo)),
  });

  if (!currentUser) {
    return (
      <main className="stack">
        <section className="hero-grid entry-grid">
          <EntryHero
            eyebrow="我的流程中心"
            title="把测评、沙盘和协作说明书都收回到一个持续可恢复的身份里。"
            description="连接 Second Me 后，你的主链路会跟随当前身份连续保存。这里不会只展示结果，而是会一直告诉你下一步该做什么。"
            statusLine="未绑定当前身份"
            metrics={[
              {
                label: "流程恢复",
                value: "ON",
                detail: "登录后可以从任何一步恢复已有会话，不用每次重新开始。",
              },
              {
                label: "隐私规则",
                value: "2-WAY",
                detail: "未双向确认前，不会展示任何现实联系方式。",
              },
              {
                label: "当前重点",
                value: "NEXT",
                detail: "最关键的下一步动作会被抬到首屏，而不是埋在历史记录里。",
              },
            ]}
            actions={[
              { href: "/api/auth/login?next=/me", label: "连接 Second Me" },
              ...(isDevelopmentMode()
                ? [{ href: "/me?demo=1", label: "开发演示", tone: "secondary" as const }]
                : []),
            ]}
          >
            <p className="workspace-note">双核职场不是在判断你是哪一类人，而是在提前验证你和谁适合一起成事。</p>
          </EntryHero>

          <NextActionCard
            action={{
              eyebrow: "下一步动作",
              title: "先绑定一个当前身份，再开始你的协作工作台。",
              description: "你一旦完成连接，后续的 W-MBTI、沙盘记录、说明书与数字名片都会直接挂在这个身份下面。",
              primaryLabel: "连接 Second Me",
              primaryHref: "/api/auth/login?next=/me",
              secondaryLabel: isDevelopmentMode() ? "使用开发演示" : undefined,
              secondaryHref: isDevelopmentMode() ? "/me?demo=1" : undefined,
              badge: "身份入口",
            }}
          />
        </section>
      </main>
    );
  }

  const [profilePayload, groups] = await Promise.all([
    currentUser.hasProfile ? getCurrentUserProfile(currentUser.userId) : Promise.resolve(null),
    listUserSessions(currentUser.userId),
  ]);

  const view = buildWorkspaceViewModel({
    currentUser,
    profile: profilePayload,
    groups,
  });

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
          statusLine={currentUser.roleTag}
          metrics={view.metrics}
          actions={heroActions}
        >
          {view.demoNote ? <p className="workspace-note">{view.demoNote}</p> : null}
        </EntryHero>

        <div className="stack">
          <NextActionCard action={view.nextAction} />
          <article className="panel spotlight-panel">
            <div className="pair-line">
              <span className="eyebrow">我的双核名片</span>
              {profilePayload ? <span className="chip">{profilePayload.profile.wmti.letters}</span> : null}
            </div>
            <h2>{view.profileTitle}</h2>
            <p className="lead spotlight-copy">{view.profileDescription}</p>
            {profilePayload ? (
              <div className="stack section">
                {profilePayload.card.actionHints.map((hint) => (
                  <div key={hint} className="pair-line">
                    <span className="chip">协作建议</span>
                    <span className="muted">{hint}</span>
                  </div>
                ))}
                <Link
                  href={withDemoQuery(`/card/${currentUser.userId}`, currentUser.demoMode)}
                  className="ghost-link section"
                >
                  查看完整双核名片
                </Link>
              </div>
            ) : (
              <div className="stack section">
                <p className="muted">完成测评后，这里会出现你的双态小传、风险提示和协作建议。</p>
                <Link href={withDemoQuery("/assessment", currentUser.demoMode)} className="ghost-link">
                  先完成 W-MBTI 测评
                </Link>
              </div>
            )}
          </article>
        </div>
      </section>

      <section className="split-grid section">
        <SessionList
          eyebrow={view.sections.sandboxing.eyebrow}
          title={view.sections.sandboxing.title}
          emptyTitle={view.sections.sandboxing.emptyTitle}
          emptyDescription={view.sections.sandboxing.emptyDescription}
          sessions={groups.sandboxing}
          demoMode={currentUser.demoMode}
          variant="sandboxing"
        />
        <SessionList
          eyebrow={view.sections.reconnectReady.eyebrow}
          title={view.sections.reconnectReady.title}
          emptyTitle={view.sections.reconnectReady.emptyTitle}
          emptyDescription={view.sections.reconnectReady.emptyDescription}
          sessions={groups.reconnect_ready}
          demoMode={currentUser.demoMode}
          variant="reconnect_ready"
        />
      </section>

      <section className="split-grid section">
        <SessionList
          eyebrow={view.sections.exchanged.eyebrow}
          title={view.sections.exchanged.title}
          emptyTitle={view.sections.exchanged.emptyTitle}
          emptyDescription={view.sections.exchanged.emptyDescription}
          sessions={groups.exchanged}
          demoMode={currentUser.demoMode}
          variant="exchanged"
        />
        <SessionList
          eyebrow={view.sections.filteredOut.eyebrow}
          title={view.sections.filteredOut.title}
          emptyTitle={view.sections.filteredOut.emptyTitle}
          emptyDescription={view.sections.filteredOut.emptyDescription}
          sessions={groups.filtered_out}
          demoMode={currentUser.demoMode}
          variant="filtered_out"
        />
      </section>
    </main>
  );
}
