# Peter Island Resort and Spa IT Service Desk — Decision Log

Last updated: 2026-08-31

## ADR-010: Managed Supabase credentials with SMTP onboarding

- **Status:** Accepted
- **Date:** 2026-08-31
- **Owners:** Product / Engineering
- **Context:** Administrators create accounts and users receive initial credentials through the resort's application SMTP forwarder.
- **Decision:** Use Supabase Auth for passwords, sessions, and an MFA-capable login path, mapped by Auth UUID to `service_desk.users`. Disable public sign-up. Generate a cryptographically random temporary password, send it through server-only SMTP, and require replacement before service-desk access. Use domain roles and RLS—not user-editable Auth metadata—for authorization. Defer mandatory MFA enforcement until the login hardening work is implemented before deployment.
- **Consequences:** Runtime creation requires a Supabase secret key and SMTP credentials. Temporary passwords exist only during the Auth Admin call and SMTP send. Failed profile creation or delivery triggers compensating deletion. MFA enrollment and strict AAL2 enforcement remain future hardening work rather than a current runtime requirement.
- **Evidence:** Auth routes under `src/app`, adapters under `src/server/auth` and `src/server/email`, and hosted auth/RLS migrations.
- **Supersedes:** The authentication-provider portion of open question 2.

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
- **Decision:** The Next.js, React, TypeScript, pnpm, and application-shell portion is accepted in ADR-002. Continue to recommend Supabase for PostgreSQL and related managed backend capabilities, deployment to Vercel, Supabase Storage for ticket attachments, Supabase Queues (`pgmq`) for durable asynchronous jobs, and a multi-property-capable data model with Peter Island Resort and Spa enabled at initial launch. These remaining integration, hosting, and property-model choices stay proposed until the approval checkpoint and blueprint review.
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

## ADR-003: Approved frontend design source

- **Status:** Accepted
- **Date:** 2026-08-31
- **Owners:** Product / Engineering
- **Context:** The owner supplied the Warp Codex handoff and its complete four-view service desk reference, and directed implementation without redesign.
- **Decision:** Treat the supplied graphite-rail, warm-neutral Resort IT Service Desk interface as the visual source of truth. Implement it through reusable App Router routes and domain components, substituting Peter Island Resort and Spa product/property naming while preserving typography, spacing, layouts, responsive behavior, accessibility treatments, and the display-only Level.io context panel.
- **Consequences:** Future frontend work must extend the accepted token system and interaction patterns rather than introducing a new dashboard aesthetic. The current data and integrations remain mock-only until separately approved backend steps.
- **Evidence:** Supplied `WARP_CODEX_HANDOFF.md`; routes and components under `src/app/(service-desk)` and `src/modules/service-desk`; responsive and interaction tests under `tests/`.
- **Supersedes:** The earlier coastal foundation composition as the production application interface; its delivery-control history remains valid.

## ADR-004: Remove unused frontend scaffolding

- **Status:** Accepted
- **Date:** 2026-08-31
- **Owners:** Engineering
- **Context:** The approved service-desk interface uses custom semantic components and design tokens. The earlier coastal components, shadcn configuration, class-name helper, icon package, variant helper, and animation helper had no remaining imports.
- **Decision:** Remove the unreachable frontend layer and its six exclusive packages while retaining the approved Tailwind CSS pipeline. Keep the supplied four-view design reference as audit evidence and remove the superseded coastal artifact.
- **Consequences:** The install graph and maintained source surface are smaller. If a future feature genuinely needs shadcn or one of the removed utilities, it must add the specific dependency with an active use case rather than retaining speculative scaffolding.
- **Evidence:** Repository-wide import search, passing lint/type/test/build gates, and the cleanup record in `docs/implementation-status.md`.
- **Supersedes:** The shadcn-specific portion of ADR-002; its framework, TypeScript, Tailwind, and quality-gate decisions remain accepted.

## ADR-005: Freeze the verified frontend as the backend integration contract

