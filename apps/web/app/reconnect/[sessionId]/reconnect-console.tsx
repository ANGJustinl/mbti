"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type {
  CollaborationManual,
  ConflictFlag,
  DebateTopic,
  Recommendation,
  ReconnectCard,
  SecondMeWritebackPreview,
  SessionState,
} from "@dual-core/domain";

import { SecondMeWritebackPanel } from "../../_components/secondme-writeback-panel";
import { explainConflictFlag, getRecommendationInsight, getRiskTagLabel } from "../../../lib/conflict-explainer";
import type { CurrentUserContext } from "../../../lib/current-user";
import { withDemoQuery } from "../../../lib/route-utils";
import type { SessionParticipantSummary } from "../../../lib/workflow";

interface ReconnectConsoleProps {
  currentUser: CurrentUserContext;
  actorUserId: string;
  allowActorSwitch: boolean;
  participants: {
    userId: string;
    targetUserId: string;
    initiator: SessionParticipantSummary;
    target: SessionParticipantSummary;
  };
  decisions: Record<string, boolean>;
  sessionId: string;
  initialState: SessionState;
  session: {
    sessionId: string;
    fitScore: number;
    recommendation: Recommendation;
    topic: DebateTopic;
    conflictFlags: ConflictFlag[];
    secondMeEvidenceSummary?: CollaborationManual["secondMeEvidenceSummary"];
  };
  manual: CollaborationManual;
  initialCards: ReconnectCard[];
  writebacks: SecondMeWritebackPreview[];
}

type ReconnectPayload =
  | {
      status: "ok";
      data: {
        state: SessionState;
        cards: ReconnectCard[];
      };
    }
  | {
      status: "error";
      error: { message: string };
    };

function getActorHref(sessionId: string, currentUser: CurrentUserContext, actorUserId: string) {
  const pathname = actorUserId === currentUser.userId
    ? `/reconnect/${sessionId}`
    : `/reconnect/${sessionId}?actor=${encodeURIComponent(actorUserId)}`;

  return withDemoQuery(pathname, currentUser.demoMode);
}

