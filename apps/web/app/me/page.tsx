import Link from "next/link";

import { EntryHero } from "../_components/entry-hero";
import { MatchSignalAction } from "../_components/match-signal-action";
import { NextActionCard } from "../_components/next-action-card";
import { SecondMeWritebackPanel } from "../_components/secondme-writeback-panel";
import { SessionList } from "../_components/session-list";
import { buildWorkspaceViewModel } from "../../lib/entry-view";
import { isDemoRequested, isDevelopmentMode, resolveCurrentUserContext } from "../../lib/current-user";
import { getQueryValue, withDemoQuery } from "../../lib/route-utils";
import { getCurrentUserProfile, getPlazaWorkspace, getSecondMeWorkspaceStatus, listUserSessions } from "../../lib/workflow";

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
            title="先确认你此刻认可的身份进入这里。"
            description="后面的测评、沙盘和说明，都会跟着这个版本的你继续。"
            statusLine="尚未确认身份"
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
            <p className="workspace-note">这里保存的，不只是结果，还有这个阶段正在前进的你。</p>
          </EntryHero>

          <NextActionCard
            action={{
              eyebrow: "下一步动作",
              title: "先确认你此刻认可的身份进入这里。",
              description: "后面的测评、沙盘和说明，都会跟着这个版本的你继续。",
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

  const [profilePayload, groups, secondMeStatus, plazaWorkspace] = await Promise.all([
    currentUser.hasProfile ? getCurrentUserProfile(currentUser.userId) : Promise.resolve(null),
    listUserSessions(currentUser.userId),
    getSecondMeWorkspaceStatus(currentUser.userId),
    currentUser.demoMode ? Promise.resolve(null) : getPlazaWorkspace(currentUser.userId),
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
          {!currentUser.demoMode && plazaWorkspace ? (
            <article className="panel">
              <div className="pair-line">
                <span className="eyebrow">我的广场状态</span>
                <span className="chip">{plazaWorkspace.listing?.enabled ? "已公开" : "未公开"}</span>
              </div>
              <h2>{plazaWorkspace.listing?.enabled ? "你的双核预览正在公开广场里流动" : "你还没有进入公开广场"}</h2>
              <p className="muted">
                {plazaWorkspace.listing?.enabled
                  ? plazaWorkspace.listing.headline
                  : "进入广场后，其他已完成测评的真实用户才能先看到你的协作像，再决定要不要发起互选。"}
              </p>
              <div className="detail-grid section">
                <article className="metric-card">
                  <span className="eyebrow">等待回应</span>
                  <strong className="stat-number">{plazaWorkspace.outgoing.length}</strong>
                  <span className="stat-label">你已经发起，但对方还没回看的协作意向</span>
                </article>
                <article className="metric-card">
                  <span className="eyebrow">别人看中你</span>
                  <strong className="stat-number">{plazaWorkspace.incoming.length}</strong>
                  <span className="stat-label">有人已经先发起意向，等你决定要不要回看</span>
                </article>
                <article className="metric-card">
                  <span className="eyebrow">互选成功</span>
                  <strong className="stat-number">{plazaWorkspace.mutual.length}</strong>
                  <span className="stat-label">互选成立后，A2A 会先在后台生成协商回放</span>
                </article>
              </div>
              <Link href="/match" className="ghost-link section">
                进入公开广场
              </Link>
            </article>
          ) : null}
          {currentUser.source === "secondme" ? (
            <article className="panel">
              <div className="pair-line">
                <span className="eyebrow">Second Me 状态</span>
                <span className="chip">
                  {secondMeStatus.profileSyncedAt ? "已同步画像" : "待同步"}
                </span>
              </div>
              <h2>分身画像与记忆状态</h2>
              <p className="muted">
                {secondMeStatus.profileSyncedAt
                  ? `最近一次画像同步：${new Date(secondMeStatus.profileSyncedAt).toLocaleString("zh-CN")}`
                  : "当前还没有可用的 Second Me 画像快照。完成测评或刷新授权后会自动同步。"}
              </p>
              <div className="detail-grid section">
                <article className="metric-card">
                  <span className="eyebrow">待写回</span>
                  <strong className="stat-number">{secondMeStatus.pendingWritebacks.length}</strong>
                  <span className="stat-label">需要你逐次确认是否写回分身记忆</span>
                </article>
                <article className="metric-card">
                  <span className="eyebrow">最近结果</span>
                  <strong className="stat-number">{secondMeStatus.recentWritebacks.length}</strong>
                  <span className="stat-label">会保留最近几次写回的状态，方便恢复处理</span>
                </article>
              </div>
            </article>
          ) : null}
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
                  href={withDemoQuery(`/card/${encodeURIComponent(currentUser.userId)}`, currentUser.demoMode)}
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

      {!currentUser.demoMode && plazaWorkspace ? (
        <>
          <section className="split-grid section">
            <article className="panel">
            <span className="eyebrow">等待对方回应</span>
            {plazaWorkspace.outgoing.length === 0 ? (
              <p className="muted section">你还没有发出新的协作意向，或者对方都已经回看过了。</p>
            ) : (
              <div className="stack section">
                {plazaWorkspace.outgoing.map((item) => (
                  <article key={item.signalId} className="card-block">
                    <div className="pair-line">
                      <h3>{item.counterpart.name}</h3>
                      {item.counterpart.kind === "agent" ? <span className="chip">Agent 用户</span> : null}
                    </div>
                    <p className="muted">{item.headline}</p>
                    <span className="chip">等待对方互选</span>
                  </article>
                ))}
              </div>
            )}
            </article>
            <article className="panel">
              <span className="eyebrow">别人正在看你</span>
              {plazaWorkspace.incoming.length === 0 ? (
                <p className="muted section">当前还没有新的 incoming 意向。公开广场打开后，这里会先出现等你回应的协作试探。</p>
              ) : (
                <div className="stack section">
                  {plazaWorkspace.incoming.map((item) => (
                    <article key={item.signalId} className="card-block">
                      <div className="pair-line">
                        <h3>{item.counterpart.name}</h3>
                        {item.counterpart.kind === "agent" ? <span className="chip">Agent 用户</span> : null}
                      </div>
                      <p className="muted">{item.headline}</p>
                      <div className="inline-actions section">
                        <Link href={`/card/${encodeURIComponent(item.counterpart.userId)}`} className="ghost-link">
                          先看对方双核名片
                        </Link>
                        <MatchSignalAction
                          targetUserId={item.counterpart.userId}
                          demoMode={false}
                          relationship="incoming"
                          sourcePage="/me"
                        />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </article>
          </section>
          <section className="section">
            <article className="panel">
              <span className="eyebrow">A2A 协商已生成</span>
              {plazaWorkspace.mutual.length === 0 ? (
                <p className="muted section">一旦双方互选成功，系统会把三段协商回放先生成在这里。</p>
              ) : (
                <div className="card-grid section">
                  {plazaWorkspace.mutual.map((item) => (
                    <article key={item.signalId} className="card-block">
                      <div className="pair-line">
                        <h3>{item.counterpart.name}</h3>
                        {item.counterpart.kind === "agent" ? <span className="chip">Agent 用户</span> : null}
                      </div>
                      <p className="muted">{item.headline}</p>
                      {item.sessionId ? (
                        <Link href={`/arena/${item.sessionId}`} className="ghost-link section">
                          查看协商回放
                        </Link>
                      ) : (
                        <span className="chip">等待回放落库</span>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </article>
          </section>
        </>
      ) : null}

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

      <SecondMeWritebackPanel
        currentUser={currentUser}
        pending={secondMeStatus.pendingWritebacks}
        recent={secondMeStatus.recentWritebacks}
        eyebrow="Second Me 记忆写回"
        title="这里会保留所有待处理的 Second Me 写回事项"
      />

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
