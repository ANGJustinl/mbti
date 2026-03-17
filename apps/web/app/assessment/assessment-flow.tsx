"use client";

import { useRouter } from "next/navigation";
import { startTransition, useMemo, useState } from "react";

import type { OptionKey, WmtiQuestion } from "@dual-core/domain";

import type { CurrentUserContext } from "../../lib/current-user";
import { withDemoQuery } from "../../lib/route-utils";

interface AssessmentFlowProps {
  currentUser: CurrentUserContext;
  questions: WmtiQuestion[];
}

type ApiResponse =
  | {
      status: "ok";
      data: {
        profile: {
          userId: string;
          wmti: { letters: string };
        };
      };
    }
  | {
      status: "error";
      error: { message: string };
    };

const dimensionLabel = {
  energy: "能量获取",
  perception: "信息处理",
  decision: "决策逻辑",
  execution: "执行方式",
} as const;

export function AssessmentFlow({ currentUser, questions }: AssessmentFlowProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, OptionKey>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(
    () =>
      questions.reduce<Record<string, WmtiQuestion[]>>((accumulator, question) => {
        accumulator[question.dimension] ??= [];
        accumulator[question.dimension].push(question);
        return accumulator;
      }, {}),
    [questions],
  );

  const answeredCount = Object.keys(answers).length;
  const ready = answeredCount === questions.length;

  function selectAnswer(questionId: string, optionKey: OptionKey) {
    setAnswers((current) => ({
      ...current,
      [questionId]: optionKey,
    }));
  }

  function submit() {
    setPending(true);
    setError(null);

    startTransition(async () => {
      try {
        const endpoint = withDemoQuery("/api/assessment/submit", currentUser.demoMode);
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            meta: {
              name: currentUser.displayName,
              roleTag: currentUser.roleTag,
            },
            answers: questions.map((question) => ({
              questionId: question.id,
              optionKey: answers[question.id],
            })),
          }),
        });

        const payload = (await response.json()) as ApiResponse;
        if (payload.status === "error") {
          setError(payload.error.message);
          setPending(false);
          return;
        }

        router.push(withDemoQuery(`/card/${payload.data.profile.userId}`, currentUser.demoMode));
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "提交失败，请稍后再试");
        setPending(false);
      }
    });
  }

  return (
    <main className="stack">
      <section className="hero-panel">
        <span className="eyebrow">W-MBTI 40 题标准量表</span>
        <h1 className="hero-title">先把你的工作方式说清楚，再谈你适合和谁一起成事。</h1>
        <p className="lead">
          这版测评已经接到真实主流程：提交后会写入 SQLite，生成双核名片，并作为后续沙盘的前置条件。
        </p>
        <div className="section form-summary">
          <div className="metric-card">
            <span className="eyebrow">当前进度</span>
            <strong className="stat-number">
              {answeredCount} / {questions.length}
            </strong>
            <span className="stat-label">{ready ? "可以提交并生成名片" : "完成全部作答后才能提交"}</span>
          </div>
          <div className="metric-card">
            <span className="eyebrow">当前身份</span>
            <strong className="stat-number">{currentUser.displayName}</strong>
            <span className="stat-label">
              {currentUser.demoMode
                ? "开发态 demo 身份，可直接演示完整主链路"
                : "提交后将写入你的当前用户画像"}
            </span>
          </div>
        </div>
      </section>

      {Object.entries(groups).map(([dimension, items]) => (
        <section key={dimension} className="panel">
          <div className="pair-line">
            <span className="eyebrow">{dimensionLabel[dimension as keyof typeof dimensionLabel]}</span>
            <span className="muted">{items.length} 题</span>
          </div>
          <div className="question-grid section">
            {items.map((question) => (
              <article key={question.id} className="question-card">
                <div className="pair-line">
                  <span className="chip">{question.id}</span>
                  <span className="muted tiny">{question.dimension}</span>
                </div>
                <h3>{question.prompt}</h3>
                <div className="question-options">
                  {question.options.map((option) => {
                    const active = answers[question.id] === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        className={`option-button${active ? " active" : ""}`}
                        onClick={() => selectAnswer(question.id, option.key)}
                      >
                        <strong>{option.key}.</strong> {option.label}
                      </button>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      <section className="panel">
        <span className="eyebrow">提交测评</span>
        <div className="inline-actions section">
          <button
            type="button"
            className="cta-link button-link"
            onClick={submit}
            disabled={!ready || pending}
          >
            {pending ? "正在生成双核名片..." : "提交并生成双核名片"}
          </button>
          <button
            type="button"
            className="ghost-link button-link"
            onClick={() => router.push(withDemoQuery("/match", currentUser.demoMode))}
          >
            直接去看匹配主链路
          </button>
        </div>
        {error ? <p className="danger helper-text">{error}</p> : null}
      </section>
    </main>
  );
}
