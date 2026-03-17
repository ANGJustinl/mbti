"use client";

import { useRouter } from "next/navigation";
import { startTransition, useMemo, useState } from "react";

import type { DebateTopic, DualCoreCard, MatchIntent, PersonalityProfile } from "@dual-core/domain";

import type { CurrentUserContext } from "../../lib/current-user";
import { withDemoQuery } from "../../lib/route-utils";

interface MatchLauncherProps {
  currentUser: CurrentUserContext;
  profile: PersonalityProfile;
  intent: MatchIntent;
  candidates: DualCoreCard[];
  topics: DebateTopic[];
}

type MatchResponse =
  | {
      status: "ok";
      data: {
        session: {
          sessionId: string;
        };
      };
    }
  | {
      status: "error";
      error: { message: string };
    };

export function MatchLauncher({
  currentUser,
  profile,
  intent,
  candidates,
  topics,
}: MatchLauncherProps) {
  const router = useRouter();
  const [targetProfileId, setTargetProfileId] = useState(candidates[0]?.profile.userId ?? "");
  const [topicId, setTopicId] = useState(topics[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCandidate = useMemo(
    () => candidates.find((item) => item.profile.userId === targetProfileId) ?? candidates[0],
    [candidates, targetProfileId],
  );
  const selectedTopic = useMemo(
    () => topics.find((item) => item.id === topicId) ?? topics[0],
    [topicId, topics],
  );

  function launch() {
    setPending(true);
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(withDemoQuery("/api/match/start", currentUser.demoMode), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            targetProfileId,
            topicId,
          }),
        });

        const payload = (await response.json()) as MatchResponse;
        if (payload.status === "error") {
          setError(payload.error.message);
          setPending(false);
          return;
        }

        router.push(withDemoQuery(`/arena/${payload.data.session.sessionId}`, currentUser.demoMode));
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "发起匹配失败");
        setPending(false);
      }
    });
  }

  return (
    <main className="stack">
      <section className="split-grid">
        <article className="hero-panel">
          <span className="eyebrow">匹配意图</span>
          <h1 className="hero-title">{profile.lifeModeTitle}</h1>
          <p className="lead">
            {currentUser.displayName}
            希望找到能一起扛项目、扛冲突、扛长周期不确定性的协作搭子。
          </p>
          <div className="detail-grid section">
            <div className="metric-card">
              <span className="eyebrow">Looking For</span>
              <p className="muted">{intent.lookingFor}</p>
            </div>
            <div className="metric-card">
              <span className="eyebrow">Must Have</span>
              <ul className="list">
                {intent.mustHave.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="metric-card">
              <span className="eyebrow">Red Flags</span>
              <ul className="list">
                {intent.redFlags.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </article>

        <aside className="panel">
          <span className="eyebrow">本轮发起设置</span>
          <div className="stack section">
            <label className="form-field">
              <span className="field-label">选择候选人</span>
              <select
                className="form-control"
                value={targetProfileId}
                onChange={(event) => setTargetProfileId(event.target.value)}
              >
                {candidates.map((candidate) => (
                  <option key={candidate.profile.userId} value={candidate.profile.userId}>
                    {candidate.profile.name} / {candidate.profile.wmti.letters}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span className="field-label">选择修罗场题目</span>
              <select
                className="form-control"
                value={topicId}
                onChange={(event) => setTopicId(event.target.value)}
              >
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.title}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="cta-link button-link" onClick={launch} disabled={pending}>
              {pending ? "正在创建沙盘会话..." : "发起 Agent 双盲沙盘"}
            </button>
            {error ? <p className="danger helper-text">{error}</p> : null}
          </div>
        </aside>
      </section>

      <section className="split-grid section">
        <article className="panel">
          <span className="eyebrow">已选对象</span>
          {selectedCandidate ? (
            <article className="card-block section">
              <div className="pair-line">
                <span className="chip">{selectedCandidate.profile.wmti.letters}</span>
                <span className="muted tiny">{selectedCandidate.profile.roleTag}</span>
              </div>
              <h3>{selectedCandidate.profile.name}</h3>
              <p className="muted">
                {selectedCandidate.profile.lifeModeTitle} / {selectedCandidate.profile.workModeTitle}
              </p>
              <ul className="list">
                {selectedCandidate.profile.strengths.slice(0, 3).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ) : null}
        </article>

        <article className="panel">
          <span className="eyebrow">当前题目</span>
          {selectedTopic ? (
            <article className="topic-card section">
              <h3>{selectedTopic.title}</h3>
              <p className="muted">{selectedTopic.prompt}</p>
              <div className="pill-row section">
                {selectedTopic.riskTags.map((tag) => (
                  <span key={tag} className="chip">
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ) : null}
        </article>
      </section>
    </main>
  );
}
