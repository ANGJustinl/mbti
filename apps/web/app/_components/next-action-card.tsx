import Link from "next/link";

import type { EntryAction } from "../../lib/entry-view";

interface NextActionCardProps {
  action: EntryAction;
}

export function NextActionCard({ action }: NextActionCardProps) {
  return (
    <aside className="panel next-action-card">
      <div className="pair-line">
        <span className="eyebrow">{action.eyebrow}</span>
        {action.badge ? <span className="status-chip">{action.badge}</span> : null}
      </div>
      <h2>{action.title}</h2>
      <p className="lead">{action.description}</p>
      {action.note ? <p className="action-note">{action.note}</p> : null}
      <div className="action-row section">
        <Link href={action.primaryHref} className="cta-link">
          {action.primaryLabel}
        </Link>
        {action.secondaryHref && action.secondaryLabel ? (
          <Link href={action.secondaryHref} className="ghost-link">
            {action.secondaryLabel}
          </Link>
        ) : null}
      </div>
    </aside>
  );
}