export function ReconnectConsole({
  currentUser,
  actorUserId,
  allowActorSwitch,
  participants,
  decisions,
  sessionId,
  initialState,
  session,
  manual,
  initialCards,
  writebacks,
}: ReconnectConsoleProps) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [cards, setCards] = useState(initialCards);
  const [decisionState, setDecisionState] = useState(decisions);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actorCard = useMemo(
    () => cards.find((card) => card.userId === actorUserId) ?? cards[0],
    [actorUserId, cards],
  );
  const counterpartCard = useMemo(
    () => cards.find((card) => card.userId !== actorUserId) ?? cards[1] ?? cards[0],
    [actorUserId, cards],
  );
  const actorLabel = actorUserId === currentUser.userId ? "我" : "切换视角中的操作者";
  const actorConfirmed = decisionState[actorUserId] ?? state === "exchanged";
  const counterpartConfirmed =
    decisionState[counterpartCard?.userId ?? ""] ?? state === "exchanged";
  const actorSummary =
    actorUserId === participants.userId ? participants.initiator : participants.target;
  const counterpartSummary =
    actorUserId === participants.userId ? participants.target : participants.initiator;
  const recommendation = getRecommendationInsight(session.recommendation);

  async function confirm() {
    setPending(true);
    setError(null);

    try {
      const basePath =
        actorUserId === currentUser.userId
          ? "/api/reconnect/confirm"
          : `/api/reconnect/confirm?actor=${encodeURIComponent(actorUserId)}`;
      const response = await fetch(withDemoQuery(basePath, currentUser.demoMode), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          actorUserId: actorUserId === currentUser.userId ? undefined : actorUserId,
          confirmed: true,
        }),
      });

      const payload = (await response.json()) as ReconnectPayload;
      if (payload.status === "error") {
        setError(payload.error.message);
        setPending(false);
        return;
      }

      setState(payload.data.state);
      setCards(payload.data.cards);
      setDecisionState((current) => ({
        ...current,
        [actorUserId]: true,
        ...(payload.data.state === "exchanged"
          ? {
              [participants.userId]: true,
              [participants.targetUserId]: true,
            }
          : {}),
      }));
      setPending(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "确认连接失败");
      setPending(false);
    }
  }

  return (
    <main className="stack">
      <section className="split-grid">
        <article className="hero-panel">
          <span className="eyebrow">Reconnect</span>
          <h1 className="hero-title">《专属协作说明书》</h1>
          <p className="lead">如果一段关系值得开始，它不该只留下“匹配成功”四个字。</p>
          <p className="muted">{manual.summary}</p>
        </article>

        <aside className="panel">
          <span className="eyebrow">本次判定</span>
          <div className="score-badge section">
            <strong>{session.fitScore}</strong>
            <span>/ 100</span>
          </div>
          <p className="lead">{recommendation.label}</p>
          <p className="muted">{recommendation.description}</p>
          {session.secondMeEvidenceSummary ? (
            <div className="pair-line section">
              <span className="chip">Second Me</span>
              <span className="muted">
                {session.secondMeEvidenceSummary.usedCalibration ? "本次判定参考了复核画像" : "本次判定参考了协作侧写"}
              </span>
            </div>
          ) : null}
          <div className="pair-line section">
            <span className="chip">题源</span>
            <a href={session.topic.sourceUrl} target="_blank" rel="noreferrer" className="ghost-link">
              查看知乎题目
            </a>
          </div>
          <div className="pill-row section">
            {session.topic.riskTags.map((tag) => (
              <span key={tag} className="chip">
                {getRiskTagLabel(tag)}
              </span>
            ))}
          </div>
        </aside>
      </section>

      <section className="detail-grid section">
        <article className="manual-card">
          <span className="eyebrow">互补价值</span>
          <ul className="list">
            {manual.complements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="manual-card">
          <span className="eyebrow">风险提醒</span>
          <ul className="list">
            {manual.riskPoints.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="manual-card">
          <span className="eyebrow">沟通规则</span>
          <ul className="list">
            {manual.communicationRules.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="manual-card">
          <span className="eyebrow">分工建议</span>
          <ul className="list">
            {manual.workSplitSuggestions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>

      {manual.secondMeEvidenceSummary ? (
        <section className="panel">
          <div className="pair-line">
            <span className="eyebrow">Second Me 依据</span>
            <span className="chip">
              {manual.secondMeEvidenceSummary.usedCalibration ? "使用复核画像" : "使用协作侧写"}
            </span>
          </div>
          <p className="lead">{manual.secondMeEvidenceSummary.sourceSummary}</p>
          <div className="pill-row section">
            {manual.secondMeEvidenceSummary.influencedSections.map((item) => (
              <span key={item} className="chip">
                {item}
              </span>
            ))}
          </div>
          <ul className="list section">
            {manual.secondMeEvidenceSummary.evidence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="split-grid section">
        <article className="panel">
          <span className="eyebrow">排雷解释</span>
          <h2>{session.topic.title}</h2>
          <p className="lead">{session.topic.prompt}</p>
          <div className="stack section">
            {session.conflictFlags.length > 0 ? (
              session.conflictFlags.map((flag) => {
                const insight = explainConflictFlag(flag);

                return (
                  <article key={flag.type} className="card-block">
                    <div className="pair-line">
                      <span className="status-chip">{insight.label}</span>
                      <span className={flag.severity === "high" ? "danger" : "warning"}>
                        {insight.severityLabel}
                      </span>
                    </div>
                    <p className="muted section">{flag.reason}</p>
                    <p className="muted">{insight.signal}</p>
                    <p className="helper-text">
                      <strong>建议动作：</strong>
                      {insight.action}
                    </p>
                  </article>
                );
              })
            ) : (
              <article className="card-block">
                <h3>当前没有明确冲突标签</h3>
                <p className="muted">这次组合暂时没有触发结构化排雷标签，可以把重点放在分工和执行节奏的细化上。</p>
              </article>
            )}
          </div>
        </article>

        <article className="panel">
          <span className="eyebrow">一键交换现实名片</span>
          <p className="lead">
            当前状态：
            {state === "exchanged" ? " 双方都已确认，数字名片已解锁。" : " 仍需双方确认，联系方式会保持脱敏。"}
          </p>
          <p className="muted">你们已经看见了彼此如何做事，接下来，要不要靠近，由你决定。</p>
          <div className="stack section">
            <article className="card-block">
              <div className="pair-line">
                <span className="chip">{actorLabel}</span>
                {actorSummary.kind === "agent" ? <span className="chip">Agent 用户</span> : null}
                <span className={actorConfirmed ? "muted" : "warning"}>
                  {actorConfirmed ? "已确认" : "待确认"}
                </span>
              </div>
              <h3>{actorCard?.displayName ?? actorSummary.name}</h3>
              <p className="muted">{actorCard?.title ?? actorSummary.workModeTitle ?? actorSummary.roleTag}</p>
            </article>
            <article className="card-block">
              <div className="pair-line">
                <span className="chip">对方</span>
                {counterpartSummary.kind === "agent" ? <span className="chip">Agent 用户</span> : null}
                <span className={counterpartConfirmed ? "muted" : "warning"}>
                  {counterpartConfirmed ? "已确认" : "待确认"}
                </span>
              </div>
              <h3>{counterpartCard?.displayName ?? counterpartSummary.name}</h3>
              <p className="muted">
                {counterpartCard?.title ?? counterpartSummary.workModeTitle ?? counterpartSummary.roleTag}
              </p>
            </article>
          </div>

          {allowActorSwitch ? (
            <div className="inline-actions section">
              <Link href={getActorHref(sessionId, currentUser, participants.userId)} className="ghost-link">
                查看 {participants.initiator.name} 视角
              </Link>
              <Link href={getActorHref(sessionId, currentUser, participants.targetUserId)} className="ghost-link">
                查看 {participants.target.name} 视角
              </Link>
            </div>
          ) : null}

          <div className="inline-actions section">
            <button
              type="button"
              className="cta-link button-link"
              onClick={confirm}
              disabled={state === "exchanged" || pending || actorConfirmed}
            >
              {pending
                ? "正在确认..."
                : actorConfirmed
                  ? "当前视角已确认"
                  : actorUserId === currentUser.userId
                    ? "我已确认"
                    : `以 ${actorSummary.name} 视角确认`}
            </button>
          </div>

          {error ? <p className="danger helper-text">{error}</p> : null}

          <div className="stack section">
            {cards.map((card) => (
              <article key={card.sessionId} className="card-block">
                <div className="pair-line">
                  <h3>{card.displayName}</h3>
                  {card.contactKind === "agent_proxy" ? <span className="chip">代理名片</span> : null}
                </div>
                <p className="muted">{card.title}</p>
                <div className="pair-line">
                  <span className="chip">{card.contactKind === "agent_proxy" ? "代理入口" : "数字名片"}</span>
                  <span className="muted">{card.contactValue ?? card.contactHint}</span>
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="panel">
        <span className="eyebrow">知乎护身符</span>
        <div className="card-grid section">
          {manual.zhihuAdviceRefs.map((item) => (
            <article key={item.sourceUrl} className="topic-card">
              <h3>{item.title}</h3>
              <p className="muted">{item.excerpt}</p>
              <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="ghost-link section">
                查看原文
              </a>
            </article>
          ))}
        </div>
      </section>

      <SecondMeWritebackPanel
        currentUser={currentUser}
        pending={writebacks.filter((item) => item.status === "pending")}
        recent={writebacks.filter((item) => item.status !== "pending")}
        eyebrow="Second Me 记忆写回"
        title="决定要不要把这段协作轨迹留给你的分身"
      />
    </main>
  );
}
