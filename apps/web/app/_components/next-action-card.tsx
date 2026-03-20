import type { EntryAction } from "../../lib/entry-view";
import { AppLink } from "./app-link";

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
        <AppLink href={action.primaryHref} className="cta-link">
          {action.primaryLabel}
        </AppLink>
        {action.secondaryHref && action.secondaryLabel ? (
          <AppLink href={action.secondaryHref} className="ghost-link">
            {action.secondaryLabel}
          </AppLink>
        ) : null}
      </div>
    </aside>
  );
}
