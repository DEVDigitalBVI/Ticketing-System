# Peter Island Resort and Spa IT Service Desk — Decision Log

Last updated: 2026-08-30

## How to use this log

Create one record for each architecture or product decision that has meaningful cost, risk, or downstream impact. Keep records short and update the status rather than silently rewriting history.

Allowed statuses: `Proposed`, `Accepted`, `Superseded`, `Rejected`.

## ADR template

### ADR-NNN: Decision title

- **Status:** Proposed
- **Date:** YYYY-MM-DD
- **Owners:** Product / Engineering
- **Context:** What forces or constraints require a decision?
- **Decision:** What was decided?
- **Consequences:** What becomes easier, harder, or constrained?
- **Evidence:** Blueprint section, issue, test, or approval that supports the decision.
- **Supersedes:** ADR number or `None`.

## ADR-001: Baseline application architecture

- **Status:** Proposed — owner approval and blueprint evidence required
- **Date:** 2026-08-30
- **Owners:** Product / Engineering
- **Context:** The current repository has no application code or configuration. The project owner identified the product as the Peter Island Resort and Spa IT Service Desk, the Git repository as `Ticketing System`, and the Supabase project as `Ticketing system`. The referenced project blueprint was not available during inspection, so this record cannot yet claim to be the blueprint's approved baseline.
- **Decision:** Recommend a TypeScript web application using Next.js App Router for the application and server boundary, Supabase for PostgreSQL, authentication integration, Realtime where justified, and managed file storage. Recommend deployment to Vercel, `pnpm` as the package manager, Microsoft Entra ID using Peter Island Resort and Spa's organizational tenant, Supabase Storage for ticket attachments, Supabase Queues (`pgmq`) for durable asynchronous jobs, and a multi-property-capable data model with Peter Island Resort and Spa enabled at initial launch. This entire decision remains proposed until the approval checkpoint and blueprint review.
- **Consequences:** This provides a cohesive managed stack and preserves a path from a Peter Island Resort and Spa launch to multiple properties. It also makes authorization/RLS design, tenant configuration, regional/data-residency review, queue consumers, and vendor limits explicit implementation concerns.
- **Evidence:** Repository inspection in `docs/implementation-status.md`; owner-provided repository and Supabase project names. Blueprint evidence is missing.
- **Supersedes:** None.

## Confirmed project identifiers

These identifiers are working context rather than architecture choices:

- Resort: `Peter Island Resort and Spa`
- Git repository: `Ticketing System`
- Supabase project: `Ticketing system`
