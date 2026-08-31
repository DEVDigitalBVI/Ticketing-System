"use client";

import { useMemo, useState } from "react";

import { staffTickets } from "../mock-data";
import { StaffTicketList } from "./staff-ticket-list";

type Filter = "Active" | "Completed" | "All";

export function TicketFilters() {
  const [filter, setFilter] = useState<Filter>("Active");
  const [query, setQuery] = useState("");
  const tickets = useMemo(
    () =>
      staffTickets.filter(
        (ticket) =>
          (filter === "All" || ticket.state.toLowerCase() === filter.toLowerCase()) &&
          `${ticket.id} ${ticket.title} ${ticket.location}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [filter, query],
  );

  return (
    <>
      <div className="filter-bar">
        <div className="tab-list" role="tablist" aria-label="Ticket filters">
          {(["Active", "Completed", "All"] as const).map((item) => (
            <button
              className={`tab${filter === item ? " is-active" : ""}`}
              type="button"
              role="tab"
              aria-selected={filter === item}
              key={item}
              onClick={() => setFilter(item)}
            >
              {item}
              {item === "Active" ? <span>3</span> : null}
            </button>
          ))}
        </div>
        <label className="search-field">
          <span className="sr-only">Search tickets</span>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            placeholder="Search my tickets"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      {tickets.length ? (
        <StaffTicketList tickets={tickets} />
      ) : (
        <div className="empty-state">
          <strong>No matching tickets</strong>
          <p>Try another filter or search term.</p>
        </div>
      )}
    </>
  );
}
