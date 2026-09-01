import Link from "next/link";

const actions = [
  {
    index: "01",
    title: "Something is not working",
    copy: "Tell us what happened and where. Most requests take less than two minutes.",
    label: "Start a ticket",
    href: "/new-ticket",
    featured: true,
  },
  {
    index: "02",
    title: "Check an existing request",
    copy: "See progress, reply to IT, or confirm that an issue has been fixed.",
    label: "View my tickets",
    href: "/my-tickets",
    featured: false,
  },
] as const;

export function StaffOverview() {
  return (
    <section className="view" aria-labelledby="home-title">
      <header className="page-header hero-header">
        <div>
          <p className="overline">Staff overview</p>
          <h1 id="home-title">How can IT help keep your day moving?</h1>
          <p className="lead">Report an issue or review your service-desk workspace.</p>
        </div>
        <Link className="primary-button" href="/new-ticket">
          <span aria-hidden="true">＋</span>Report an issue
        </Link>
      </header>

      <div className="action-grid" aria-label="Common actions">
        {actions.map((action) => (
          <Link
            className={`action-card${action.featured ? " featured" : ""}`}
            href={action.href}
            key={action.index}
          >
            <span className="action-index">{action.index}</span>
            <span className="action-title">{action.title}</span>
            <span className="action-copy">{action.copy}</span>
            <span className="action-link">
              {action.label}
              <b aria-hidden="true">→</b>
            </span>
          </Link>
        ))}
        <button className="action-card" type="button" disabled>
          <span className="action-index">03</span>
          <span className="action-title">Find a quick answer</span>
          <span className="action-copy">
            Browse short guides for passwords, Wi-Fi, printers, and everyday tools.
          </span>
          <span className="action-link">Help guides not connected</span>
        </button>
      </div>

      <section className="content-section" aria-labelledby="active-requests-title">
        <div className="section-heading">
          <div>
            <p className="overline">Your work</p>
            <h2 id="active-requests-title">Active requests</h2>
          </div>
          <Link className="text-button" href="/my-tickets">
            View all <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="empty-state">
          <strong>No ticket data available</strong>
          <p>Your active requests will appear here after secure ticket persistence is connected.</p>
        </div>
      </section>

      <aside className="support-note">
        <div className="support-monogram" aria-hidden="true">
          24
        </div>
        <div>
          <strong>Urgent guest-impacting issue?</strong>
          <p>Use your approved urgent-support channel after preparing a ticket.</p>
        </div>
      </aside>
    </section>
  );
}