- **Status:** Accepted
- **Date:** 2026-08-31
- **Owners:** Product / Engineering
- **Context:** The approved four-view interface is complete, and Step 3 must establish a stable baseline before authentication, persistence, or external integrations alter its behavior.
- **Decision:** Treat `docs/design-contract.md`, the production components and styles under `src/`, and the retained files in `design-prototype 2/` as the ordered frontend contract. Backend steps may replace mock data and local-only handlers behind the existing components, but must preserve the accepted route purposes, hierarchy, typography, tokens, spacing, responsive transitions, control names, focus treatment, interaction feedback, and display-only Level.io panel unless Product explicitly approves a design change.
- **Consequences:** Backend implementation has a clear compatibility boundary and cannot quietly redesign the product. Material visual or interaction changes require an explicit decision-log entry, updated contract evidence, and desktop/mobile regression verification. Current placeholder actions do not imply that authentication, persistence, or Level.io behavior exists.
- **Evidence:** Step 3 audit and passing checks in `docs/implementation-status.md`; `docs/design-contract.md`; ADR-003; retained design handoff and prototype files.
- **Supersedes:** None.

## Step 3 revalidation note

The baseline was reverified at commit `ba8e67a` on 2026-08-31. All automated quality gates and local route checks passed, and no application-code or dependency change was needed. This revalidation introduces no new architecture or product decision; ADR-005 remains the controlling frontend contract. The unavailable browser connection is recorded as a verification limitation rather than silently treated as visual evidence.

## ADR-006: Adopt the owner-approved resort color palette

- **Status:** Accepted
- **Date:** 2026-08-31
- **Owners:** Product / Engineering
- **Context:** The owner selected the Figma palette `#0cdc2a`, `#384166`, `#0b735f`, `#639d75`, and `#e3dba9` for the approved interface. The layout and interaction contract remains unchanged.
- **Decision:** Add all five colors as explicit brand tokens. Use deep indigo for the navigation rail, featured surfaces, and primary ink; teal for primary actions; signal green for selected and healthy accents; sage for supporting status treatments; and sand for hospitality warmth. Retain separate amber and red semantic colors for warning and danger. Pair colors according to WCAG contrast rather than treating every palette color as interchangeable foreground text.
- **Consequences:** The service desk gains a more distinctive island-resort palette without altering its routes, typography, responsive layouts, component hierarchy, or interaction behavior. Future color changes must update semantic token mappings and contrast tests, not scatter raw replacements through components.
- **Evidence:** Owner-supplied Figma palette URL; token mapping in `src/app/globals.css`; responsive design contract test; updated `docs/design-contract.md`.
- **Supersedes:** The color assignments in ADR-003 and ADR-005; their remaining design-contract decisions stay accepted.

## ADR-007: PostgreSQL and Prisma data foundation

- **Status:** Accepted
- **Date:** 2026-08-31
- **Owners:** Product / Engineering
- **Context:** Step 4 requires a persistent identity and organisation foundation without introducing ticketing or integration tables. The named Supabase project remains a possible production host, but its production approval and credentials are still unavailable.
- **Decision:** Use PostgreSQL 17.11 locally through pinned Docker Compose and Prisma ORM 7.10.0 with the `pg` driver adapter. Keep application tables in a private `service_desk` schema. Model one organisation with multiple properties, property-owned departments, organisation-owned users and roles, property-scoped role assignments, and immutable audit events. Use UUID database defaults, timezone-aware timestamps, explicit constraints, tenant-consistent composite foreign keys, restricted parent deletion, indexed foreign keys, and repositories as the application access boundary. Keep migrations on a direct database URL while allowing the runtime URL to use a pooler later.
- **Consequences:** Local and test databases have reproducible create/migrate/seed/reset workflows, and future authentication or ticket work can depend on stable identity/property relationships. Production Supabase connection, RLS policies, separate least-privilege database roles, pooler settings, and deployment migration automation remain later decisions. The private schema avoids accidental Data API exposure before those controls exist.
- **Evidence:** `compose.yaml`, `prisma/schema.prisma`, the initial migration and seed, server configuration/repositories, database constraint tests, and Step 4 verification in `docs/implementation-status.md`.
- **Supersedes:** The database and property-model portions of ADR-001; its hosting, storage, queue, and deployment proposals remain undecided.

