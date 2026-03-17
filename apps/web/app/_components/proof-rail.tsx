import type { ReactNode } from "react";

interface ProofRailProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

export function ProofRail({ eyebrow, title, description, children }: ProofRailProps) {
  return (
    <article className="panel proof-rail">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p className="lead proof-copy">{description}</p>
      <div className="stack section">{children}</div>
    </article>
  );
}
