import Link from "next/link";

import type { StaffTicket } from "../types";

function statusClass(status: StaffTicket["status"]) {
  if (status === "Needs your reply") return "action";
  if (status === "In progress") return "progress";
  return "waiting";
}

export function StaffTicketList({
  tickets,
  compact = false,
}: {
  tickets: StaffTicket[];
  compact?: boolean;
}) {
  return (
    <div className={`ticket-list ${compact ? "compact-list" : "detailed-list"}`}>
      {tickets.map((ticket) => (
        <Link
          className="ticket-row"
          href={`/technician?ticket=${ticket.id}`}
          key={ticket.id}
          aria-label={`${ticket.id}: ${ticket.title}, ${ticket.status}`}
        >
          {compact ? (
            <span
              className={`priority-marker priority-${ticket.priority}`}
              aria-label={`${ticket.priority} priority`}
            />
          ) : (
            <span className="ticket-date">
              <strong>{ticket.day}</strong>
              <small>{ticket.month}</small>
            </span>
          )}
          <span className="ticket-main">
            {!compact ? (
              <span className="ticket-kicker">
                {ticket.id} · {ticket.type}
              </span>
            ) : null}
            <strong>{ticket.title}</strong>
            <small>
              {compact ? `${ticket.id} · ` : ""}
              {ticket.location} · Updated {ticket.updated}
            </small>
          </span>
          <span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span>
          <span className="row-arrow" aria-hidden="true">
            →
          </span>
        </Link>
      ))}
    </div>
  );
}
