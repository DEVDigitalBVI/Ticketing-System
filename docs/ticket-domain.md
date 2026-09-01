# Ticket domain

Last updated: 2026-09-01

Step 8 establishes the persistent ticket domain and server-side workflow without connecting the existing UI routes to persistence.

## Data model

- `tickets`: core request record with a human-readable `ticket_number`, requester, optional affected user, resort hierarchy links, service taxonomy links, impact, urgency, placeholder priority, assignment fields, lifecycle status, and terminal resolution/closure fields.
- `ticket_activities`: append-only lifecycle and system history with optional actor, from/to status values, requester visibility, and structured metadata.
- `ticket_comments`: append-only free-text comments with either `requester` or `internal` visibility.
- `ticket_assignments`: append-only assignment history capturing who assigned the ticket, the support team and/or user target, an optional note, and the timestamp.
- `attachment_metadata`: append-only attachment descriptors reserved for later file handling; it stores visibility, file metadata, uploader, and optional comment linkage.

## Identifier and state rules

- Ticket numbers are generated in PostgreSQL from `service_desk.ticket_number_seq`.
- A before-insert trigger formats every ticket number as `PIR-######` or longer as the sequence grows.
- Supported lifecycle states are:
  - `new`
  - `triage`
  - `assigned`
  - `in_progress`
  - `waiting_for_requester`
  - `waiting_for_vendor`
  - `resolved`
  - `closed`
  - `cancelled`
- History tables reject update and delete operations through immutable-row triggers.

## Transition rules

- `new` → `triage`, `cancelled`
- `triage` → `assigned`, `cancelled`
- `assigned` → `triage`, `in_progress`, `cancelled`
- `in_progress` → `assigned`, `waiting_for_requester`, `waiting_for_vendor`, `resolved`, `cancelled`
- `waiting_for_requester` → `in_progress`, `resolved`, `cancelled`
- `waiting_for_vendor` → `in_progress`, `resolved`, `cancelled`
- `resolved` → `closed`, `triage`, `assigned`, `in_progress`
- `closed` → `triage`
- `cancelled` → `triage`

Additional service-layer rules:

- `assigned`, `in_progress`, `waiting_for_requester`, and `waiting_for_vendor` require a support team or assignee.
- `resolved` requires both a resolution code and resolution summary.
- `closed` requires the ticket to already be `resolved` and requires closure details.
- `cancelled` requires closure details and records a `cancelled` resolution code.
- Reopening to `triage`, `assigned`, or `in_progress` clears terminal resolution and closure fields.

## Authorization rules

- Ticket creation requires `ticket.submit` in the ticket property scope.
- Setting an initial support team or assignee during creation also requires `ticket.assign`.
- Assignment changes require `ticket.assign`.
- Internal notes require `ticket.note.internal`.
- Lifecycle changes require `ticket.transition`.
- Queue-style reads use `ticket.queue.read`; requester self-service reads use `ticket.read.own`.

## Tests

- `tests/ticket-workflow.test.ts` covers transition legality, placeholder priority calculation, and read/comment authorization.
- `tests/database/ticket-domain.test.ts` covers ticket numbering, direct constraints, comment visibility, assignment history, lifecycle progression and reopening, immutable history, and service-level read guards.
