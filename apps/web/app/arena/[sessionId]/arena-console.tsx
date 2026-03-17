"use client";

import Link from "next/link";
import { startTransition, useMemo, useState } from "react";

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
  const [manualReady, setManualReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleRounds = useMemo(
    () => session.rounds.filter((round) => round.roundIndex <= session.currentRound),
    [session],
  );

  const nextRound = session.currentRound + 1;
  const canAdvance = session.currentRound < 3 && !pending;
  const canFinalize = session.currentRound >= 3 && !manualReady && !pending;
  const canReconnect = manualReady && session.state !== "filtered_out";
  const recommendation = getRecommendationInsight(session.recommendation);

  function advance() {
    setPending(true);
    setError(null);

    startTransition(async () => {
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
    });
  }

  function finalize() {
    setPending(true);
    setError(null);

    startTransition(async () => {
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
        setManualReady(true);
        setPending(false);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "生成说明书失败");
        setPending(false);
      }
    });
  }

  return (
    <main className="stack">
      <section className="split-grid">
        <article className="hero-panel">
          <span className="eyebrow">A2A 赛博沙盘</span>
          <h1 className="hero-title">{session.topic.title}</h1>
          <p className="lead">{session.topic.prompt}</p>
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
                生成协作说明书
              </button>
            ) : null}
            {canReconnect ? (
              <Link href={withDemoQuery(`/reconnect/${session.sessionId}`, currentUser.demoMode)} className="cta-link">
                进入 Reconnect
              </Link>
            ) : null}
            {manualReady && session.state === "filtered_out" ? (
              <span className="danger helper-text">本轮已触发排雷，系统建议终止连接。</span>
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
            <p className="lead">点击右侧按钮，开始第一轮 Agent 交锋。</p>
          </article>
        ) : null}
        {visibleRounds.map((round) => (
          <article key={round.roundIndex} className="round-card">
            <span className="eyebrow">Round {round.roundIndex}</span>
            <h3>{round.question}</h3>
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
            </div>
            <div className="subtle-divider" />
            <div className="pair-line">
              <span className="chip">回合拟合度</span>
              <span className="muted">{round.fitScore} / 100</span>
            </div>
          </article>
        ))}
      </section>

      <section className="panel">
        <span className="eyebrow">旁路入口</span>
        <div className="action-row">
          <Link href={withDemoQuery("/draw", currentUser.demoMode)} className="ghost-link">
            先去抽一张灵感卡
          </Link>
        </div>
      </section>
    </main>
  );
}