## ADR-008: Host the identity foundation in Supabase

- **Status:** Accepted
- **Date:** 2026-08-31
- **Owners:** Product / Engineering
- **Context:** The owner authorized connecting the application foundation to the existing Supabase project `Ticketing System`. The project was active and healthy in `us-east-1`, used PostgreSQL 17, and had no application tables or migration history before this change.
- **Decision:** Use Supabase project `zwcmljkjoxrfzfyphdtc` as the hosted PostgreSQL environment for the Step 4 identity foundation. Apply the reviewed Prisma SQL to the private `service_desk` schema without seed data, Data API exposure, authentication integration, or domain tables. Keep Prisma migrations as the repository source of truth and record equivalent hosted migrations in Supabase. Add the covering index identified by the hosted performance advisor.
- **Consequences:** The seven foundational tables now exist remotely and remain inaccessible to `anon` and `authenticated` because neither role has schema usage. Runtime and direct migration connection strings, a least-privilege application database role, deployment automation, and authentication-aware RLS policies still require decisions before application traffic can use this environment.
- **Evidence:** Supabase migrations `step_4_identity_foundation` and `add_user_role_fk_index`; live catalog verification; a clean security advisor scan and no remaining missing-foreign-key-index finding; Prisma migrations under `prisma/migrations/`; hosted verification in `docs/implementation-status.md`.
- **Supersedes:** ADR-007 only where it described the hosted Supabase database as undecided. ADR-007 remains authoritative for the schema and local/test workflow.

## ADR-009: Remove bundled mock and development seed data

- **Status:** Accepted
- **Date:** 2026-08-31
- **Owners:** Product / Engineering
- **Context:** The owner requested removal of all mock application data before further backend work and a complete application/security audit. The approved layouts previously rendered fictional tickets, profile identity, metrics, service health, device context, and an optional fictional development seed.
- **Decision:** Remove the production mock-data module and development seed workflow. Preserve the approved layout with explicit empty and unavailable states, keep data-capable components typed for future server-provided view data, and retain synthetic records only inside isolated constraint tests. Do not represent authentication, monitoring, ticket persistence, Level.io, or service health as connected when they are not.
- **Consequences:** The application no longer demonstrates populated ticket flows until real authenticated persistence is implemented. Local reset produces a migrated empty schema. Tests create only the records they require inside the disposable test database. Empty-state copy and disabled unavailable controls become part of the design contract.
- **Evidence:** Removed `src/modules/service-desk/mock-data.ts` and `prisma/seed.ts`; updated service-desk components, database scripts/tests, README, design contract, and application audit.
- **Supersedes:** ADR-003 and ADR-005 only where they permitted bundled mock records; their visual and interaction contract remains accepted. ADR-007's fictional seed decision is retired.

## ADR-010: Add a provider-unconnected login interface

- **Status:** Accepted
- **Date:** 2026-08-31
- **Owners:** Product / Engineering
- **Context:** The owner requested a login screen before an authentication provider, session model, recovery flow, or authorization policy has been approved.
- **Decision:** Add `/login` as a responsive, accessible extension of the approved resort design. Present conventional work-email/password controls for product review, but prevent submission locally and explicitly state that credentials are not sent or stored. Keep provider integration behind a future authentication boundary; this screen does not select an authentication provider.
- **Consequences:** Product can review the login experience without creating a false security boundary. The credential controls may need an approved change if federated-only sign-in is selected. No existing application route is protected until authentication, sessions, authorization, and RLS are implemented together.
- **Evidence:** `src/app/login/page.tsx`, `src/modules/auth/components/login-form.tsx`, login tests, responsive styles, and the updated design contract.
- **Supersedes:** None.

## ADR-011: Centralize role authorization and privacy-bounded audit evidence

