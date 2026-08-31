import Link from "next/link";

type PageHeaderProps = {
  title: string;
  titleId: string;
  eyebrow: string;
  lead: string;
  className?: string;
  actionHref?: string;
  actionLabel?: string;
  backHref?: string;
  backLabel?: string;
};

export function PageHeader({
  title,
  titleId,
  eyebrow,
  lead,
  className = "",
  actionHref,
  actionLabel,
  backHref,
  backLabel,
}: PageHeaderProps) {
  return (
    <header className={`page-header ${className}`.trim()}>
      <div>
        {backHref && backLabel ? (
          <Link className="back-link" href={backHref}>
            <span aria-hidden="true">←</span>
            {backLabel}
          </Link>
        ) : null}
        <p className="overline">{eyebrow}</p>
        <h1 id={titleId}>{title}</h1>
        <p className="lead">{lead}</p>
      </div>
      {actionHref && actionLabel ? (
        <Link className="primary-button" href={actionHref}>
          <span aria-hidden="true">＋</span>
          {actionLabel}
        </Link>
      ) : null}
    </header>
  );
}
