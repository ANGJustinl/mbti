"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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

const dimensionLead = {
  energy: "你更常从独处整理中回血，还是从高密度互动里点燃自己。",
  perception: "你更信当下可见的事实，还是先抓背后的模式和走势。",
  decision: "你做判断时更依赖结构、效率，还是先照顾关系与感受。",
  execution: "你习惯先把边界钉住推进，还是在变化里边走边调。",
} as const;

const dimensionOrder = ["energy", "perception", "decision", "execution"] as const;

export function AssessmentFlow({ currentUser, questions }: AssessmentFlowProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, OptionKey>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
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
  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentQuestion.id];
  const currentDimension = currentQuestion.dimension;
  const firstUnansweredIndex = questions.findIndex((question) => !answers[question.id]);
  const completion = Math.round((answeredCount / questions.length) * 100);
  const dimensionStats = dimensionOrder.map((dimension) => {
    const items = groups[dimension] ?? [];
    const completed = items.filter((question) => answers[question.id]).length;
    return {
      dimension,
      completed,
      total: items.length,
      active: dimension === currentDimension,
    };
  });

  function selectAnswer(questionId: string, optionKey: OptionKey) {
    setAnswers((current) => ({
      ...current,
      [questionId]: optionKey,
    }));
    setError(null);

    if (questionId === currentQuestion.id && currentIndex < questions.length - 1) {
      setCurrentIndex((current) => Math.min(current + 1, questions.length - 1));
    }
  }

  async function submit() {
    setPending(true);
    setError(null);

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

      const targetHref = withDemoQuery(
        `/card/${encodeURIComponent(payload.data.profile.userId)}`,
        currentUser.demoMode,
      );

      window.location.assign(targetHref);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "提交失败，请稍后再试");
      setPending(false);
    }
  }

  function goNext() {
    if (currentIndex === questions.length - 1) {
      if (ready) {
        void submit();
        return;
      }

      if (firstUnansweredIndex >= 0) {
        setCurrentIndex(firstUnansweredIndex);
      }
      return;
    }

    setCurrentIndex((current) => Math.min(current + 1, questions.length - 1));
  }

  function goPrevious() {
    setCurrentIndex((current) => Math.max(current - 1, 0));
  }

  return (
    <main className="tw-mx-auto tw-flex tw-w-full tw-max-w-7xl tw-flex-col tw-gap-6">
      <section className="tw-overflow-hidden tw-rounded-[32px] tw-border tw-border-white/10 tw-bg-[radial-gradient(circle_at_top_right,rgba(255,122,51,0.14),transparent_24%),linear-gradient(180deg,rgba(11,26,40,0.97),rgba(6,17,28,0.92))] tw-p-6 tw-shadow-[0_28px_80px_rgba(0,0,0,0.28)] md:tw-p-8">
        <div className="tw-flex tw-flex-col tw-gap-6 lg:tw-flex-row lg:tw-items-end lg:tw-justify-between">
          <div className="tw-max-w-3xl tw-space-y-4">
            <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-3">
              <span className="tw-inline-flex tw-items-center tw-rounded-full tw-border tw-border-cyan-400/30 tw-bg-cyan-400/10 tw-px-3 tw-py-1 tw-text-[11px] tw-font-semibold tw-uppercase tw-tracking-[0.28em] tw-text-cyan-200">
                W-MBTI 40 题标准量表
              </span>
              <span className="tw-inline-flex tw-items-center tw-rounded-full tw-border tw-border-white/10 tw-bg-white/5 tw-px-3 tw-py-1 tw-text-sm tw-text-slate-300">
                当前身份 · {currentUser.displayName}
              </span>
            </div>
            <div className="tw-space-y-3">
              <h1 className="tw-max-w-4xl tw-text-4xl tw-font-semibold tw-leading-tight tw-tracking-[-0.04em] tw-text-slate-50 md:tw-text-5xl">
                这不是为了定义你，只是为了看看你如何工作。
              </h1>
              <p className="tw-max-w-2xl tw-text-base tw-leading-8 tw-text-slate-300">
                你的工作方式会被轻轻放进当前身份里，成为后续判断的起点。之后的匹配与推演，都会从这里开始。
              </p>
            </div>
          </div>
          <div className="tw-grid tw-w-full tw-max-w-md tw-grid-cols-2 tw-gap-3">
            <article className="tw-rounded-3xl tw-border tw-border-white/10 tw-bg-white/5 tw-p-4">
              <p className="tw-text-[11px] tw-uppercase tw-tracking-[0.22em] tw-text-cyan-200">当前进度</p>
              <p className="tw-mt-3 tw-text-3xl tw-font-semibold tw-text-white">
                {answeredCount}
                <span className="tw-text-lg tw-text-slate-400"> / {questions.length}</span>
              </p>
              <p className="tw-mt-2 tw-text-sm tw-leading-6 tw-text-slate-400">
                {ready ? "可以提交并生成双核名片" : "不用一次看完 40 题，按当前节奏慢慢往前。"}
              </p>
            </article>
            <article className="tw-rounded-3xl tw-border tw-border-white/10 tw-bg-white/5 tw-p-4">
              <p className="tw-text-[11px] tw-uppercase tw-tracking-[0.22em] tw-text-amber-200">测评方式</p>
              <p className="tw-mt-3 tw-text-3xl tw-font-semibold tw-text-white">STEP</p>
              <p className="tw-mt-2 tw-text-sm tw-leading-6 tw-text-slate-400">
                不再平铺题海。现在每次只专注一道题和它正在观察的协作维度。
              </p>
            </article>
          </div>
        </div>
        <div className="tw-mt-6 tw-space-y-3">
          <div className="tw-flex tw-items-center tw-justify-between tw-text-sm tw-text-slate-400">
            <span>整体完成度</span>
            <span>{completion}%</span>
          </div>
          <div className="tw-h-2 tw-overflow-hidden tw-rounded-full tw-bg-white/10">
            <div
              className="tw-h-full tw-rounded-full tw-bg-gradient-to-r tw-from-orange-400 tw-via-amber-300 tw-to-cyan-300 tw-transition-all"
              style={{ width: `${Math.max(completion, answeredCount > 0 ? 4 : 0)}%` }}
            />
          </div>
        </div>
      </section>

      <section className="tw-grid tw-gap-6 lg:tw-grid-cols-[320px_minmax(0,1fr)]">
        <aside className="tw-space-y-4">
          <article className="tw-rounded-[28px] tw-border tw-border-white/10 tw-bg-[linear-gradient(180deg,rgba(15,34,54,0.96),rgba(8,19,30,0.88))] tw-p-5 tw-shadow-[0_18px_48px_rgba(0,0,0,0.22)]">
            <div className="tw-flex tw-items-center tw-justify-between">
              <span className="tw-text-[11px] tw-uppercase tw-tracking-[0.24em] tw-text-cyan-200">当前维度</span>
              <span className="tw-rounded-full tw-border tw-border-orange-400/25 tw-bg-orange-400/10 tw-px-3 tw-py-1 tw-text-xs tw-font-medium tw-text-orange-100">
                第 {currentIndex + 1} 题
              </span>
            </div>
            <h2 className="tw-mt-4 tw-text-2xl tw-font-semibold tw-text-white">
              {dimensionLabel[currentDimension]}
            </h2>
            <p className="tw-mt-3 tw-text-sm tw-leading-7 tw-text-slate-300">
              {dimensionLead[currentDimension]}
            </p>
            <div className="tw-mt-5 tw-space-y-3">
              {dimensionStats.map((item) => {
                const percent = item.total === 0 ? 0 : Math.round((item.completed / item.total) * 100);
                return (
                  <div
                    key={item.dimension}
                    className={`tw-rounded-2xl tw-border tw-p-3 tw-transition ${
                      item.active
                        ? "tw-border-cyan-300/30 tw-bg-cyan-300/10"
                        : "tw-border-white/8 tw-bg-white/5"
                    }`}
                  >
                    <div className="tw-flex tw-items-center tw-justify-between tw-gap-3">
                      <span className="tw-text-sm tw-font-medium tw-text-slate-100">
                        {dimensionLabel[item.dimension]}
                      </span>
                      <span className="tw-text-xs tw-text-slate-400">
                        {item.completed}/{item.total}
                      </span>
                    </div>
                    <div className="tw-mt-2 tw-h-1.5 tw-overflow-hidden tw-rounded-full tw-bg-white/10">
                      <div
                        className={`tw-h-full tw-rounded-full ${
                          item.active ? "tw-bg-cyan-300" : "tw-bg-white/35"
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="tw-rounded-[28px] tw-border tw-border-white/10 tw-bg-[linear-gradient(180deg,rgba(15,34,54,0.96),rgba(8,19,30,0.88))] tw-p-5 tw-shadow-[0_18px_48px_rgba(0,0,0,0.22)]">
            <div className="tw-flex tw-items-center tw-justify-between">
              <span className="tw-text-[11px] tw-uppercase tw-tracking-[0.24em] tw-text-cyan-200">快速定位</span>
              <span className="tw-text-xs tw-text-slate-400">可跳题，不会丢答案</span>
            </div>
            <div className="tw-mt-4 tw-grid tw-grid-cols-5 tw-gap-2">
              {questions.map((question, index) => {
                const active = index === currentIndex;
                const done = Boolean(answers[question.id]);
                return (
                  <button
                    key={question.id}
                    type="button"
                    onClick={() => setCurrentIndex(index)}
                    className={`tw-flex tw-h-11 tw-items-center tw-justify-center tw-rounded-2xl tw-border tw-text-sm tw-font-medium tw-transition ${
                      active
                        ? "tw-border-cyan-300 tw-bg-cyan-300/15 tw-text-cyan-100"
                        : done
                          ? "tw-border-emerald-300/30 tw-bg-emerald-300/10 tw-text-emerald-100"
                          : "tw-border-white/10 tw-bg-white/5 tw-text-slate-400 hover:tw-border-white/20 hover:tw-text-slate-200"
                    }`}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
          </article>
        </aside>

        <div className="tw-space-y-4">
          <article className="tw-rounded-[32px] tw-border tw-border-white/10 tw-bg-[linear-gradient(180deg,rgba(15,34,54,0.98),rgba(8,19,30,0.88))] tw-p-6 tw-shadow-[0_28px_80px_rgba(0,0,0,0.24)] md:tw-p-8">
            <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-3">
              <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-3">
                <span className="tw-inline-flex tw-items-center tw-rounded-full tw-border tw-border-white/10 tw-bg-white/5 tw-px-3 tw-py-1 tw-text-xs tw-uppercase tw-tracking-[0.22em] tw-text-slate-300">
                  {currentQuestion.id}
                </span>
                <span className="tw-inline-flex tw-items-center tw-rounded-full tw-border tw-border-orange-400/25 tw-bg-orange-400/10 tw-px-3 tw-py-1 tw-text-xs tw-font-medium tw-text-orange-100">
                  {dimensionLabel[currentDimension]}
                </span>
              </div>
              <p className="tw-text-sm tw-text-slate-400">
                {currentIndex + 1}/{questions.length}
              </p>
            </div>

            <div className="tw-mt-8 tw-space-y-8">
              <div className="tw-space-y-4">
                <p className="tw-text-sm tw-uppercase tw-tracking-[0.22em] tw-text-cyan-200">
                  观察点
                </p>
                <h3 className="tw-text-3xl tw-font-semibold tw-leading-tight tw-tracking-[-0.03em] tw-text-white md:tw-text-[2.2rem]">
                  {currentQuestion.prompt}
                </h3>
                <p className="tw-max-w-2xl tw-text-sm tw-leading-7 tw-text-slate-400">
                  选更像你在真实协作里的默认反应，不用追求“理想答案”。
                </p>
              </div>

              <div className="tw-grid tw-gap-4">
                {currentQuestion.options.map((option) => {
                  const active = currentAnswer === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => selectAnswer(currentQuestion.id, option.key)}
                      className={`tw-group tw-relative tw-overflow-hidden tw-rounded-[28px] tw-border tw-p-5 tw-text-left tw-transition ${
                        active
                          ? "tw-border-cyan-300 tw-bg-cyan-300/12 tw-shadow-[0_0_0_1px_rgba(103,232,249,0.18)]"
                          : "tw-border-white/10 tw-bg-white/[0.03] hover:tw-border-white/20 hover:tw-bg-white/[0.05]"
                      }`}
                    >
                      <div className="tw-flex tw-items-start tw-gap-4">
                        <span className={`tw-inline-flex tw-h-10 tw-w-10 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-2xl tw-border tw-text-sm tw-font-semibold ${
                          active
                            ? "tw-border-cyan-300 tw-bg-cyan-300/20 tw-text-cyan-100"
                            : "tw-border-white/10 tw-bg-white/5 tw-text-slate-300"
                        }`}>
                          {option.key}
                        </span>
                        <div className="tw-space-y-2">
                          <p className="tw-text-lg tw-leading-8 tw-text-slate-100">
                            {option.label}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </article>

          <article className="tw-rounded-[28px] tw-border tw-border-white/10 tw-bg-[linear-gradient(180deg,rgba(15,34,54,0.96),rgba(8,19,30,0.88))] tw-p-5 tw-shadow-[0_18px_48px_rgba(0,0,0,0.22)]">
            <div className="tw-flex tw-flex-col tw-gap-4 md:tw-flex-row md:tw-items-center md:tw-justify-between">
              <div className="tw-space-y-2">
                <p className="tw-text-[11px] tw-uppercase tw-tracking-[0.24em] tw-text-cyan-200">当前动作</p>
                <p className="tw-text-sm tw-leading-7 tw-text-slate-300">
                  {currentIndex === questions.length - 1
                    ? currentAnswer
                      ? "最后一题已经记住了。确认无误后就可以生成双核名片。"
                      : "最后一题选完之后，就可以直接提交生成双核名片。"
                    : "选中一个更像你的反应后，会自动进入下一题；你也可以随时回到任意题修改。"}
                </p>
                {error ? <p className="tw-text-sm tw-text-rose-300">{error}</p> : null}
              </div>
              <div className="tw-flex tw-flex-wrap tw-gap-3">
                <button
                  type="button"
                  className="tw-inline-flex tw-items-center tw-rounded-full tw-border tw-border-white/15 tw-bg-white/5 tw-px-5 tw-py-3 tw-text-sm tw-font-medium tw-text-slate-100 disabled:tw-cursor-not-allowed disabled:tw-opacity-40"
                  onClick={goPrevious}
                  disabled={currentIndex === 0 || pending}
                >
                  上一题
                </button>
                {currentIndex === questions.length - 1 ? (
                  <button
                    type="button"
                    className="tw-inline-flex tw-items-center tw-rounded-full tw-bg-gradient-to-r tw-from-orange-400 tw-to-amber-300 tw-px-5 tw-py-3 tw-text-sm tw-font-semibold tw-text-slate-950 disabled:tw-cursor-not-allowed disabled:tw-opacity-50"
                    onClick={goNext}
                    disabled={!currentAnswer || pending}
                  >
                    {pending
                      ? "正在生成双核名片..."
                      : ready
                        ? "提交并生成双核名片"
                        : "检查未答题"}
                  </button>
                ) : (
                  <div className="tw-inline-flex tw-items-center tw-rounded-full tw-border tw-border-cyan-300/20 tw-bg-cyan-300/10 tw-px-4 tw-py-3 tw-text-sm tw-text-cyan-100">
                    选择后自动下一题
                  </div>
                )}
                <button
                  type="button"
                  className="tw-inline-flex tw-items-center tw-rounded-full tw-border tw-border-white/15 tw-bg-white/5 tw-px-5 tw-py-3 tw-text-sm tw-font-medium tw-text-slate-100"
                  onClick={() => router.push(withDemoQuery("/match", currentUser.demoMode))}
                >
                  先看看协作匹配
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
