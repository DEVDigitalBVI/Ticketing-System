import Link from "next/link";

import { staffTickets } from "../mock-data";
import { StaffTicketList } from "./staff-ticket-list";

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
    <section className="view view-visible" aria-labelledby="home-title">
      <header className="page-header hero-header">
        <div>
          <p className="overline">Sunday, 30 August</p>
          <h1 id="home-title">Good afternoon, Alex.</h1>
          <p className="lead">How can IT help keep your day moving?</p>
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
        <button className="action-card" type="button">
          <span className="action-index">03</span>
          <span className="action-title">Find a quick answer</span>
          <span className="action-copy">
            Browse short guides for passwords, Wi-Fi, printers, and everyday tools.
          </span>
          <span className="action-link">
            Search help <b aria-hidden="true">→</b>
          </span>
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
        <StaffTicketList compact tickets={staffTickets.slice(0, 2)} />
      </section>

      <aside className="support-note">
        <div className="support-monogram" aria-hidden="true">
          24
        </div>
        <div>
          <strong>Urgent guest-impacting issue?</strong>
          <p>Call the IT duty line at extension 2400 after submitting a ticket.</p>
        </div>
      </aside>
    </section>
  );
}
