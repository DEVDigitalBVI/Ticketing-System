# Knowledge base policy

Last verified: 2026-09-08
Status: Step 26 implemented

## Purpose and boundary

The knowledge base captures reusable resort IT guidance without turning ticket conversations into public documentation. Articles belong to one organisation, have one owner, an optional independent reviewer, a primary ticket category, optional related asset, a scheduled review date, and immutable content versions.

Article bodies use a deliberately small text format: paragraphs, `##` and `###` headings, ordered and unordered lists, bold text, and inline code. The renderer creates React text nodes and approved elements only. It never parses HTML, uses `dangerouslySetInnerHTML`, loads embedded resources, or executes pasted markup. Tags such as `<script>` and `<img>` remain visible inert text.

## Workflow

1. Technicians, IT Managers, and System Administrators create Draft articles.
2. The owner selects an active IT Manager or System Administrator as reviewer and sends the article to In Review.
3. Only IT Managers and System Administrators can publish. Publishing requires an independent reviewer and review date.
4. Published content can be Retired by a publisher. A retired article can return to Draft for a new revision and review cycle.
5. Every content edit increments `current_version` with optimistic conflict protection and appends an immutable version snapshot and change note. Workflow transitions are separately audited.

## Audience enforcement

`staff` means any role with `knowledge.read`: Requester, Technician, IT Manager, System Administrator, and Department Approver. `technician` requires the separate `knowledge.read.technician` permission held by Technician, IT Manager, and System Administrator.

Staff search always applies organisation, `published`, and `staff` predicates on the server. Client-supplied state filters cannot relax them. Technician search includes published staff and technician content. Draft, In Review, and Retired articles are visible only to their owner, assigned reviewer, or a publisher. Direct article URLs apply the same database predicate and return not found when the audience or workflow relationship does not match, avoiding both content disclosure and article enumeration.

## Tickets, assets, and feedback

Technicians can carry a selected ticket into knowledge search and link a Published article after the service verifies ticket property access and article audience. Staff-audience links create requester-visible activity; technician-audience links remain internal. Duplicate links are idempotent.

A proposal from a resolution is permitted only for a Resolved or Closed ticket in the technician's property scope. The article form starts blank and the service reads only ticket identity, property, and state. It never copies the ticket summary, description, comments, requester, affected user, resolution text, device context, or attachment data.

Feedback is one helpful or not-yet vote per user, article, and version. A later vote updates that same row. Counts are displayed without exposing voter identities.

Related assets are selected from active organisation inventory and repeated property authorization prevents a crafted form value from linking an inaccessible asset. Ticket categories and reviewers are also resolved again inside the write transaction.

## Stale content

A Published article is overdue when its review date is before the current UTC calendar date. Authors and publishers can filter search to the overdue report. The label is informational; stale content remains available until a publisher revises or retires it, avoiding sudden loss of operational guidance.

## Database security

All five tables are in the private `service_desk` schema. Composite foreign keys preserve tenant consistency. `anon` and `authenticated` have no direct table privileges. Article state, audience, lengths, publication metadata, positive versions, and uniqueness are database constrained. Version rows are immutable through a trigger whose function has a fixed search path and no public execution grant.
