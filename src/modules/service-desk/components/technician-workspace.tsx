"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import type { TechnicianTicket } from "../types";

const emptyMetrics = [
  { label: "At risk", value: "—", detail: "Ticket data not connected" },
  { label: "Unassigned", value: "—", detail: "Ticket data not connected" },
  { label: "My active work", value: "—", detail: "Ticket data not connected" },
  { label: "Resolved today", value: "—", detail: "Ticket data not connected" },
] as const;

export function TechnicianWorkspaceFromQuery({ tickets = [] }: { tickets?: TechnicianTicket[] }) {
  const ticketId = useSearchParams().get("ticket") ?? undefined;
  return <TechnicianWorkspace initialTicketId={ticketId} tickets={tickets} />;
}

export function TechnicianWorkspace({
  initialTicketId,
  tickets = [],
}: {
  initialTicketId?: string;
  tickets?: TechnicianTicket[];
}) {
  const initialKey =
    tickets.find((ticket) => ticket.id === initialTicketId)?.key ?? tickets[0]?.key;
  const [selectedKey, setSelectedKey] = useState(initialKey);
  const selected = tickets.find((ticket) => ticket.key === selectedKey) ?? tickets[0];

  return (
    <section className="view technician-view" aria-labelledby="technician-title">
      <header className="page-header technician-header">
        <div>
          <p className="overline">Technician workspace</p>
          <h1 id="technician-title">Service overview</h1>
          <p className="lead">Live service data is not connected yet.</p>
        </div>
        <div className="tech-actions">
          <button className="icon-button surface" type="button" aria-label="Search" disabled>
            ⌕
          </button>
          <button className="secondary-button" type="button" disabled>
            Queue settings
          </button>
        </div>
      </header>

      <div className="metric-grid" aria-label="Service metrics">
        {emptyMetrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
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
            <button className="text-button" type="button" disabled>
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
            {tickets.length ? (
              tickets.map((ticket) => (
                <button
                  className={`queue-item${selected?.key === ticket.key ? " selected" : ""}`}
                  type="button"
                  role="row"
                  aria-pressed={selected?.key === ticket.key}
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
                    <span
                      className={`mini-avatar${ticket.owner === "Unassigned" ? " neutral" : ""}`}
                    >
                      {ticket.ownerInitials}
                    </span>
                    {ticket.owner}
                  </span>
                  <span className={`sla ${ticket.slaState}`} role="cell">
                    {ticket.sla}
                  </span>
                </button>
              ))
            ) : (
              <div className="empty-state queue-empty-state">
                <strong>No tickets in the queue</strong>
                <p>Priority work will appear after authenticated ticket access is connected.</p>
              </div>
            )}
          </div>
        </section>

        <aside className="context-panel" aria-label="Selected ticket context" aria-live="polite">
          {selected ? (
            <>
              <div className="context-top">
                <span className={`priority-code ${selected.priority.toLowerCase()}`}>
                  {selected.priority} incident
                </span>
              </div>
              <h2>{selected.title}</h2>
              <p className="context-id">
                {selected.id} · {selected.location}
              </p>
              <div className="context-status">
                <span className="pulse-dot" aria-hidden="true" />
                <div>
                  <strong>Active impact</strong>
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
                  <span className="online-badge">Status unavailable</span>
                </div>
                <button className="secondary-button full-width" type="button" disabled>
                  Level.io not connected
                </button>
              </div>
            </>
          ) : (
            <div className="empty-context">
              <p className="overline">Ticket context</p>
              <h2>No ticket selected</h2>
              <p>Ticket and device details will appear here when live services are connected.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
