"use client";

import { useState } from "react";

import { technicianTickets } from "../mock-data";

const metrics = [
  { label: "At risk", value: "4", detail: "2 due within 30 minutes", urgent: true },
  { label: "Unassigned", value: "8", detail: "Oldest waiting 42 minutes", urgent: false },
  { label: "My active work", value: "6", detail: "3 awaiting an update", urgent: false },
  { label: "Resolved today", value: "14", detail: "92% within target", urgent: false },
] as const;

export function TechnicianWorkspace() {
  const [selectedKey, setSelectedKey] = useState("pos");
  const selected =
    technicianTickets.find((ticket) => ticket.key === selectedKey) ?? technicianTickets[0];

  return (
    <section className="view view-visible technician-view" aria-labelledby="technician-title">
      <header className="page-header technician-header">
        <div>
          <p className="overline">Technician workspace</p>
          <h1 id="technician-title">Service overview</h1>
          <p className="lead">Focus on what needs attention now.</p>
        </div>
        <div className="tech-actions">
          <button className="icon-button surface" type="button" aria-label="Search">
            ⌕
          </button>
          <button className="secondary-button" type="button">
            Queue settings
          </button>
        </div>
      </header>

      <div className="metric-grid" aria-label="Service metrics">
        {metrics.map((metric) => (
          <article className={`metric-card${metric.urgent ? " urgent" : ""}`} key={metric.label}>
            <p>{metric.label}</p>
            <strong>{metric.value}</strong>
            <span>{metric.detail}</span>
          </article>
        ))}
      </div>

      <div className="workspace-grid">
        <section className="queue-panel" aria-labelledby="priority-queue-title">
          <div className="section-heading queue-heading">
            <div>
              <p className="overline">Priority queue</p>
              <h2 id="priority-queue-title">Needs attention</h2>
            </div>
            <button className="text-button" type="button">
              Open full queue <span aria-hidden="true">→</span>
            </button>
          </div>
          <div className="queue-table" role="table" aria-label="Priority tickets">
            <div className="queue-table-head" role="row">
              <span role="columnheader">Ticket</span>
              <span role="columnheader">Context</span>
              <span role="columnheader">Owner</span>
              <span role="columnheader">SLA</span>
            </div>
            {technicianTickets.map((ticket) => (
              <button
                className={`queue-item${selected.key === ticket.key ? " selected" : ""}`}
                type="button"
                role="row"
                aria-pressed={selected.key === ticket.key}
                key={ticket.key}
                onClick={() => setSelectedKey(ticket.key)}
              >
                <span role="cell">
                  <b className={`priority-code ${ticket.priority.toLowerCase()}`}>
                    {ticket.priority}
                  </b>
                  <strong>{ticket.title}</strong>
                  <small>
                    {ticket.id} · {ticket.age}
                  </small>
                </span>
                <span role="cell">
                  <strong>{ticket.location}</strong>
                  <small>{ticket.impact}</small>
                </span>
                <span role="cell">
                  <span className={`mini-avatar${ticket.owner === "Unassigned" ? " neutral" : ""}`}>
                    {ticket.ownerInitials}
                  </span>
                  {ticket.owner}
                </span>
                <span className={`sla ${ticket.slaState}`} role="cell">
                  {ticket.sla}
                </span>
              </button>
            ))}
          </div>
        </section>

        <aside className="context-panel" aria-label="Selected ticket context" aria-live="polite">
          <div className="context-top">
            <span className={`priority-code ${selected.priority.toLowerCase()}`}>
              {selected.priority} incident
            </span>
            <button className="icon-button" type="button" aria-label="More ticket actions">
              •••
            </button>
          </div>
          <h2>{selected.title}</h2>
          <p className="context-id">
            {selected.id} · {selected.location}
          </p>
          <div className="context-status">
            <span className="pulse-dot" aria-hidden="true" />
            <div>
              <strong>Active guest impact</strong>
              <small>{selected.affected}</small>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Requester</dt>
              <dd>{selected.requester}</dd>
            </div>
            <div>
              <dt>Assigned to</dt>
              <dd>{selected.owner}</dd>
            </div>
            <div>
              <dt>Response due</dt>
              <dd className={selected.slaState === "danger" ? "danger-text" : ""}>
                {selected.sla}
              </dd>
            </div>
            <div>
              <dt>Last update</dt>
              <dd>{selected.lastUpdate}</dd>
            </div>
          </dl>
          <div className="device-card">
            <div className="device-heading">
              <span>
                <small>LEVEL.IO DEVICE</small>
                <strong>{selected.device}</strong>
              </span>
              <span className="online-badge">Online</span>
            </div>
            <div className="device-stats">
              <span>
                <small>Agent</small>
                <strong>Healthy</strong>
              </span>
              <span>
                <small>Last seen</small>
                <strong>Now</strong>
              </span>
              <span>
                <small>Alerts</small>
                <strong className="danger-text">{selected.alerts}</strong>
              </span>
            </div>
            <button className="secondary-button full-width" type="button">
              Open in Level.io <span aria-hidden="true">↗</span>
            </button>
          </div>
          <div className="context-actions">
            <button className="primary-button full-width" type="button">
              Open ticket
            </button>
            <button className="secondary-button full-width" type="button">
              Add internal note
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
