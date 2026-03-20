import { isDemoRequested, resolveCurrentUserContext } from "../../lib/current-user";
import { loadQuestions } from "../../lib/loaders";
import { AppLink } from "../_components/app-link";
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
        <section className="hero-panel tw-overflow-hidden tw-bg-[radial-gradient(circle_at_top_right,rgba(101,210,255,0.16),transparent_28%),linear-gradient(180deg,rgba(15,34,54,0.97),rgba(8,19,30,0.92))]">
          <span className="eyebrow">W-MBTI 测评</span>
          <h1 className="hero-title tw-max-w-4xl">先确认你此刻认可的身份进入这里。</h1>
          <p className="lead tw-max-w-2xl">
            后面的测评、沙盘和说明，都会跟着这个版本的你继续。
          </p>
          <div className="action-row section">
            <AppLink href="/api/auth/login?next=/assessment" className="cta-link">
              连接 Second Me
            </AppLink>
          </div>
        </section>
      </main>
    );
  }

  const questions = await loadQuestions();
  return <AssessmentFlow currentUser={currentUser} questions={questions} />;
}
