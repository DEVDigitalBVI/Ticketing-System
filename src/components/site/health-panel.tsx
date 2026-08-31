import { Check, ShieldCheck, Waves } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";

const checks = [
  { label: "Application shell", detail: "Responding", icon: Check },
  { label: "Runtime boundary", detail: "Ready", icon: ShieldCheck },
] as const;

type HealthPanelProps = {
  headingLevel?: 1 | 2;
  titleId: string;
};

export function HealthPanel({ headingLevel = 2, titleId }: HealthPanelProps) {
  const title = "All calm on the digital shoreline.";

  return (
    <article className="health-card" aria-labelledby={titleId}>
      <div className="health-card__topline">
        <span>Peter Island Resort and Spa</span>
        <StatusBadge>
          <span className="status-pulse" aria-hidden="true" />
          Operational
        </StatusBadge>
      </div>

      <div className="health-card__hero">
        <div>
          <p className="eyebrow">System check</p>
          {headingLevel === 1 ? <h1 id={titleId}>{title}</h1> : <h2 id={titleId}>{title}</h2>}
        </div>
        <Waves className="health-mark" aria-hidden="true" strokeWidth={1.25} />
      </div>

      <div className="health-grid" aria-label="Application checks">
        {checks.map(({ label, detail, icon: Icon }) => (
          <div className="health-check" key={label}>
            <span className="health-check__icon">
              <Icon aria-hidden="true" />
            </span>
            <span>
              <strong>{label}</strong>
              <small>{detail}</small>
            </span>
          </div>
        ))}
      </div>

      <p className="health-note">
        This page verifies the web application only. External services are intentionally not queried
        in this foundation release.
      </p>
    </article>
  );
}
