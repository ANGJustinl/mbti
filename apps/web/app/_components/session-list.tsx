import Link from "next/link";

import { getSessionHref } from "../../lib/entry-view";
import type { SessionSummary } from "../../lib/workflow";

type SessionVariant = "sandboxing" | "reconnect_ready" | "exchanged" | "filtered_out";

interface SessionListProps {
  eyebrow: string;
  title: string;
  emptyTitle: string;
  emptyDescription: string;
  sessions: SessionSummary[];
  demoMode: boolean;
  variant: SessionVariant;
}

function getSessionCta(variant: SessionVariant) {
  switch (variant) {
    case "sandboxing":
      return "查看协商回放";
    case "reconnect_ready":
      return "查看说明书并确认";
    case "exchanged":
      return "查看已解锁名片";
    case "filtered_out":
      return "查看冲突复盘";
    default:
      return "打开";
  }
}

function getSessionStatus(summary: SessionSummary, variant: SessionVariant) {
  if (variant === "sandboxing") {
    if (summary.source === "plaza" && summary.currentRound >= 3) {
      return "A2A 已生成";
    }

    return summary.state === "matched" ? "待开始" : `${summary.currentRound} / 3 回合`;
  }

  if (variant === "reconnect_ready") {
    return `我 ${summary.actorConfirmed ? "已确认" : "待确认"} / 对方 ${
      summary.counterpartConfirmed ? "已确认" : "待确认"
    }`;
  }

  if (variant === "exchanged") {
    return "双方已确认";
  }

  return "排雷完成";
}

function getSessionBadge(summary: SessionSummary, variant: SessionVariant) {
  if (variant === "sandboxing") {
    return summary.source === "plaza" ? "A2A" : summary.state;
  }

  if (variant === "reconnect_ready") {
    return summary.recommendation;
  }

  return variant === "exchanged" ? "已交换" : "终止连接";
}

export function SessionList({
  eyebrow,
  title,
  emptyTitle,
  emptyDescription,
  sessions,
  demoMode,
  variant,
}: SessionListProps) {
  return (
    <article className="panel session-panel">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {sessions.length === 0 ? (
        <div className="session-empty section">
          <p className="empty-title">{emptyTitle}</p>
          <p className="muted">{emptyDescription}</p>
        </div>
      ) : (
        <div className="stack section">
          {sessions.map((summary) => (
            <article key={summary.sessionId} className="card-block session-card">
              <div className="pair-line">
                <span className={variant === "filtered_out" ? "status-chip" : "chip"}>
                  {getSessionBadge(summary, variant)}
                </span>
                <span className="muted tiny">{getSessionStatus(summary, variant)}</span>
              </div>
              <h3>{summary.counterpart.name}</h3>
              <p className="muted">{summary.topic.title}</p>
              <div className="pair-line session-footnote">
                <span className="chip">{summary.counterpart.wmtiLetters ?? "待测评"}</span>
                {summary.counterpart.kind === "agent" ? <span className="chip">Agent 用户</span> : null}
                <span className="muted tiny">{summary.counterpart.roleTag}</span>
              </div>
              <Link href={getSessionHref(summary, demoMode)} className="ghost-link section">
                {getSessionCta(variant)}
              </Link>
            </article>
          ))}
        </div>
      )}
    </article>
  );
}
