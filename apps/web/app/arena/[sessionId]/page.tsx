import { notFound } from "next/navigation";

import { isDemoRequested, resolveCurrentUserContext } from "../../../lib/current-user";
import { recordAnalyticsEvent } from "../../../lib/analytics";
import { AppLink } from "../../_components/app-link";
import { getSessionById } from "../../../lib/workflow";
import { ArenaConsole } from "./arena-console";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ArenaPage({ params, searchParams }: PageProps) {
  const { sessionId } = await params;
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
          <span className="eyebrow">A2A 赛博沙盘</span>
          <h1 className="hero-title">先确认你此刻认可的身份进入这里。</h1>
          <p className="lead">后面的沙盘和说明，都会跟着这个版本的你继续。</p>
          <div className="action-row section">
            <AppLink href={`/api/auth/login?next=/arena/${sessionId}`} className="cta-link">
              连接 Second Me
            </AppLink>
          </div>
        </section>
      </main>
    );
  }

  const session = await getSessionById(sessionId, currentUser.userId).catch(() => null);

  if (!session) {
    notFound();
  }

  if (!currentUser.demoMode) {
    await recordAnalyticsEvent({
      name: "arena_view",
      actorUserId: currentUser.userId,
      sessionId,
      sourcePage: "/arena",
      meta: {
        source: session.source,
        state: session.state,
      },
    }).catch(() => null);
  }

  return <ArenaConsole currentUser={currentUser} initialSession={session} />;
}
