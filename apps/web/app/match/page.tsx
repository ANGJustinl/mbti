import Link from "next/link";

import { isDemoRequested, resolveCurrentUserContext } from "../../lib/current-user";
import { getDemoIntent, getTopTopics } from "../../lib/demo";
import { getProfileByUserId, listCandidateCards } from "../../lib/workflow";
import { MatchLauncher } from "./match-launcher";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MatchPage({ searchParams }: PageProps) {
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
          <span className="eyebrow">匹配主链路</span>
          <h1 className="hero-title">先连接当前身份，再发起第一场 Agent 双盲沙盘。</h1>
          <p className="lead">匹配会话会绑定到当前用户，你可以之后从“我的流程”继续推进。</p>
          <div className="action-row section">
            <Link href="/api/auth/login?next=/match" className="cta-link">
              连接 Second Me
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const [intent, profile, candidates, topics] = await Promise.all([
    Promise.resolve(getDemoIntent()),
    getProfileByUserId(currentUser.userId),
    listCandidateCards(),
    getTopTopics(),
  ]);

  if (!profile) {
    return (
      <main className="stack">
        <section className="hero-panel">
          <span className="eyebrow">匹配主链路</span>
          <h1 className="hero-title">先完成测评，系统才能知道你适合和谁一起成事。</h1>
          <p className="lead">当前身份已建立，但还没有双核画像。先补测评，再进入沙盘。</p>
          <div className="action-row section">
            <Link href={currentUser.demoMode ? "/assessment?demo=1" : "/assessment"} className="cta-link">
              去做 W-MBTI 测评
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <MatchLauncher
      currentUser={currentUser}
      profile={profile}
      intent={intent}
      candidates={candidates}
      topics={topics}
    />
  );
}
