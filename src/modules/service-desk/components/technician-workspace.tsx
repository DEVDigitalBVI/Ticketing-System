import Link from "next/link";

import type {
  TechnicianQueueDetail,
  TechnicianQueueFilter,
  TechnicianWorkspaceData,
} from "@/server/tickets/technician-queue";

type SearchState = {
  status?: string;
};

function filterMessage(search: SearchState) {
  switch (search.status) {
    case "assigned":
      return { tone: "success" as const, text: "The ticket assignment was saved." };
    case "commented":
      return {
        tone: "success" as const,
        text: "Your public reply has been added to the ticket.",
      };
    case "noted":
      return {
        tone: "success" as const,
        text: "Your internal note has been added to the ticket.",
      };
    case "transitioned":
      return {
        tone: "success" as const,
        text: "The ticket lifecycle transition was applied.",
      };
    case "conflict":
      return {
        tone: "error" as const,
        text: "That ticket changed before your update was saved. Refresh and try again.",
      };
    case "failed":
      return { tone: "error" as const, text: "We could not update that ticket." };
    default:
      return null;
  }
}

function paramsFor(
  filter: TechnicianQueueFilter,
  page: number,
  ticketId?: string,
  status?: string,
) {
  const params = new URLSearchParams();
  if (filter !== "unassigned") params.set("filter", filter);
  if (page > 1) params.set("page", String(page));
  if (ticketId) params.set("ticket", ticketId);
  if (status) params.set("status", status);
  return params.toString();
}

function filterHref(filter: TechnicianQueueFilter) {
  const params = paramsFor(filter, 1);
  return params ? `/technician?${params}` : "/technician";
}

function pageHref(filter: TechnicianQueueFilter, page: number, ticketId?: string) {
  const params = paramsFor(filter, page, ticketId);
  return params ? `/technician?${params}` : "/technician";
}

function ticketHref(filter: TechnicianQueueFilter, page: number, ticketId: string) {
  const params = paramsFor(filter, page, ticketId);
  return `/technician?${params}`;
}

function statusClass(status: string) {
  if (status === "Waiting for requester" || status === "Waiting for vendor") return "action";
  if (status === "Resolved" || status === "In progress") return "progress";
  return "waiting";
}

const transitionLabels: Record<string, string> = {
  new: "New",
  triage: "Triage",
  assigned: "Assigned",
  in_progress: "In progress",
  waiting_for_requester: "Waiting for requester",
  waiting_for_vendor: "Waiting for vendor",
  resolved: "Resolved",
  closed: "Closed",
  cancelled: "Cancelled",
};

const transitionOptionsByStatus: Record<string, Array<{ value: string; label: string }>> = {
  new: [
    { value: "triage", label: transitionLabels.triage },
    { value: "cancelled", label: transitionLabels.cancelled },
  ],
  triage: [
    { value: "assigned", label: transitionLabels.assigned },
    { value: "cancelled", label: transitionLabels.cancelled },
  ],
  assigned: [
    { value: "triage", label: transitionLabels.triage },
    { value: "in_progress", label: transitionLabels.in_progress },
    { value: "cancelled", label: transitionLabels.cancelled },
  ],
  in_progress: [
    { value: "assigned", label: transitionLabels.assigned },
    { value: "waiting_for_requester", label: transitionLabels.waiting_for_requester },
    { value: "waiting_for_vendor", label: transitionLabels.waiting_for_vendor },
    { value: "resolved", label: transitionLabels.resolved },
    { value: "cancelled", label: transitionLabels.cancelled },
  ],
  waiting_for_requester: [
    { value: "in_progress", label: transitionLabels.in_progress },
    { value: "resolved", label: transitionLabels.resolved },
    { value: "cancelled", label: transitionLabels.cancelled },
  ],
  waiting_for_vendor: [
    { value: "in_progress", label: transitionLabels.in_progress },
    { value: "resolved", label: transitionLabels.resolved },
    { value: "cancelled", label: transitionLabels.cancelled },
  ],
  resolved: [
    { value: "closed", label: transitionLabels.closed },
    { value: "triage", label: transitionLabels.triage },
    { value: "assigned", label: transitionLabels.assigned },
    { value: "in_progress", label: transitionLabels.in_progress },
  ],
  closed: [{ value: "triage", label: transitionLabels.triage }],
  cancelled: [{ value: "triage", label: transitionLabels.triage }],
};

