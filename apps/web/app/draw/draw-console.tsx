"use client";

import { startTransition, useState } from "react";

interface DrawPayload {
  status: "ok" | "error";
  data?: {
    matchedAgentType: string;
    message: string;
    luckyNumber: number;
  };
  error?: {
    message: string;
  };
}

export function DrawConsole() {
  const [mood, setMood] = useState("卡住了");
  const [ask, setAsk] = useState("给我一点破局感");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DrawPayload["data"]>({
    matchedAgentType: "高压拆解型路人 Agent",
    message: "先别急着追求完美，把卡住你的那一步拆成三个最小动作。",
    luckyNumber: 27,
  });

  function submit() {
    setPending(true);
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/draw", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mood,
            ask,
          }),
        });

        const payload = (await response.json()) as DrawPayload;
        if (payload.status === "error") {
          setError(payload.error?.message ?? "抽卡失败");
          setPending(false);
          return;
        }

        setResult(payload.data);
        setPending(false);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "抽卡失败");
        setPending(false);
      }
    });
  }

  return (
    <main className="stack">
      <section className="hero-panel">
        <span className="eyebrow">赛博灵感抽卡机</span>
        <h1 className="hero-title">不聊命运，只借你一个能继续往前推的瞬间。</h1>
        <p className="lead">
          这是主链路之外的轻量分支。现在页面已经接入真实 API，可以按你的状态生成新的路人 Agent 回声。
        </p>
      </section>

      <section className="split-grid section">
        <article className="panel">
          <span className="eyebrow">当前结果</span>
          <div className="score-badge section">
            <strong>{result?.luckyNumber ?? "--"}</strong>
            <span>Lucky Number</span>
          </div>
          <p className="lead">{result?.message}</p>
          <p className="muted">{result?.matchedAgentType}</p>
        </article>

        <article className="panel">
          <span className="eyebrow">来一张新的</span>
          <div className="stack section">
            <label className="form-field">
              <span className="field-label">你现在的状态</span>
              <input className="form-control" value={mood} onChange={(event) => setMood(event.target.value)} />
            </label>
            <label className="form-field">
              <span className="field-label">你想借什么力</span>
              <textarea
                className="form-control textarea-control"
                value={ask}
                onChange={(event) => setAsk(event.target.value)}
              />
            </label>
            <button type="button" className="cta-link button-link" onClick={submit} disabled={pending}>
              {pending ? "正在抽取..." : "重新抽一张"}
            </button>
            {error ? <p className="danger helper-text">{error}</p> : null}
          </div>
        </article>
      </section>
    </main>
  );
}
