import Link from "next/link";
import { notFound } from "next/navigation";

import { isDemoRequested, resolveCurrentUserContext } from "../../../lib/current-user";
import { getReconnectPayload, getSessionParticipants } from "../../../lib/workflow";
import { ReconnectConsole } from "./reconnect-console";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ReconnectPage({ params, searchParams }: PageProps) {
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
          <span className="eyebrow">Reconnect</span>
          <h1 className="hero-title">这份协作说明书绑定在具体会话里。</h1>
          <p className="lead">先恢复你的当前身份，再确认是否要从虚拟走向现实组队。</p>
          <div className="action-row section">
            <Link href={`/api/auth/login?next=/reconnect/${sessionId}`} className="cta-link">
              连接 Second Me
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const payload = await getReconnectPayload(sessionId, currentUser.userId).catch(() => null);

  if (!payload) {
    notFound();
  }

  const participants = await getSessionParticipants(sessionId).catch(() => null);
  if (!participants) {
    notFound();
  }

  const requestedActor =
    currentUser.demoMode && typeof query.actor === "string" ? query.actor : currentUser.userId;
  const actorUserId =
    requestedActor === participants.userId || requestedActor === participants.targetUserId
      ? requestedActor
      : currentUser.userId;

  const { manual, cards } = payload;
  return (
    <ReconnectConsole
      currentUser={currentUser}
      actorUserId={actorUserId}
      allowActorSwitch={currentUser.demoMode}
      participants={participants}
      decisions={payload.decisions}
      sessionId={sessionId}
      initialState={payload.state}
      session={payload.session}
      manual={manual}
      initialCards={cards}
    />
  );
}
