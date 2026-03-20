"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { PersonalityProfile, PlazaListing } from "@dual-core/domain";

import type { CurrentUserContext } from "../../lib/current-user";
import { withDemoQuery } from "../../lib/route-utils";
import type { PlazaFeedItem } from "../../lib/workflow";

interface PlazaLauncherProps {
  currentUser: CurrentUserContext;
  profile: PersonalityProfile;
  initialListing: PlazaListing | null;
  initialFeed: PlazaFeedItem[];
}

type PublishPayload =
  | {
      status: "ok";
      data: {
        listing: PlazaListing;
      };
    }
  | {
      status: "error";
      error: { message: string };
    };

type SignalPayload =
  | {
      status: "ok";
      data: {
        state: "pending" | "mutual";
        sessionId?: string;
      };
    }
  | {
      status: "error";
      error: { message: string };
    };

function toTagInput(tags: string[]) {
  return tags.join(" / ");
}

function fromTagInput(value: string) {
  return value
    .split(/[\/,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function relationshipLabel(relationship: PlazaFeedItem["relationship"]) {
  switch (relationship) {
    case "mutual":
      return "已互选";
    case "incoming":
      return "对方已先看中你";
    case "outgoing":
      return "你已发起，等待回应";
    default:
      return "可浏览对象";
  }
}

export function PlazaLauncher({
  currentUser,
  profile,
  initialListing,
  initialFeed,
}: PlazaLauncherProps) {
  const [listing, setListing] = useState(initialListing);
  const [feed, setFeed] = useState(initialFeed);
  const [pending, setPending] = useState(false);
  const [signalPendingUserId, setSignalPendingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [headline, setHeadline] = useState(initialListing?.headline ?? `${profile.name} ${profile.collaborationThesis}`);
  const [lookingFor, setLookingFor] = useState(initialListing?.lookingFor ?? profile.bestWith);
  const [focusTags, setFocusTags] = useState(toTagInput(initialListing?.focusTags ?? [profile.wmti.letters]));
  const [availabilityNote, setAvailabilityNote] = useState(
    initialListing?.availabilityNote ?? profile.preferredWorkSplit,
  );

  const enabled = listing?.enabled ?? false;
  const plazaCount = useMemo(
    () => feed.filter((item) => item.signalStatus === "none" || item.signalStatus === "pending").length,
    [feed],
  );

  async function publish(nextEnabled: boolean) {
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/match/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled: nextEnabled,
          headline,
          lookingFor,
          focusTags: fromTagInput(focusTags),
          availabilityNote,
        }),
      });

      const payload = (await response.json()) as PublishPayload;
      if (payload.status === "error") {
        setError(payload.error.message);
        setPending(false);
        return;
      }

      setListing(payload.data.listing);
      setPending(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "公开广场发布失败");
      setPending(false);
    }
  }

  async function signal(toUserId: string) {
    setSignalPendingUserId(toUserId);
    setError(null);

    try {
      const response = await fetch("/api/match/signal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          toUserId,
        }),
      });

      const payload = (await response.json()) as SignalPayload;
      if (payload.status === "error") {
        setError(payload.error.message);
        setSignalPendingUserId(null);
        return;
      }

      setFeed((current) =>
        current.map((item) =>
          item.listing.userId === toUserId
            ? {
                ...item,
                signalStatus: payload.data.state,
                relationship: payload.data.state === "mutual" ? "mutual" : "outgoing",
                sessionId: payload.data.sessionId,
              }
            : item,
        ),
      );

      if (payload.data.state === "mutual" && payload.data.sessionId) {
        window.location.assign(withDemoQuery(`/arena/${payload.data.sessionId}`, currentUser.demoMode));
        return;
      }

      setSignalPendingUserId(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "发起协作意向失败");
      setSignalPendingUserId(null);
    }
  }

  return (
    <main className="stack plaza-shell">
      <section className="split-grid plaza-shell">
        <article className="hero-panel">
          <span className="eyebrow">公开广场</span>
          <h1 className="hero-title">让双核先出面，再决定要不要让现实靠近。</h1>
          <p className="lead">不是所有相遇都值得开始。先把你的协作像放进广场，再让 Agent to Agent 替你们试一次真正的合作。</p>
          <div className="detail-grid section signal-board">
            <article className="metric-card">
              <span className="eyebrow">当前协作像</span>
              <strong className="stat-number">{profile.wmti.letters}</strong>
              <span className="stat-label">{profile.collaborationThesis}</span>
            </article>
            <article className="metric-card">
              <span className="eyebrow">更适合</span>
              <strong className="stat-number">MATCH</strong>
              <span className="stat-label">{profile.bestWith}</span>
            </article>
            <article className="metric-card">
              <span className="eyebrow">广场可见</span>
              <strong className="stat-number">{enabled ? "ON" : "OFF"}</strong>
              <span className="stat-label">{enabled ? "其他已测评用户可以看到你的双核预览。" : "开启后才会出现在公开广场里。"}</span>
            </article>
          </div>
        </article>

        <aside className="panel plaza-form-panel">
          <span className="eyebrow">我的广场卡片</span>
          <div className="stack section">
            <label className="form-field">
              <span className="field-label">一句话协作像</span>
              <input className="form-control" value={headline} onChange={(event) => setHeadline(event.target.value)} />
            </label>
            <label className="form-field">
              <span className="field-label">我想找怎样的协作对象</span>
              <textarea
                className="form-control"
                rows={3}
                value={lookingFor}
                onChange={(event) => setLookingFor(event.target.value)}
              />
            </label>
            <label className="form-field">
              <span className="field-label">关注标签</span>
              <input className="form-control" value={focusTags} onChange={(event) => setFocusTags(event.target.value)} />
            </label>
            <label className="form-field">
              <span className="field-label">协作节奏说明</span>
              <textarea
                className="form-control"
                rows={3}
                value={availabilityNote}
                onChange={(event) => setAvailabilityNote(event.target.value)}
              />
            </label>
            <div className="inline-actions">
              <button
                type="button"
                className="cta-link button-link"
                disabled={pending}
                onClick={() => publish(!enabled)}
              >
                {pending ? "正在更新广场状态..." : enabled ? "先从公开广场撤下" : "进入公开广场"}
              </button>
              <Link href={`/card/${encodeURIComponent(currentUser.userId)}`} className="ghost-link">
                查看我的完整双核名片
              </Link>
            </div>
            <p className="muted helper-text">
              {enabled
                ? "你的双核预览已经在公开广场中可见。别人的协作意向会先进入等待互选，再自动触发 A2A。"
                : "先把你的双核预览放进广场，后面的互选和 A2A 才会发生。"}
            </p>
            {error ? <p className="danger helper-text">{error}</p> : null}
          </div>
        </aside>
      </section>

      <section className="section">
        <div className="entry-section-header">
          <div>
            <span className="eyebrow">公开广场 Feed</span>
            <h2 className="section-heading">先看对方怎样做事，再决定要不要把这段关系推向 A2A。</h2>
          </div>
          <p className="muted section-copy">
            当前可发起试探的对象：{plazaCount} 位。互选成功后，系统会自动生成三段协商回放。
          </p>
        </div>

        {feed.length === 0 ? (
          <article className="panel section">
            <span className="eyebrow">广场暂时安静</span>
            <p className="lead">还没有其他已完成测评并公开展示的 live 用户。</p>
            <p className="muted">你可以先开启自己的广场卡片，等其他真实用户进入后，这里会出现可查看和可试探的双核预览。</p>
          </article>
        ) : (
          <div className="card-grid section plaza-feed-grid">
            {feed.map((item) => {
              const reviewed = Boolean(item.listing.card.profile.secondMeReview?.enabled);
              const signaled = item.relationship === "outgoing" || item.relationship === "mutual";

              return (
                <article key={item.listing.userId} className="proof-card card-block plaza-feed-card">
                  <div className="board-strip">
                    <span className="chip">{item.listing.card.profile.wmti.letters}</span>
                    <span className="chip">{item.listing.card.profile.roleTag}</span>
                    <span className="chip">{relationshipLabel(item.relationship)}</span>
                    {item.listing.userKind === "agent" ? <span className="chip">Agent 用户</span> : null}
                    {reviewed ? <span className="chip">Second Me 复核</span> : null}
                  </div>
                  <h3>{item.listing.card.profile.name}</h3>
                  <p className="lead">{item.listing.headline}</p>
                  <p className="muted">{item.listing.lookingFor}</p>
                  <div className="pill-row section">
                    {item.listing.focusTags.map((tag) => (
                      <span key={tag} className="chip">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="subtle-divider" />
                  <div className="stack section">
                    <div className="pair-line">
                      <span className="chip">适合一起做</span>
                      <span className="muted">{item.listing.card.profile.bestWith}</span>
                    </div>
                    <div className="pair-line">
                      <span className="chip">容易摩擦</span>
                      <span className="muted">{item.listing.card.profile.frictionWith}</span>
                    </div>
                  </div>
                  <div className="inline-actions section">
                    <Link href={`/card/${encodeURIComponent(item.listing.userId)}`} className="ghost-link">
                      查看双核名片
                    </Link>
                    {item.signalStatus === "mutual" && item.sessionId ? (
                      <Link href={`/arena/${item.sessionId}`} className="cta-link">
                        查看 A2A 协商回放
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="cta-link button-link"
                        disabled={!enabled || signaled || signalPendingUserId === item.listing.userId}
                        onClick={() => signal(item.listing.userId)}
                      >
                        {signalPendingUserId === item.listing.userId
                          ? "正在交给 Agent..."
                          : item.relationship === "incoming"
                            ? "回选并开始 A2A"
                            : item.signalStatus === "pending"
                            ? "已发起，等待对方"
                            : enabled
                              ? "发起协作意向"
                              : "先开启我的广场卡片"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
