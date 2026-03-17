import Link from "next/link";
import { notFound } from "next/navigation";

import { isDemoRequested, resolveCurrentUserContext } from "../../../lib/current-user";
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
          <h1 className="hero-title">这个沙盘会话属于某个具体用户。</h1>
          <p className="lead">先恢复你的当前身份，再继续这场 Agent 交锋。</p>
          <div className="action-row section">
            <Link href={`/api/auth/login?next=/arena/${sessionId}`} className="cta-link">
              连接 Second Me
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const session = await getSessionById(sessionId, currentUser.userId).catch(() => null);

  if (!session) {
    notFound();
  }

  return <ArenaConsole currentUser={currentUser} initialSession={session} />;
}
