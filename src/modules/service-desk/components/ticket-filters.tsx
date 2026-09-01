"use client";

import { useState } from "react";

import type { StaffTicket } from "../types";
import { StaffTicketList } from "./staff-ticket-list";

type Filter = "Active" | "Completed" | "All";

export function TicketFilters({ tickets = [] }: { tickets?: StaffTicket[] }) {
  const [filter, setFilter] = useState<Filter>("Active");
  const [query, setQuery] = useState("");
  const visibleTickets = tickets.filter(
    (ticket) =>
      (filter === "All" || ticket.state.toLowerCase() === filter.toLowerCase()) &&
      `${ticket.id} ${ticket.title} ${ticket.location}`.toLowerCase().includes(query.toLowerCase()),
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
              {item === "Active" && tickets.length ? (
                <span>{tickets.filter((ticket) => ticket.state === "active").length}</span>
              ) : null}
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
      {visibleTickets.length ? (
        <StaffTicketList tickets={visibleTickets} />
      ) : (
        <div className="empty-state">
          <strong>{tickets.length ? "No matching tickets" : "No tickets yet"}</strong>
          <p>
            {tickets.length
              ? "Try another filter or search term."
              : "Your requests will appear here after secure ticket persistence is connected."}
          </p>
        </div>
      )}
    </>
  );
}
