import { notFound } from "next/navigation";

import { isDemoRequested, resolveCurrentUserContext } from "../../../lib/current-user";
import { getCardByUserId, listCandidateCards } from "../../../lib/workflow";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ userId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CardPage({ params, searchParams }: PageProps) {
  const { userId } = await params;
  const query = await searchParams;
  const currentUser = await resolveCurrentUserContext({
    allowDemoFallback: true,
    demoRequested: isDemoRequested(
      typeof query.demo === "string" ? query.demo : Array.isArray(query.demo) ? query.demo[0] : undefined,
    ),
  });
  const candidates = await listCandidateCards();
  const isKnown =
    candidates.some((item) => item.profile.userId === userId) ||
    currentUser?.userId === userId;

  if (!isKnown) {
    notFound();
  }

  const card = await getCardByUserId(userId);
  if (!card) {
    notFound();
  }
  const axes = card.profile.wmti.axes;

  return (
    <main className="stack">
      <section className="split-grid">
        <article className="hero-panel">
          <span className="eyebrow">双核名片</span>
          <h1 className="hero-title">{card.summary}</h1>
          <p className="lead">{card.tagline}</p>
          <div className="pill-row section">
            <span className="chip">{card.profile.wmti.letters}</span>
            <span className="chip">{card.profile.roleTag}</span>
          </div>
        </article>

        <aside className="panel">
          <span className="eyebrow">四维画像</span>
          <div className="detail-grid section">
            {axes.map((axis) => (
              <article key={axis.dimension} className="metric-card">
                <strong className="stat-number">{axis.dominantCode}</strong>
                <span className="stat-label">
                  {axis.dimension} / 置信度 {(axis.confidence * 100).toFixed(0)}%
                </span>
              </article>
            ))}
          </div>
        </aside>
      </section>

      <section className="detail-grid section">
        <article className="manual-card">
          <span className="eyebrow">优势</span>
          <ul className="list">
            {card.profile.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="manual-card">
          <span className="eyebrow">风险</span>
          <ul className="list">
            {card.profile.risks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="manual-card">
          <span className="eyebrow">协作建议</span>
          <ul className="list">
            {card.actionHints.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
