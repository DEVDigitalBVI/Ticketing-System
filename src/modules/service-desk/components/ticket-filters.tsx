import Link from "next/link";

import type {
  RequesterTicketWorkspace,
  StaffTicketDetail,
  StaffTicketFilter,
} from "@/server/tickets/requester-portal";

import { StaffTicketList } from "./staff-ticket-list";

type SearchState = {
  status?: string;
};

function searchStatusMessage(search: SearchState) {
  switch (search.status) {
    case "commented":
      return { tone: "success" as const, text: "Your reply was added to the ticket." };
    case "confirmed":
      return {
        tone: "success" as const,
        text: "You confirmed the resolution. The ticket is now complete.",
      };
    case "failed":
      return {
        tone: "error" as const,
        text: "We could not update that ticket. Please try again.",
      };
    default:
      return null;
  }
}

function paramsFor(
  filter: StaffTicketFilter,
  query: string,
  page: number,
  ticketId?: string,
  status?: string,
) {
  const params = new URLSearchParams();
  if (filter !== "active") params.set("filter", filter);
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  if (ticketId) params.set("ticket", ticketId);
  if (status) params.set("status", status);
  return params.toString();
}

function tabHref(filter: StaffTicketFilter, query: string) {
  const params = paramsFor(filter, query, 1);
  return params ? `/my-tickets?${params}` : "/my-tickets";
}

function pageHref(filter: StaffTicketFilter, query: string, page: number, ticketId?: string) {
  const params = paramsFor(filter, query, page, ticketId);
  return params ? `/my-tickets?${params}` : "/my-tickets";
}

function ticketHref(filter: StaffTicketFilter, query: string, page: number, ticketId: string) {
  const params = paramsFor(filter, query, page, ticketId);
  return `/my-tickets?${params}`;
}