- **Status:** Accepted
- **Date:** 2026-08-31
- **Owners:** Product / Engineering
- **Context:** Business tables must not be introduced before every supported role has an explicit, testable server-side access boundary. The existing three role labels were too coarse, and immutable audit rows lacked explicit outcome and request correlation fields.
- **Decision:** Use a deny-by-default TypeScript policy matrix with canonical Requester, Technician, IT Manager, System Administrator, Auditor / Report Viewer, and Department Approver roles. Apply organisation, property, ownership, and department checks after permission checks. Keep database role assignments authoritative rather than JWT user metadata. Guard server pages and mutations at the data/service boundary, repeat privileged checks in narrowly granted PostgreSQL functions, and retain direct denial on the audit table. Extend audit events with a controlled result, UUID correlation ID, and recursively constrained safe JSON context; expose only a minimal privileged audit DTO.
- **Consequences:** Future ticket, asset, reporting, Level.io, administration, and configuration services must call this policy rather than inventing route-local role checks. Department Approver is defined but cannot be assigned until department scope is represented. Auditor / Report Viewer has read-only report and audit permission. System Administrator is organisation-wide but cannot cross tenants. Audit context cannot contain credentials, secrets, tokens, sessions, cookies, file contents, authorization values, or private provider payloads.
- **Evidence:** `src/modules/auth/authorization.ts`, server authorization and audit services, migration `20260901011947_step_6_authorization_and_audit`, `/admin/audit`, `docs/role-permission-matrix.md`, 44 application tests, eight database tests, and hosted Supabase readback/advisors.
- **Supersedes:** Legacy `staff`/`admin` role naming and route-local authorization checks. ADR-007's append-only audit decision remains in force.

## ADR-012: Keep ticket attachments private behind the application boundary

- **Status:** Accepted
- **Date:** 2026-09-04
- **Owners:** Product / Engineering
- **Context:** Step 14 approves private object storage for ticket screenshots and documents. Attachment URLs and object identifiers must not bypass the ticket-level authorization already enforced by the application, and malware scanning infrastructure is not yet available.
- **Decision:** Use a non-public Supabase Storage bucket with no browser-facing object policies. Generate UUID-based object paths without filenames; accept only signature-verified PNG, JPEG, WebP, PDF, and UTF-8 text files up to 10 MiB; and perform upload and streamed download through authenticated server routes that re-evaluate ticket access. Store immutable ticket/uploader/file identity with mutable quarantine, scan, upload, and retention lifecycle fields. Permit only the uploader to retrieve pending or failed-scan content, block infected content for everyone, and retain metadata after object cleanup.
- **Consequences:** Knowing an attachment UUID or object path grants no access. The server-only Supabase credential remains a high-trust boundary, cleanup workers must receive an explicit clock, and other ticket participants cannot retrieve new attachments until a future scanner marks them clean. Office archive formats remain unsupported until their contents can be validated safely.
- **Evidence:** `docs/attachment-policy.md`, migration `20260904154437_step_14_private_ticket_attachments`, attachment policy/service and route modules, staff/technician integration, and Step 14 tests/status evidence.

### ADR-013 — Keep business asset identity and history application-owned

- **Date:** 2026-09-04
- **Status:** Accepted
- **Context:** Tickets and a later Level.io integration need one stable resort inventory record. Resort tags, manufacturer serials, external platform identifiers, live telemetry, physical location, responsibility, and commercial data have different owners and lifecycles.
- **Decision:** Make the service desk authoritative for the resort asset tag, type, lifecycle, hierarchy location, custodian/department assignment, criticality, purchase/warranty data, and append-only move history. Store serial numbers and namespaced external IDs separately. Require property-scoped `asset.read`/`asset.manage`, optimistic mutation checks, composite tenant/hierarchy foreign keys, audit events, and retirement rather than deletion. Reserve `ExternalSystemLink` for future integrations without creating a Level.io link or client in Step 15.
- **Consequences:** IT can reconstruct current and historical accountability without trusting an external monitoring platform. Level.io may later own live device telemetry while the service desk remains authoritative for business identity and placement. Asset and history rows cannot be hard-deleted through supported workflows.
- **Evidence:** `docs/asset-inventory.md`, migration `20260904160116_step_15_asset_inventory`, asset policy/service modules, asset routes and interfaces, and Step 15 tests/status evidence.

- **Supersedes:** ADR-001 only where it described attachment storage as proposed or undecided.
