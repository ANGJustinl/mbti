import Link from "next/link";

import { isDemoRequested, resolveCurrentUserContext } from "../../lib/current-user";
import { loadQuestions } from "../../lib/loaders";
import { AssessmentFlow } from "./assessment-flow";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AssessmentPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const currentUser = await resolveCurrentUserContext({
    allowDemoFallback: true,
    demoRequested: isDemoRequested(
      typeof query.demo === "string" ? query.demo : Array.isArray(query.demo) ? query.demo[0] : undefined,
    ),
  });

  if (!currentUser) {
    return (
      <main className="stack">
        <section className="hero-panel">
          <span className="eyebrow">W-MBTI 测评</span>
          <h1 className="hero-title">先绑定一个当前身份，再把你的工作方式讲清楚。</h1>
          <p className="lead">
            测评结果会直接写入当前用户画像，并成为后续匹配与沙盘的唯一前置条件。
          </p>
          <div className="action-row section">
            <Link href="/api/auth/login?next=/assessment" className="cta-link">
              连接 Second Me
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const questions = await loadQuestions();
  return <AssessmentFlow currentUser={currentUser} questions={questions} />;
}
