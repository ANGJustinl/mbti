import { notFound } from "next/navigation";

import { MatchSignalAction } from "../../_components/match-signal-action";
import { SecondMeWritebackPanel } from "../../_components/secondme-writeback-panel";
import { recordAnalyticsEvent } from "../../../lib/analytics";
import { isDemoRequested, resolveCurrentUserContext } from "../../../lib/current-user";
import {
  getCardByUserId,
  getPlazaListing,
  getPlazaRelationship,
  getSecondMeWorkspaceStatus,
  listCandidateCards,
} from "../../../lib/workflow";

export const dynamic = "force-dynamic";

const axisLabel = {
  energy: "能量获取",
  perception: "信息处理",
  decision: "决策逻辑",
  execution: "执行方式",
} as const;

interface PageProps {
  params: Promise<{ userId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CardPage({ params, searchParams }: PageProps) {
  const { userId: rawUserId } = await params;
  const userId = decodeURIComponent(rawUserId);
  const query = await searchParams;
  const currentUser = await resolveCurrentUserContext({
    allowDemoFallback: true,
    demoRequested: isDemoRequested(
      typeof query.demo === "string" ? query.demo : Array.isArray(query.demo) ? query.demo[0] : undefined,
    ),
  });
  const candidates = await listCandidateCards();
  const plazaListing = currentUser?.userId === userId ? null : await getPlazaListing(userId);
  const isKnown =
    candidates.some((item) => item.profile.userId === userId) ||
    currentUser?.userId === userId ||
    Boolean(currentUser && plazaListing?.enabled);

  if (!isKnown) {
    notFound();
  }

  const card = await getCardByUserId(userId);
  if (!card) {
    notFound();
  }
  const axes = card.profile.wmti.axes;
  const secondMeStatus =
    currentUser?.userId === userId ? await getSecondMeWorkspaceStatus(currentUser.userId) : null;
  const assessmentWritebacks = secondMeStatus
    ? secondMeStatus.pendingWritebacks.filter((item) => item.milestone === "assessment_completed")
    : [];
  const recentAssessmentWritebacks = secondMeStatus
    ? secondMeStatus.recentWritebacks.filter((item) => item.milestone === "assessment_completed")
    : [];
  const review = card.profile.secondMeReview;
  const relationship =
    currentUser && !currentUser.demoMode && currentUser.userId !== userId
      ? await getPlazaRelationship(currentUser.userId, userId)
      : null;

  if (currentUser && !currentUser.demoMode) {
    await recordAnalyticsEvent({
      name: "card_view",
      actorUserId: currentUser.userId,
      targetUserId: userId,
      targetKind: card.profile.userKind,
      sourcePage: "/card",
      meta: {
        self: currentUser.userId === userId,
      },
    }).catch(() => null);
  }

  return (
    <main className="stack">
      <section className="split-grid dossier-grid">
        <article className="hero-panel dossier-summary">
          <span className="eyebrow">双核名片</span>
          <h1 className="hero-title">{card.summary}</h1>
          <p className="lead">{card.tagline}</p>
          <div className="board-strip section">
            <span className="chip">{card.profile.wmti.letters}</span>
            <span className="chip">{card.profile.roleTag}</span>
            <span className="chip">{card.profile.workModeTitle}</span>
            {card.profile.userKind === "agent" ? <span className="chip">Agent 用户</span> : null}
            {review?.enabled ? <span className="chip">Second Me 已复核</span> : null}
          </div>
          <div className="dossier-note section">
            <span className="eyebrow">协作摘要</span>
            <p className="lead">{card.profile.collaborationThesis}</p>
            <p className="muted">
              这张名片不是在判断你是哪一类人，而是在提前说明你更容易怎样推进合作、又会在哪些地方被误解。
            </p>
          </div>
          {relationship?.targetAvailable ? (
            <div className="inline-actions section">
              {relationship.relationship === "mutual" && relationship.sessionId ? (
                <a href={`/arena/${relationship.sessionId}`} className="cta-link">
                  查看 A2A 协商回放
                </a>
              ) : relationship.relationship === "outgoing" ? (
                <span className="chip">已发起，等待对方回应</span>
              ) : (
                <MatchSignalAction
                  targetUserId={userId}
                  demoMode={currentUser?.demoMode ?? false}
                  relationship={
                    relationship.relationship === "incoming" ? "incoming" : "none"
                  }
                  sourcePage="/card"
                />
              )}
            </div>
          ) : null}
        </article>

        <aside className="panel review-panel">
          <span className="eyebrow">配对前摘要</span>
          <div className="stack section">
            <article className="card-block">
              <span className="eyebrow">适合一起做什么</span>
              <p className="lead">{card.profile.bestWith}</p>
            </article>
            <article className="card-block">
              <span className="eyebrow">不适合怎样开始</span>
              <p className="muted">{card.profile.badStartPattern}</p>
            </article>
            <article className="card-block">
              <span className="eyebrow">最怕的协作误解</span>
              <p className="muted">{card.profile.likelyMisread}</p>
            </article>
            <article className="card-block">
              <span className="eyebrow">建议谁先主导</span>
              <p className="muted">{card.profile.suggestedLead}</p>
            </article>
          </div>
        </aside>
      </section>

      <section className="panel">
        <div className="entry-section-header">
          <div>
            <span className="eyebrow">四维画像</span>
            <h2 className="section-heading">先看这套工作方式如何成形，再决定它适合和谁一起成事。</h2>
          </div>
          <p className="muted section-copy">
            这里保留的是结构化判断，不是标签表演。四个维度会同时影响后面的广场展示、A2A 协商和协作说明书。
          </p>
        </div>
        <div className="detail-grid section">
          {axes.map((axis) => (
            <article key={axis.dimension} className="metric-card axis-card">
              <span className="eyebrow">{axisLabel[axis.dimension]}</span>
              <strong className="stat-number">{axis.dominantCode}</strong>
              <span className="stat-label">置信度 {(axis.confidence * 100).toFixed(0)}%</span>
            </article>
          ))}
        </div>
      </section>

      <section className="detail-grid section">
        <article className="manual-card">
          <span className="eyebrow">优势</span>
          <ul className="list">
            {card.profile.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="manual-card">
          <span className="eyebrow">风险</span>
          <ul className="list">
            {card.profile.risks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="manual-card">
          <span className="eyebrow">协作建议</span>
          <ul className="list">
            {card.actionHints.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="detail-grid section">
        <article className="manual-card">
          <span className="eyebrow">最适合的搭配</span>
          <p className="lead">{card.profile.bestWith}</p>
          <div className="subtle-divider" />
          <span className="eyebrow">更顺手的分工</span>
          <p className="muted">{card.profile.preferredWorkSplit}</p>
        </article>
        <article className="manual-card">
          <span className="eyebrow">最容易摩擦</span>
          <p className="lead">{card.profile.frictionWith}</p>
          <div className="subtle-divider" />
          <span className="eyebrow">建议起手方式</span>
          <p className="muted">{card.profile.badStartPattern}</p>
        </article>
      </section>

      {review?.enabled ? (
        <section className="panel review-panel">
          <div className="entry-section-header">
            <div>
              <span className="eyebrow">Second Me 复核</span>
              <h2 className="section-heading">这张名片不是被改写，而是被补充了另一层协作证据。</h2>
            </div>
            <span className="chip">{review.correction?.correctedAxes.length ? "已触发低置信校正" : "已同步侧写"}</span>
          </div>
          <p className="lead section">
            {card.profile.baseWmti?.letters ?? card.profile.wmti.letters}
            {" -> "}
            {card.profile.wmti.letters}
          </p>
          <p className="muted">{review.sourceSummary ?? "Second Me 已为这张名片补充协作侧写。"}</p>
          {review.correction?.correctedAxes.length ? (
            <div className="detail-grid section">
              {review.correction.correctedAxes.map((axis) => (
                <article key={axis.dimension} className="metric-card axis-card">
                  <span className="eyebrow">{axisLabel[axis.dimension]}</span>
                  <strong className="stat-number">
                    {axis.baseCode}
                    {" -> "}
                    {axis.effectiveCode}
                  </strong>
                  <span className="stat-label">
                    量表 {(axis.baseConfidence * 100).toFixed(0)}% / Second Me {(axis.hintConfidence * 100).toFixed(0)}%
                  </span>
                </article>
              ))}
            </div>
          ) : null}
          {review.evidence.length > 0 ? (
            <ul className="list section">
              {review.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {currentUser?.userId === userId ? (
        <SecondMeWritebackPanel
          currentUser={currentUser}
          pending={assessmentWritebacks}
          recent={recentAssessmentWritebacks}
          eyebrow="Second Me 记忆写回"
          title="把这次测评结果写回你的分身"
        />
      ) : null}
    </main>
  );
}
