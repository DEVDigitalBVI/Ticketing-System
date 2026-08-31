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

- **Status:** Proposed — application-shell portions are accepted in ADR-002; integration and deployment portions require owner approval and blueprint evidence
- **Date:** 2026-08-30
- **Owners:** Product / Engineering
- **Context:** The current repository has no application code or configuration. The project owner identified the product as the Peter Island Resort and Spa IT Service Desk, the Git repository as `Ticketing System`, and the Supabase project as `Ticketing system`. The referenced project blueprint was not available during inspection, so this record cannot yet claim to be the blueprint's approved baseline.
- **Decision:** The Next.js, React, TypeScript, pnpm, and application-shell portion is accepted in ADR-002. Continue to recommend Supabase for PostgreSQL and related managed backend capabilities, deployment to Vercel, Microsoft Entra ID using Peter Island Resort and Spa's organizational tenant, Supabase Storage for ticket attachments, Supabase Queues (`pgmq`) for durable asynchronous jobs, and a multi-property-capable data model with Peter Island Resort and Spa enabled at initial launch. These remaining integration, hosting, and property-model choices stay proposed until the approval checkpoint and blueprint review.
- **Consequences:** This provides a cohesive managed stack and preserves a path from a Peter Island Resort and Spa launch to multiple properties. It also makes authorization/RLS design, tenant configuration, regional/data-residency review, queue consumers, and vendor limits explicit implementation concerns.
- **Evidence:** Repository inspection in `docs/implementation-status.md`; owner-provided repository and Supabase project names. Blueprint evidence is missing.
- **Supersedes:** None.

## ADR-002: Application foundation and quality gates

- **Status:** Accepted
- **Date:** 2026-08-30
- **Owners:** Product / Engineering
- **Context:** Step 2 requires a runnable Next.js App Router shell with strict typing, a component-system convention, clear code boundaries, and reproducible developer checks. Current package compatibility must be explicit rather than relying on floating dependency ranges.
- **Decision:** Use Node.js 24+, pnpm 11.24.0, Next.js 16.3.3, React 19.2.8, strict TypeScript 6.0.3, Tailwind CSS 4.3.3, and shadcn/ui 4.19.0 with the `new-york` style convention. Organize routes, domain modules, shared UI, shared utilities, server infrastructure, tests, and documentation into the boundaries recorded in `README.md`. Use Prettier 3.9.6, ESLint 10.9.1 composed directly with TypeScript ESLint 8.68.0 and `@next/eslint-plugin-next` 16.3.3, Vitest 4.1.11 with Testing Library, strict `tsc --noEmit`, and `next build` as required quality gates. Pin every declared package version and commit the pnpm lockfile.
- **Consequences:** Installs and checks are reproducible, the application has current framework guidance available locally, and future features have explicit code boundaries. TypeScript remains on the latest release supported by TypeScript ESLint rather than TypeScript 7; this should be revisited when the lint toolchain supports it. The component-system configuration is established without adding ticketing-domain components.
- **Evidence:** Step 2 instructions; passing checks and live HTTP 200 evidence in `docs/implementation-status.md`; `package.json`, `pnpm-lock.yaml`, `components.json`, and the source/test structure.
- **Supersedes:** None.

## Confirmed project identifiers

These identifiers are working context rather than architecture choices:

- Resort: `Peter Island Resort and Spa`
- Git repository: `Ticketing System`
- Supabase project: `Ticketing system`
