"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { CollaborationManual, SandboxSession } from "@dual-core/domain";

import { explainConflictFlag, getRecommendationInsight, getRiskTagLabel } from "../../../lib/conflict-explainer";
import type { CurrentUserContext } from "../../../lib/current-user";
import { withDemoQuery } from "../../../lib/route-utils";

interface ArenaConsoleProps {
  currentUser: CurrentUserContext;
  initialSession: SandboxSession;
}

type RoundPayload =
  | {
      status: "ok";
      data: {
        state: SandboxSession["state"];
        round: SandboxSession["rounds"][number];
      };
    }
  | {
      status: "error";
      error: { message: string };
    };

type FinalizePayload =
  | {
      status: "ok";
      data: {
        session: SandboxSession;
        manual: CollaborationManual;
      };
    }
  | {
      status: "error";
      error: { message: string };
    };

const recommendationLabel = {
  continue: "继续深入",
  cautious: "可以合作，但要先约边界",
  terminate: "建议终止连接",
} as const;

export function ArenaConsole({ currentUser, initialSession }: ArenaConsoleProps) {
  const [session, setSession] = useState(initialSession);
  const [manualReady, setManualReady] = useState(Boolean(initialSession.manualReady));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleRounds = useMemo(
    () => session.rounds.filter((round) => round.roundIndex <= session.currentRound),
    [session],
  );

  const nextRound = session.currentRound + 1;
  const canAdvance = session.source === "demo" && session.currentRound < 3 && !pending;
  const canFinalize = session.currentRound >= 3 && !manualReady && !pending;
  const canReconnect = manualReady && session.state !== "filtered_out";
  const recommendation = getRecommendationInsight(session.recommendation);

  async function advance() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(withDemoQuery("/api/sandbox/round", currentUser.demoMode), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: session.sessionId,
          roundIndex: nextRound,
        }),
      });

      const payload = (await response.json()) as RoundPayload;
      if (payload.status === "error") {
        setError(payload.error.message);
        setPending(false);
        return;
      }

      setSession((current) => ({
        ...current,
        state: payload.data.state,
        currentRound: payload.data.round.roundIndex,
      }));
      setPending(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "推进沙盘失败");
      setPending(false);
    }
  }

  async function finalize() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(withDemoQuery("/api/sandbox/finalize", currentUser.demoMode), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: session.sessionId,
        }),
      });

      const payload = (await response.json()) as FinalizePayload;
      if (payload.status === "error") {
        setError(payload.error.message);
        setPending(false);
        return;
      }

      setSession(payload.data.session);
      setManualReady(Boolean(payload.data.session.manualReady ?? true));
      setPending(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "生成说明书失败");
      setPending(false);
    }
  }

  return (
    <main className="stack">
      <section className="split-grid">
        <article className="hero-panel">
          <span className="eyebrow">A2A 赛博沙盘</span>
          <h1 className="hero-title">{session.topic.title}</h1>
          <p className="lead">{session.topic.prompt}</p>
          <p className="muted">
            {session.source === "plaza"
              ? "这次协商已经在后台替你们跑完。现在看到的，是双方如何碰撞、让步与定边界。"
              : "别急着交换联系方式，先让两个版本的你们在问题里相遇。"}
          </p>
          {session.secondMeEvidenceSummary ? (
            <div className="pair-line section">
              <span className="chip">Second Me</span>
              <span className="muted">
                {session.secondMeEvidenceSummary.usedCalibration ? "本局预演参考了复核画像" : "本局预演参考了协作侧写"}
              </span>
            </div>
          ) : null}
          <div className="pill-row section">
            {session.topic.riskTags.map((tag) => (
              <span key={tag} className="chip">
                {getRiskTagLabel(tag)}
              </span>
            ))}
          </div>
          <div className="pair-line section">
            <span className="chip">题源</span>
            <a href={session.topic.sourceUrl} target="_blank" rel="noreferrer" className="ghost-link">
              查看知乎题目
            </a>
          </div>
        </article>

        <aside className="panel">
          <span className="eyebrow">当前状态</span>
          <div className="score-badge section">
            <strong>{session.fitScore}</strong>
            <span>/ 100</span>
          </div>
          <p className="lead">{recommendationLabel[session.recommendation]}</p>
          <p className="muted">{recommendation.description}</p>
          <div className="stack section">
            <div className="pair-line">
              <span className="chip">已推进回合</span>
              <span className="muted">{session.currentRound} / 3</span>
            </div>
            <div className="pair-line">
              <span className="chip">当前模式</span>
              <span className="muted">{session.source === "plaza" ? "公开广场自动协商" : "开发演示手动推进"}</span>
            </div>
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
                    <p className="helper-text">
                      <strong>建议动作：</strong>
                      {insight.action}
                    </p>
                  </article>
                );
              })
            ) : (
              <p className="muted">当前还没有明确的结构化冲突标签。</p>
            )}
          </div>
          <div className="inline-actions section">
            {canAdvance ? (
              <button type="button" className="cta-link button-link" onClick={advance}>
                推进 Round {nextRound}
              </button>
            ) : null}
            {canFinalize ? (
              <button type="button" className="cta-link button-link" onClick={finalize}>
                {session.source === "plaza" ? "基于协商回放生成协作说明书" : "生成协作说明书"}
              </button>
            ) : null}
            {canReconnect ? (
              <Link href={withDemoQuery(`/reconnect/${session.sessionId}`, currentUser.demoMode)} className="cta-link">
                进入 Reconnect
              </Link>
            ) : null}
            {manualReady && session.state === "filtered_out" ? (
              <span className="danger helper-text">有些摩擦适合现在被看见，而不是留到真正靠近之后。</span>
            ) : null}
            <Link href={withDemoQuery("/me", currentUser.demoMode)} className="ghost-link">
              返回我的流程中心
            </Link>
          </div>
          {error ? <p className="danger helper-text">{error}</p> : null}
        </aside>
      </section>

      <section className="timeline-grid section">
        {visibleRounds.length === 0 ? (
          <article className="panel">
            <span className="eyebrow">尚未开始</span>
            <p className="lead">这不是一次结果展示，而是提前看见真实协作里的摩擦、误解与可能。</p>
          </article>
        ) : null}
        {visibleRounds.map((round) => (
          <article key={round.roundIndex} className="round-card">
            <div className="pair-line">
              <span className="eyebrow">Round {round.roundIndex}</span>
              <span className="chip">
                {round.roundType === "positioning"
                  ? "立场确认"
                  : round.roundType === "negotiation"
                    ? "冲突协商"
                    : "规则敲定"}
              </span>
            </div>
            <h3>{round.issue}</h3>
            <p className="muted">{round.question}</p>
            <div className="stack section">
              <div>
                <strong>Agent A</strong>
                <p className="muted">{round.agentAResponse}</p>
              </div>
              <div>
                <strong>Agent B</strong>
                <p className="muted">{round.agentBResponse}</p>
              </div>
              <div>
                <strong>系统观察</strong>
                <p className="muted">{round.observerNote}</p>
              </div>
              <div>
                <strong>张力点</strong>
                <p className="muted">{round.tensionPoint}</p>
              </div>
              <div>
                <strong>让步</strong>
                <p className="muted">{round.concession}</p>
              </div>
              <div>
                <strong>边界</strong>
                <p className="muted">{round.boundary}</p>
              </div>
              <div>
                <strong>阶段综合</strong>
                <p className="muted">{round.synthesis}</p>
              </div>
            </div>
            <div className="subtle-divider" />
            <div className="pair-line">
              <span className="chip">回合拟合度</span>
              <span className="muted">{round.fitScore} / 100</span>
            </div>
          </article>
        ))}
      </section>

    </main>
  );
}
