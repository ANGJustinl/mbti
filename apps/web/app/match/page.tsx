import { isDemoRequested, resolveCurrentUserContext } from "../../lib/current-user";
import { getDemoIntent, getTopTopics } from "../../lib/demo";
import { AppLink } from "../_components/app-link";
import { getPlazaListing, getProfileByUserId, listCandidateCards, listPlazaFeed } from "../../lib/workflow";
import { MatchLauncher } from "./match-launcher";
import { PlazaLauncher } from "./plaza-launcher";

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
          <span className="eyebrow">协作匹配</span>
          <h1 className="hero-title">先确认你此刻认可的身份进入这里。</h1>
          <p className="lead">后面的匹配、沙盘和说明，都会跟着这个版本的你继续。</p>
          <div className="action-row section">
            <AppLink href="/api/auth/login?next=/match" className="cta-link">
              连接 Second Me
            </AppLink>
          </div>
        </section>
      </main>
    );
  }

  const profile = await getProfileByUserId(currentUser.userId);

  if (!profile) {
    return (
      <main className="stack">
        <section className="hero-panel">
          <span className="eyebrow">协作匹配</span>
          <h1 className="hero-title">这不是为了定义你，只是为了看看你如何工作。</h1>
          <p className="lead">你的工作方式会被轻轻放进当前身份里，成为后续判断的起点。之后的匹配与推演，都会从这里开始。</p>
          <div className="action-row section">
            <AppLink href={currentUser.demoMode ? "/assessment?demo=1" : "/assessment"} className="cta-link">
              先完成 W-MBTI 测评
            </AppLink>
          </div>
        </section>
      </main>
    );
  }

  if (!currentUser.demoMode) {
    const [listing, feed] = await Promise.all([
      getPlazaListing(currentUser.userId),
      listPlazaFeed(currentUser.userId),
    ]);

    return (
      <PlazaLauncher
        currentUser={currentUser}
        profile={profile}
        initialListing={listing}
        initialFeed={feed}
      />
    );
  }

  const [intent, candidates, topics] = await Promise.all([
    Promise.resolve(getDemoIntent()),
    listCandidateCards(),
    getTopTopics(),
  ]);

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