function DetailPanel({
  ticket,
  filter,
  query,
  page,
  search,
}: {
  ticket: StaffTicketDetail | null;
  filter: StaffTicketFilter;
  query: string;
  page: number;
  search: SearchState;
}) {
  const status = searchStatusMessage(search);

  if (!ticket) {
    return (
      <aside className="context-panel" aria-label="Selected ticket context" aria-live="polite">
        <h2>Ticket details</h2>
        <div className="empty-state queue-empty-state">
          <strong>Select a ticket</strong>
          <p>Choose one of your tickets to review updates, reply, or confirm the resolution.</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="context-panel" aria-label="Selected ticket context" aria-live="polite">
      <h2>{ticket.ticketNumber}</h2>
      {status ? (
        <p className={status.tone === "success" ? "form-success" : "form-error"}>{status.text}</p>
      ) : null}
      <div className="context-status">
        <span
          className={`status-pill ${ticket.staffStatus === "Needs your reply" ? "action" : ticket.staffStatus === "Completed" ? "waiting" : "progress"}`}
        >
          {ticket.staffStatus}
        </span>
        <small>Internal status: {ticket.canonicalStatus.replaceAll("_", " ")}</small>
      </div>
      <p>{ticket.title}</p>
      <dl className="detail-list">
        <div>
          <dt>Property</dt>
          <dd>{ticket.property}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{ticket.location}</dd>
        </div>
        <div>
          <dt>Department</dt>
          <dd>{ticket.department}</dd>
        </div>
        <div>
          <dt>Category</dt>
          <dd>
            {ticket.category}
            {ticket.subcategory ? ` · ${ticket.subcategory}` : ""}
          </dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd>
            {ticket.priority} · {ticket.impact} impact · {ticket.urgency} urgency
          </dd>
        </div>
      </dl>
      <div className="ticket-thread">
        <h3>Updates</h3>
        <ol className="thread-list">
          {ticket.thread.map((entry) => (
            <li key={entry.id} className="thread-entry">
              <strong>{entry.title}</strong>
              <small>{entry.timestamp}</small>
              {entry.body ? <p>{entry.body}</p> : null}
            </li>
          ))}
        </ol>
      </div>
      {ticket.resolutionSummary ? (
        <div className="privacy-note">
          <strong>Resolution summary</strong>
          <p>{ticket.resolutionSummary}</p>
          {ticket.closureDetails ? <p>{ticket.closureDetails}</p> : null}
        </div>
      ) : null}
      <form className="ticket-inline-form" action="/auth/my-ticket" method="post">
        <input type="hidden" name="intent" value="comment" />
        <input type="hidden" name="ticketId" value={ticket.ticketId} />
        <input type="hidden" name="filter" value={filter} />
        <input type="hidden" name="q" value={query} />
        <input type="hidden" name="page" value={String(page)} />
        <label className="field-label" htmlFor="staff-reply">
          Reply to IT
        </label>
        <textarea
          id="staff-reply"
          name="body"
          rows={4}
          maxLength={4000}
          placeholder="Add any details IT needs from you."
          required
        />
        <button className="primary-button" type="submit">
          Send reply
        </button>
      </form>
      {ticket.canConfirmResolution ? (
        <form className="ticket-inline-form secondary-form" action="/auth/my-ticket" method="post">
          <input type="hidden" name="intent" value="confirm" />
          <input type="hidden" name="ticketId" value={ticket.ticketId} />
          <input type="hidden" name="filter" value={filter} />
          <input type="hidden" name="q" value={query} />
          <input type="hidden" name="page" value={String(page)} />
          <button className="secondary-button" type="submit">
            Confirm the fix
          </button>
        </form>
      ) : null}
    </aside>
  );
}

export function TicketFilters({
  workspace,
  search,
}: {
  workspace: RequesterTicketWorkspace;
  search: SearchState;
}) {
  return (
    <div className="workspace-grid">
      <div>
        <div className="filter-bar">
          <div className="tab-list" role="tablist" aria-label="Ticket filters">
            {(
              [
                ["active", "Active", workspace.counts.active],
                ["completed", "Completed", workspace.counts.completed],
                ["all", "All", workspace.counts.all],
              ] as const
            ).map(([value, label, count]) => (
              <Link
                className={`tab${workspace.filter === value ? " is-active" : ""}`}
                href={tabHref(value, workspace.query)}
                role="tab"
                aria-selected={workspace.filter === value}
                key={value}
              >
                {label}
                <span>{count}</span>
              </Link>
            ))}
          </div>
          <form className="search-field" action="/my-tickets">
            <span aria-hidden="true">⌕</span>
            <input type="hidden" name="filter" value={workspace.filter} />
            <input
              type="search"
              name="q"
              aria-label="Search tickets"
              placeholder="Search my tickets"
              defaultValue={workspace.query}
            />
          </form>
        </div>
        {workspace.tickets.length ? (
          <>
            <StaffTicketList
              tickets={workspace.tickets}
              getHref={(ticket) =>
                ticketHref(workspace.filter, workspace.query, workspace.page, ticket.ticketId)
              }
              selectedTicketId={workspace.selectedTicket?.ticketId}
            />
            <nav className="pagination-bar" aria-label="Ticket pages">
              <span>
                Page {workspace.page} of {workspace.totalPages}
              </span>
              <div className="tech-actions">
                <Link
                  className="secondary-button"
                  href={pageHref(
                    workspace.filter,
                    workspace.query,
                    Math.max(1, workspace.page - 1),
                    workspace.selectedTicket?.ticketId,
                  )}
                  aria-disabled={workspace.page === 1}
                >
                  Previous
                </Link>
                <Link
                  className="secondary-button"
                  href={pageHref(
                    workspace.filter,
                    workspace.query,
                    Math.min(workspace.totalPages, workspace.page + 1),
                    workspace.selectedTicket?.ticketId,
                  )}
                  aria-disabled={workspace.page === workspace.totalPages}
                >
                  Next
                </Link>
              </div>
            </nav>
          </>
        ) : (
          <div className="empty-state">
            <strong>{workspace.counts.all ? "No matching tickets" : "No tickets yet"}</strong>
            <p>
              {workspace.counts.all
                ? "Try another filter or search term."
                : "Your submitted tickets will appear here after they are created."}
            </p>
          </div>
        )}
      </div>
      <DetailPanel
        ticket={workspace.selectedTicket}
        filter={workspace.filter}
        query={workspace.query}
        page={workspace.page}
        search={search}
      />
    </div>
  );
}