function queueEmptyState(filter: TechnicianQueueFilter) {
  switch (filter) {
    case "unassigned":
      return "No unassigned tickets";
    case "my_work":
      return "No tickets in My Work";
    case "team_work":
      return "No tickets in Team Work";
    case "waiting":
      return "No waiting tickets";
    case "at_risk":
      return "No at-risk tickets";
    case "breached":
      return "No breached tickets";
    case "recently_resolved":
      return "No recently resolved tickets";
  }
}

function DetailPanel({
  ticket,
  filter,
  page,
  search,
}: {
  ticket: TechnicianQueueDetail | null;
  filter: TechnicianQueueFilter;
  page: number;
  search: SearchState;
}) {
  const message = filterMessage(search);

  if (!ticket) {
    return (
      <aside className="context-panel" aria-label="Selected ticket context" aria-live="polite">
        <div className="empty-context">
          <p className="overline">Ticket context</p>
          <h2>No ticket selected</h2>
          <p>Choose a queue item to review the ticket, assignment, and activity history.</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="context-panel" aria-label="Selected ticket context" aria-live="polite">
      <div className="context-top">
        <span className={`priority-code ${ticket.priority.toLowerCase()}`}>{ticket.priority}</span>
        <span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span>
      </div>
      <h2>{ticket.subject}</h2>
      <p className="context-id">
        {ticket.ticketNumber} · {ticket.location}
      </p>
      {message ? (
        <p className={message.tone === "success" ? "form-success" : "form-error"}>{message.text}</p>
      ) : null}
      <div className="context-status">
        <span className="pulse-dot" aria-hidden="true" />
        <div>
          <strong>{ticket.serviceIndicator}</strong>
          <small>Internal status: {ticket.canonicalStatus.replaceAll("_", " ")}</small>
        </div>
      </div>
      <p>{ticket.description}</p>
      <dl className="detail-list">
        <div>
          <dt>Ticket number</dt>
          <dd>{ticket.ticketNumber}</dd>
        </div>
        <div>
          <dt>Requester</dt>
          <dd>{ticket.requester}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{ticket.location}</dd>
        </div>
        <div>
          <dt>Affected user</dt>
          <dd>{ticket.affectedUser ?? "Same as requester"}</dd>
        </div>
        <div>
          <dt>Property</dt>
          <dd>{ticket.property}</dd>
        </div>
        <div>
          <dt>Support team</dt>
          <dd>{ticket.supportTeam}</dd>
        </div>
        <div>
          <dt>Assignee</dt>
          <dd>{ticket.assignee}</dd>
        </div>
        <div>
          <dt>Impact</dt>
          <dd>{ticket.impact}</dd>
        </div>
        <div>
          <dt>Urgency</dt>
          <dd>{ticket.urgency}</dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd>{ticket.priority}</dd>
        </div>
        <div>
          <dt>Category</dt>
          <dd>
            {ticket.category}
            {ticket.subcategory ? ` · ${ticket.subcategory}` : ""}
          </dd>
        </div>
        <div>
          <dt>Age</dt>
          <dd>{ticket.age}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{ticket.source}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{ticket.source}</dd>
        </div>
      </dl>
      {ticket.resolutionSummary ? (
        <div className="privacy-note">
          <strong>Resolution summary</strong>
          <p>{ticket.resolutionSummary}</p>
          {ticket.closureDetails ? <p>{ticket.closureDetails}</p> : null}
          {ticket.resolutionCode ? <small>Code: {ticket.resolutionCode}</small> : null}
        </div>
      ) : null}
      <form className="ticket-inline-form" action="/auth/technician-ticket" method="post">
        <input type="hidden" name="intent" value="assign" />
        <input type="hidden" name="ticketId" value={ticket.ticketId} />
        <input type="hidden" name="filter" value={filter} />
        <input type="hidden" name="page" value={String(page)} />
        <input type="hidden" name="expectedUpdatedAt" value={ticket.updatedAtToken} />
        <label className="field-label" htmlFor="support-team">
          Support team
        </label>
        <select id="support-team" name="assignedSupportTeamId" defaultValue="">
          <option value="">Keep current team</option>
          {ticket.assignmentOptions.supportTeams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
        <label className="field-label" htmlFor="assigned-user">
          Assignee
        </label>
        <select id="assigned-user" name="assignedUserId" defaultValue="">
          <option value="">Keep current assignee</option>
          {ticket.assignmentOptions.technicians.map((technician) => (
            <option key={technician.id} value={technician.id}>
              {technician.name}
            </option>
          ))}
        </select>
        <label className="field-label" htmlFor="assignment-note">
          Assignment note
        </label>
        <textarea
          id="assignment-note"
          name="note"
          rows={3}
          maxLength={1000}
          placeholder="Add a short handoff note if needed."
        />
        <div className="tech-actions">
          <button className="primary-button" type="submit">
            Save assignment
          </button>
        </div>
      </form>

      <div className="ticket-inline-form">
        <h3>Lifecycle controls</h3>
        <form action="/auth/technician-ticket" method="post">
          <input type="hidden" name="intent" value="transition" />
          <input type="hidden" name="ticketId" value={ticket.ticketId} />
          <input type="hidden" name="filter" value={filter} />
          <input type="hidden" name="page" value={String(page)} />
          <input type="hidden" name="expectedUpdatedAt" value={ticket.updatedAtToken} />
          <label className="field-label" htmlFor="ticket-status">
            Update status
          </label>
          <select id="ticket-status" name="toStatus" defaultValue="">
            <option value="">Select lifecycle state</option>
            {transitionOptionsByStatus[ticket.canonicalStatus]?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <label className="field-label" htmlFor="transition-resolution-code">
            Resolution code
          </label>
          <select id="transition-resolution-code" name="resolutionCode" defaultValue="">
            <option value="">Select resolution code</option>
            <option value="resolved">Resolved</option>
            <option value="workaround">Workaround</option>
            <option value="vendor_fix">Vendor fix</option>
            <option value="duplicate">Duplicate</option>
            <option value="no_issue_found">No issue found</option>
            <option value="request_fulfilled">Request fulfilled</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <label className="field-label" htmlFor="transition-resolution-summary">
            Resolution summary
          </label>
          <textarea
            id="transition-resolution-summary"
            name="resolutionSummary"
            rows={3}
            maxLength={2000}
            placeholder="Summary is required when resolving."
          />
          <label className="field-label" htmlFor="transition-closure-details">
            Closure details
          </label>
          <textarea
            id="transition-closure-details"
            name="closureDetails"
            rows={3}
            maxLength={2000}
            placeholder="Required when closing or cancelling."
          />
          <div className="tech-actions">
            <button className="secondary-button" type="submit">
              Apply transition
            </button>
          </div>
        </form>
      </div>

      <div className="ticket-inline-form secondary-form">
        <form action="/auth/technician-ticket" method="post">
          <input type="hidden" name="intent" value="claim" />
          <input type="hidden" name="ticketId" value={ticket.ticketId} />
          <input type="hidden" name="filter" value={filter} />
          <input type="hidden" name="page" value={String(page)} />
          <input type="hidden" name="expectedUpdatedAt" value={ticket.updatedAtToken} />
          <button className="secondary-button" type="submit">
            Claim this ticket
          </button>
        </form>
      </div>

      <div className="ticket-inline-form">
        <h3>Public reply</h3>
        <form action="/auth/technician-ticket" method="post">
          <input type="hidden" name="intent" value="comment" />
          <input type="hidden" name="ticketId" value={ticket.ticketId} />
          <input type="hidden" name="filter" value={filter} />
          <input type="hidden" name="page" value={String(page)} />
          <input type="hidden" name="expectedUpdatedAt" value={ticket.updatedAtToken} />
          <input type="hidden" name="visibility" value="requester" />
          <label className="field-label" htmlFor="public-reply">
            Reply to requester
          </label>
          <textarea
            id="public-reply"
            name="body"
            rows={4}
            maxLength={4000}
            placeholder="Write a clear update for the requester."
            required
          />
          <button className="primary-button" type="submit">
            Send public reply
          </button>
        </form>
      </div>

      <div className="ticket-inline-form secondary-form">
        <h3>Internal note</h3>
        <form action="/auth/technician-ticket" method="post">
          <input type="hidden" name="intent" value="comment" />
          <input type="hidden" name="ticketId" value={ticket.ticketId} />
          <input type="hidden" name="filter" value={filter} />
          <input type="hidden" name="page" value={String(page)} />
          <input type="hidden" name="expectedUpdatedAt" value={ticket.updatedAtToken} />
          <input type="hidden" name="visibility" value="internal" />
          <label className="field-label" htmlFor="internal-note">
            Private technician note
          </label>
          <textarea
            id="internal-note"
            name="body"
            rows={4}
            maxLength={4000}
            placeholder="Add internal details not visible to requesters."
            required
          />
          <button className="secondary-button" type="submit">
            Add note
          </button>
        </form>
      </div>

      <div className="ticket-thread">
        <h3>Activity history</h3>
        <ol className="thread-list">
          {ticket.history.map((entry) => (
            <li key={entry.id} className="thread-entry">
              <strong>{entry.title}</strong>
              <small>{entry.timestamp}</small>
              {entry.body ? <p>{entry.body}</p> : null}
            </li>
          ))}
        </ol>
      </div>
      <div className="device-card">
        <div className="device-heading">
          <span>
            <small>RELATED TICKETS</small>
            <strong>Placeholder</strong>
          </span>
          <span className="online-badge">Not available</span>
        </div>
        <p>Related ticket suggestions will appear here once ticket dependency links are enabled.</p>
      </div>
      <div className="device-card">
        <div className="device-heading">
          <span>
            <small>ATTACHMENTS</small>
            <strong>Coming soon</strong>
          </span>
          <span className="online-badge">Pending</span>
        </div>
        <p>Attachment upload and history will be available in this ticket context.</p>
      </div>
    </aside>
  );
}

export function TechnicianWorkspace({
  workspace,
  search,
}: {
  workspace?: TechnicianWorkspaceData;
  search?: SearchState;
}) {
  if (!workspace) {
    return (
      <section className="view technician-view" aria-labelledby="technician-title">
        <header className="page-header technician-header">
          <div>
            <p className="overline">Technician workspace</p>
            <h1 id="technician-title">Service overview</h1>
            <p className="lead">Queue data will appear here after ticket access is connected.</p>
          </div>
        </header>
        <div className="metric-grid" aria-label="Service metrics">
          {[
            ["Unassigned", "—", "Ticket data not connected"],
            ["My Work", "—", "Ticket data not connected"],
            ["Waiting", "—", "Ticket data not connected"],
            ["Recently Resolved", "—", "Ticket data not connected"],
          ].map(([label, value, detail]) => (
            <article className="metric-card" key={label}>
              <p>{label}</p>
              <strong>{value}</strong>
              <span>{detail}</span>
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
            </div>
            <div className="queue-table" role="table" aria-label="Priority tickets">
              <div className="empty-state queue-empty-state">
                <strong>No tickets in the queue</strong>
                <p>Priority work will appear after authenticated ticket access is connected.</p>
              </div>
            </div>
          </section>
          <aside className="context-panel" aria-label="Selected ticket context" aria-live="polite">
            <div className="empty-context">
              <p className="overline">Ticket context</p>
              <h2>No ticket selected</h2>
              <p>Ticket and device details will appear here when live services are connected.</p>
            </div>
          </aside>
        </div>
      </section>
    );
  }

  const searchState = search ?? {};

  return (
    <section className="view technician-view" aria-labelledby="technician-title">
      <header className="page-header technician-header">
        <div>
          <p className="overline">Technician workspace</p>
          <h1 id="technician-title">Service overview</h1>
          <p className="lead">Find, claim, and assign tickets from the live operational queue.</p>
        </div>
      </header>

      <div className="metric-grid" aria-label="Service metrics">
        <article className="metric-card">
          <p>Unassigned</p>
          <strong>{workspace.metrics.unassigned}</strong>
          <span>Ready to be claimed</span>
        </article>
        <article className="metric-card">
          <p>My Work</p>
          <strong>{workspace.metrics.myWork}</strong>
          <span>Assigned to you</span>
        </article>
        <article className="metric-card">
          <p>Waiting</p>
          <strong>{workspace.metrics.waiting}</strong>
          <span>Requester or vendor follow-up</span>
        </article>
        <article className="metric-card">
          <p>Recently Resolved</p>
          <strong>{workspace.metrics.recentlyResolved}</strong>
          <span>Latest fixes and confirmations</span>
        </article>
      </div>

      <div className="workspace-grid">
        <section className="queue-panel" aria-labelledby="priority-queue-title">
          <div className="section-heading queue-heading">
            <div>
              <p className="overline">Priority queue</p>
              <h2 id="priority-queue-title">Needs attention</h2>
            </div>
          </div>
          <div className="filter-bar queue-filters">
            <div className="tab-list" role="tablist" aria-label="Queue views">
              {(
                [
                  ["unassigned", "Unassigned"],
                  ["my_work", "My Work"],
                  ["team_work", "Team Work"],
                  ["waiting", "Waiting"],
                  ["at_risk", "At Risk"],
                  ["breached", "Breached"],
                  ["recently_resolved", "Recently Resolved"],
                ] as const
              ).map(([value, label]) => (
                <Link
                  key={value}
                  href={filterHref(value)}
                  className={`tab${workspace.filter === value ? " is-active" : ""}`}
                  role="tab"
                  aria-selected={workspace.filter === value}
                >
                  {label}
                  <span>{workspace.counts[value]}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="queue-table" role="table" aria-label="Priority tickets">
            <div className="queue-table-head" role="row">
              <span role="columnheader">Ticket</span>
              <span role="columnheader">Context</span>
              <span role="columnheader">Owner</span>
              <span role="columnheader">Service</span>
            </div>
            {workspace.tickets.length ? (
              workspace.tickets.map((ticket) => (
                <Link
                  className={`queue-item${workspace.selectedTicket?.ticketId === ticket.ticketId ? " selected" : ""}`}
                  href={ticketHref(workspace.filter, workspace.page, ticket.ticketId)}
                  role="row"
                  aria-current={
                    workspace.selectedTicket?.ticketId === ticket.ticketId ? "true" : undefined
                  }
                  key={ticket.ticketId}
                >
                  <span role="cell">
                    <b className={`priority-code ${ticket.priority.toLowerCase()}`}>
                      {ticket.priority}
                    </b>
                    <strong>{ticket.subject}</strong>
                    <small>
                      {ticket.ticketNumber} · {ticket.age}
                    </small>
                  </span>
                  <span role="cell">
                    <strong>{ticket.location}</strong>
                    <small>
                      {ticket.requester} · {ticket.category}
                    </small>
                  </span>
                  <span role="cell">
                    <span
                      className={`mini-avatar${ticket.assignee === "Unassigned" ? " neutral" : ""}`}
                    >
                      {ticket.assigneeInitials}
                    </span>
                    {ticket.assignee}
                  </span>
                  <span
                    className={`sla ${ticket.priority === "P1" ? "danger" : ticket.priority === "P2" ? "warning" : "normal"}`}
                    role="cell"
                  >
                    <strong>{ticket.status}</strong>
                    <small>{ticket.serviceIndicator}</small>
                  </span>
                </Link>
              ))
            ) : (
              <div className="empty-state queue-empty-state">
                <strong>{queueEmptyState(workspace.filter)}</strong>
                <p>
                  {workspace.filter === "at_risk" || workspace.filter === "breached"
                    ? "Formal SLA timing is not implemented yet, so these placeholder views are intentionally empty."
                    : "Tickets in this queue view will appear here when they match the selected filter."}
                </p>
              </div>
            )}
          </div>
          {workspace.tickets.length ? (
            <nav className="pagination-bar" aria-label="Queue pages">
              <span>
                Page {workspace.page} of {workspace.totalPages}
              </span>
              <div className="tech-actions">
                <Link
                  className="secondary-button"
                  href={pageHref(
                    workspace.filter,
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
                    Math.min(workspace.totalPages, workspace.page + 1),
                    workspace.selectedTicket?.ticketId,
                  )}
                  aria-disabled={workspace.page === workspace.totalPages}
                >
                  Next
                </Link>
              </div>
            </nav>
          ) : null}
        </section>

        <DetailPanel
          ticket={workspace.selectedTicket}
          filter={workspace.filter}
          page={workspace.page}
          search={searchState}
        />
      </div>
    </section>
  );
}
