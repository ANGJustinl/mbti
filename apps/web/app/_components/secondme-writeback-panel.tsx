"use client";

import { useMemo, useState } from "react";

import type { SecondMeWritebackPreview } from "@dual-core/domain";

import type { CurrentUserContext } from "../../lib/current-user";
import { withDemoQuery } from "../../lib/route-utils";

interface WritebackPanelProps {
  currentUser: CurrentUserContext;
  pending: SecondMeWritebackPreview[];
  recent?: SecondMeWritebackPreview[];
  eyebrow?: string;
  title?: string;
}

type WritebackResponse =
  | {
      status: "ok";
      data: SecondMeWritebackPreview;
    }
  | {
      status: "error";
      error: { message: string };
    };

function statusLabel(status: SecondMeWritebackPreview["status"]) {
  switch (status) {
    case "synced":
      return "已写回";
    case "failed":
      return "写回失败";
    case "skipped":
      return "已跳过";
    default:
      return "待处理";
  }
}

export function SecondMeWritebackPanel({
  currentUser,
  pending,
  recent = [],
  eyebrow = "Second Me 记忆写回",
  title = "把这一步写回你的分身记忆",
}: WritebackPanelProps) {
  const [pendingItems, setPendingItems] = useState(pending);
  const [recentItems, setRecentItems] = useState(recent);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasContent = pendingItems.length > 0 || recentItems.length > 0;
  const sortedRecent = useMemo(() => recentItems.slice(0, 3), [recentItems]);

  async function handle(preview: SecondMeWritebackPreview, consented: boolean) {
    setLoadingKey(preview.targetKey);
    setError(null);

    try {
      const response = await fetch(withDemoQuery("/api/secondme/writeback", currentUser.demoMode), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          milestone: preview.milestone,
          sessionId: preview.sessionId,
          assessmentId: preview.assessmentId,
          consented,
        }),
      });

      const payload = (await response.json()) as WritebackResponse;
      if (payload.status === "error") {
        setError(payload.error.message);
        setLoadingKey(null);
        return;
      }

      setPendingItems((current) => current.filter((item) => item.targetKey !== preview.targetKey));
      setRecentItems((current) => [payload.data, ...current.filter((item) => item.targetKey !== preview.targetKey)]);
      setLoadingKey(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "写回失败");
      setLoadingKey(null);
    }
  }

  if (!hasContent) {
    return null;
  }

  return (
    <section className="panel">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p className="muted">
        告知并同意只针对写回 Second Me，不会影响双核职场主流程本身。你也可以稍后在流程中心继续处理。
      </p>

      {pendingItems.length > 0 ? (
        <div className="stack section">
          {pendingItems.map((preview) => (
            <article key={preview.targetKey} className="card-block">
              <div className="pair-line">
                <span className="chip">待确认</span>
                <span className="warning">{statusLabel(preview.status)}</span>
              </div>
              <h3>{preview.title}</h3>
              <p className="muted">{preview.description}</p>
              <ul className="list section">
                {preview.summaryLines.map((line) => (
                  <li key={`${preview.targetKey}-${line}`}>{line}</li>
                ))}
              </ul>
              <div className="inline-actions section">
                <button
                  type="button"
                  className="cta-link button-link"
                  onClick={() => handle(preview, true)}
                  disabled={loadingKey === preview.targetKey}
                >
                  {loadingKey === preview.targetKey ? "正在写回..." : "同意写回"}
                </button>
                <button
                  type="button"
                  className="ghost-link button-link"
                  onClick={() => handle(preview, false)}
                  disabled={loadingKey === preview.targetKey}
                >
                  暂不写入
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {sortedRecent.length > 0 ? (
        <div className="stack section">
          {sortedRecent.map((preview) => (
            <article key={preview.targetKey} className="card-block">
              <div className="pair-line">
                <span className="chip">最近结果</span>
                <span className={preview.status === "failed" ? "danger" : "muted"}>
                  {statusLabel(preview.status)}
                </span>
              </div>
              <h3>{preview.title}</h3>
              <p className="muted">{preview.description}</p>
              {preview.lastError ? <p className="helper-text danger">{preview.lastError}</p> : null}
              {preview.status === "failed" ? (
                <div className="inline-actions section">
                  <button
                    type="button"
                    className="ghost-link button-link"
                    onClick={() => handle(preview, true)}
                    disabled={loadingKey === preview.targetKey}
                  >
                    {loadingKey === preview.targetKey ? "正在重试..." : "重试写回"}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {error ? <p className="danger helper-text">{error}</p> : null}
    </section>
  );
}
