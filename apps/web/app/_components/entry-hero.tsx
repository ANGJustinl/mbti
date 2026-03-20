import type { ReactNode } from "react";

import type { EntryMetric } from "../../lib/entry-view";
import { AppLink } from "./app-link";

interface ActionLink {
  href: string;
  label: string;
  tone?: "primary" | "secondary";
}

interface EntryHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  statusLine?: string;
  metrics: EntryMetric[];
  actions: ActionLink[];
  children?: ReactNode;
}

export function EntryHero({ eyebrow, title, description, statusLine, metrics, actions, children }: EntryHeroProps) {
  return (
    <article className="hero-panel entry-hero-panel">
      <div className="signal-strip">
        <span className="eyebrow">{eyebrow}</span>
        {statusLine ? <span className="signal-label">{statusLine}</span> : null}
      </div>
      <h1 className="hero-title">{title}</h1>
      <p className="lead">{description}</p>
      <div className="action-row section">
        {actions.map((action) => (
          <AppLink
            key={`${action.href}-${action.label}`}
            href={action.href}
            className={action.tone === "secondary" ? "ghost-link" : "cta-link"}
          >
            {action.label}
          </AppLink>
        ))}
      </div>
      {children ? <div className="entry-inline-note section">{children}</div> : null}
      <div className="detail-grid section">
        {metrics.map((metric) => (
          <div key={metric.label} className="metric-card entry-metric-card">
            <span className="eyebrow">{metric.label}</span>
            <strong className="stat-number">{metric.value}</strong>
            <span className="stat-label">{metric.detail}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
