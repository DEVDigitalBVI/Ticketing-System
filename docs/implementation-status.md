# Peter Island Resort and Spa IT Service Desk — Implementation Status

Last updated: 2026-09-04

## Status definitions

- `Not started`: no implementation work has begun.
- `In progress`: work has begun but the completion evidence is incomplete.
- `Approval pending`: preparatory work is complete, but an approval-gated dependency remains.
- `Complete`: the stated outcome and its verification evidence are present.
- `Blocked`: work cannot safely continue without a required input.

## Playbook steps

| Step                                                     | Outcome                                                                                | Status           | Dependencies                                                                                                                | Evidence of completion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Inspect the project and establish delivery controls   | Understand the repository and create the implementation tracking documents.            | Approval pending | The project blueprint must be supplied or located, and the architecture checkpoint must be approved.                        | Repository instructions, tracked files, history, working tree, remote, framework/dependency manifests, tests, and deployment files inspected on 2026-08-30. Delivery controls created in `docs/implementation-status.md`, `docs/decision-log.md`, `docs/open-questions.md`, and `docs/system-context.md`. Findings are recorded below.                                                                                                                                                                                                                                                                                         |
| 2. Bootstrap the application and quality gates           | Deliver a clean, runnable application shell with reliable developer checks.            | Complete         | ADR-002.                                                                                                                    | Next.js App Router site, `/health`, branded not-found state, approved portable design reference, pinned dependencies and lockfile, strict TypeScript, Tailwind CSS, shadcn/ui convention, Prettier, ESLint, Vitest, setup guide, and environment template added. All checks and live route verification passed on 2026-08-30.                                                                                                                                                                                                                                                                                                  |
| 3. Verify the setup and approved frontend baseline       | Confirm the application is stable before backend behavior is introduced.               | Complete         | ADR-003, ADR-004, and ADR-005; the approved files in `design-prototype 2/`.                                                 | Reverified at commit `ba8e67a` on 2026-08-31. Repository state, four service-desk routes, design system, environment boundary, scripts, tests, and exact installed dependency versions were audited. Formatting, linting, strict type checking, 9 tests, the production build, local route responses, navigation targets, accessibility names, focus treatment, touch-target rules, overflow guards, and responsive rules passed. See the Step 3 evidence and `docs/design-contract.md`.                                                                                                                                       |
| 4. Establish the persistent data foundation              | Create a safe PostgreSQL and Prisma baseline before domain persistence.                | Complete         | ADR-007 and ADR-008.                                                                                                        | PostgreSQL 17.11 Compose infrastructure, Prisma 7.10, private `service_desk` schema, initial migration, guarded empty reset/test workflows, repositories, server/public environment validation, and six self-contained database constraint tests are present. Clean development and test databases were migrated, tested, and reset on 2026-08-31. The same empty foundation was migrated and verified in the approved Supabase project.                                                                                                                                                                                       |
| 5. Establish authentication and managed onboarding       | Authenticate managed users and map provider identities to domain access.               | Complete         | Supabase Auth and the Step 4 identity foundation.                                                                           | Supabase SSR sessions, Auth UUID mapping, forced initial password change, permission-gated administrator provisioning, SMTP delivery boundary, RLS, and narrowly granted RPCs are implemented. The first administrator is mapped and remains subject to the initial-password gate.                                                                                                                                                                                                                                                                                                                                             |
| 6. Establish server-side access boundaries               | Prove explicit allow and deny behavior before business data is added.                  | Complete         | ADR-011 and `docs/role-permission-matrix.md`.                                                                               | Six canonical roles, 15 explicit permissions, organisation/property/owner/department object checks, server route guards, database-enforced audit retrieval, privacy-bounded append-only audit events, and the privileged `/admin/audit` view are implemented. Eight application test files/44 tests and eight database constraint tests pass; the clean migration is applied locally and in Supabase.                                                                                                                                                                                                                          |
| 7. Make configuration values administrator-managed       | Let administrators manage resort hierarchy and service taxonomy in product.            | In progress      | Step 6 access boundaries and a runnable PostgreSQL verification target.                                                     | Prisma models, a reviewed Step 7 migration, configuration services, audited mutation route, administrator `/admin/configuration` interface, fictional resort hierarchy seeds, useful IT categories/subcategories, and focused tests are added on 2026-09-01. Prettier, ESLint, strict TypeScript, 9 application test files/45 tests, and the production build pass. Local database migration and `pnpm test:database` verification remain blocked here because Docker/PostgreSQL is unavailable (`docker: command not found`, `ECONNREFUSED 127.0.0.1:54329`).                                                                 |
| 8. Establish the core ticket domain and lifecycle        | Create the ticket schema, append-only history, and server-side workflow.               | In progress      | Step 7 configuration taxonomy and a runnable PostgreSQL verification target.                                                | Prisma ticket models, reviewed migration `20260901153000_step_8_ticket_domain`, ticket workflow/validation services, append-only history triggers, and lifecycle tests were added on 2026-09-01. `pnpm db:validate`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` passed. Local database migration and `pnpm test:database` remain blocked because nothing is listening on `127.0.0.1:54329` in this environment.                                                                                                                                                                                              |
| 9. Connect the approved new-ticket workflow              | Submit one real authenticated ticket through the existing staff form.                  | In progress      | Step 8 ticket services and a runnable PostgreSQL verification target.                                                       | The approved `/new-ticket` interface now loads active controlled options, posts to `/auth/new-ticket`, validates and de-duplicates submissions server-side, and shows the real ticket number after success. `pnpm db:validate`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` passed on 2026-09-01. End-to-end local database verification remains blocked because no PostgreSQL listener is reachable at `127.0.0.1:54329` in this environment.                                                                                                                                                                |
| 10. Connect the requester ticket workspace               | Let requesters safely track and discuss only their own work.                           | In progress      | Step 8 ticket services, Step 9 authenticated submission flow, and a runnable PostgreSQL verification target.                | The approved `/my-tickets` experience now loads authorized server data, enforces requester-or-affected-user object access, filters public history from internal records, supports replies and resolution confirmation through `/auth/my-ticket`, and preserves the approved layout. `pnpm db:validate`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` passed on 2026-09-01. Local database-backed verification remains blocked while no PostgreSQL listener is reachable at `127.0.0.1:54329` in this environment.                                                                         |
| 11. Connect the technician queue and assignment workflow | Let technicians operate the live queue without leaving the approved dashboard.         | In progress      | Step 8 ticket services, Step 9 submission flow, Step 10 requester workspace, and a runnable PostgreSQL verification target. | The approved `/technician` workspace now loads persistent queue data with server-side views, pagination, and real ticket detail; it supports assignment, reassignment, claim, audit/activity recording, and optimistic conflict protection through `/auth/technician-ticket`. `pnpm db:validate`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` passed on 2026-09-01. Local database-backed verification remains blocked while no PostgreSQL listener is reachable at `127.0.0.1:54329` in this environment.                                                                               |
| 13. Make urgency and service targets measurable          | Apply deterministic priority and SLA targets without rewriting ticket history.         | Complete         | Core ticket lifecycle and technician/requester workspaces.                                                                  | Versioned immutable policy records, ticket snapshots/deadlines, the complete configured P1–P4 matrix, validated IANA time zones and support calendars, waiting-state pause/resume, reopen behavior, first-response tracking, background-safe evaluation, live queue indicators, and requester expectations are implemented. Prisma validation, formatting, lint, type checking, 18 test files/99 tests, and the production build passed on 2026-09-04. Hosted migration was intentionally not attempted because the hosted project has not received prerequisite Steps 7 and 8 and this run was explicitly limited to Step 13. |
| 14. Add private ticket attachments                       | Support screenshots and documents without exposing private files.                      | Complete         | Step 8 attachment metadata and ticket authorization; approved Supabase Storage provider.                                    | A private bucket migration, opaque random object keys, server-authorized uploads and streamed downloads, byte-signature/type/size enforcement, safe filenames, ticket/uploader binding, quarantine and scan states, race-safe abandoned/retention cleanup, privacy-bounded events, and restrained staff/technician controls are implemented. Verification on 2026-09-04 covers 21 files/115 tests. Hosted migration remains ordered behind unapplied Steps 7 and 8.                                                                                                                                                            |
| 15. Create the business asset inventory                  | Trace resort assets, responsibility, lifecycle, and historical moves.                  | Complete         | Steps 6 and 7 authorization and resort hierarchy.                                                                           | Asset, type, status, assignment, immutable location history, vendor, procurement/warranty, and external-link models; property-scoped read/manage services; list/detail/create/edit/transfer/assign/retire UI; audit events; and tests are implemented. Prisma validation, formatting, lint, type checking, 23 test files/126 tests, and the production build pass. Hosted migration remains ordered behind unapplied prerequisites; Level.io is intentionally not connected.                                                                                                                                                   |
| 17. Make asynchronous work reliable                      | Commit domain events atomically and process retryable work without duplicate results.  | Complete         | PostgreSQL foundation, server authorization, and versioned migrations.                                                      | A PostgreSQL-native transactional outbox, leased skip-locked jobs, bounded deterministic retry, interruption recovery, durable effect idempotency, attempt/dead-letter history, audited replay, safe structured logs, independent worker process, four provider-neutral categories, and authorised operations view are implemented. `pnpm check` passes with 26 files/133 tests and a production build. The guarded database suite is present and was attempted, but the configured local PostgreSQL listener is unavailable; hosted migration remains ordered behind unapplied prerequisites.                                 |
| 20. Isolate and verify Level.io access                   | Establish a documented, server-only provider boundary before any data synchronization. | Complete         | Existing server secret convention and administrator authorization.                                                          | Current official API/OpenAPI/webhook documentation is recorded; a typed read-only client implements raw-key authentication, response validation, cursor pagination, timeouts, bounded retries, capped `Retry-After`, correlation IDs, safe errors, and redacted logs. `/admin/configuration` shows key status and an administrator-only one-device health read. `pnpm check` passes with 28 files/145 tests and a production build. No key is present in this environment, so live tenant scope remains explicitly unverified; no devices, webhooks, links, or actions were added.                                             |
| 21. Link Level inventory to resort assets                | Synchronize approved remote identity without overwriting business ownership.           | Complete         | Steps 15, 17, and 20; a tenant-bound read-only Level credential in deployment.                                              | Curated Level device snapshots, immutable stable IDs, checksums, per-attempt runs, deterministic external-link/unique-serial matching, administrator reconciliation, complete-run stale marking, partial failure, scheduled/manual outbox jobs, and idempotent database constraints are implemented. Prisma validation/generation, formatting, lint, strict type checking, 31 application test files/157 tests, and the production build pass. The guarded database suite was attempted but no local PostgreSQL listener is available; the hosted migration remains ordered behind unapplied prerequisites.                    |

Steps 1 through 3 have been supplied. Add each later numbered step here before starting it so the status register remains complete.

## Step 21 implementation evidence

- Migration `20260904173820_step_21_level_inventory_sync` adds organisation-scoped Level inventory snapshots and retained synchronization-attempt records. Stable Level identity, SHA-256 checksum format, state consistency, tenant-consistent foreign keys, nonnegative run counts, immutable identity/history triggers, reconciliation indexes, and unique device/link constraints are enforced in PostgreSQL.
- The worker consumes `synchronization.level_inventory` jobs from the Step 17 transactional outbox. Manual administrator requests and hourly UTC schedule buckets are idempotent; the tenant binding is checked before provider access. Cursor pagination, controlled Level-client retries, per-device isolation, partial-run retry/dead-letter behavior, and complete-run-only stale marking are implemented without implicit local-time calculations.
- Matching resolves an existing `ExternalSystemLink` first, then exactly one case-insensitive normalized serial. Duplicate candidates and assets already linked to another Level ID become ambiguous. Hostname is never a key, no asset is created, and sync writes only Level-owned snapshot fields. Renames retain the stable record; replacement hardware remains separate.
- `/admin/integrations/level` repeats `configuration.manage`, exposes only organisation-scoped problem records and retained run summaries, queues manual sync through a same-origin route, and performs conflict-checked audited manual linking. The existing service-desk hierarchy and components are preserved.
- Clock-controlled fixtures cover exact tenant access, repeated multi-page jobs, duplicate serials, renames, replacements, partial failures, and stale/no-stale boundaries. The database suite includes the checkpoint assertion that a repeated production-store sync leaves exactly one device, one pre-existing asset, and one external link.
- Final application verification on 2026-09-04: Prisma validation/generation, Prettier, ESLint, strict TypeScript, 31 test files/157 tests, and the Next.js production build pass. `npm run test:database` was rerun with required IPC access and reached the guarded test workflow, but failed at `ECONNREFUSED 127.0.0.1:54329` because no PostgreSQL service is running.
- Supabase MCP was reconnected read-only to active/healthy project `zwcmljkjoxrfzfyphdtc`. Its migration history still ends at Step 6, so Step 21 was deliberately not applied ahead of Steps 7, 8, 15, and 17. The existing hosted security advisor reports only the previously known leaked-password-protection warning ([remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)); performance notices are unused indexes on the nearly empty foundation.

## Step 20 implementation evidence

- Official Level-owned API getting-started, developer reference, v2 OpenAPI, webhook developer, and webhook settings documents were inspected on 2026-09-04 before implementation. `docs/integrations/level.md` records confirmed endpoints, raw `Authorization` key format, read-only/read-write key permission levels, cursor pagination, the absence of a published numeric rate ceiling, `Retry-After`, eight webhook events, signature/retry behavior, and tenant-specific unknowns.
- `LevelClient` is server-only and fixes production requests to `https://api.level.io/v2`. It validates the device-list envelope, supports guarded forward pagination, applies per-attempt abort timeouts, retries only network/timeout/429/5xx failures within strict attempt/wait bounds, distinguishes safe failure codes, and never logs keys, headers, URLs, device payloads, or provider bodies.
- `LEVEL_API_KEY` extends the established server environment secret convention and is never exposed with a browser-safe prefix. The repository contains only an empty example value. This environment has no key, so no live provider request was attempted and tenant scope is not fabricated.
- `/admin/configuration` retains the established administrative hierarchy while showing configured/unconfigured state, fixed API boundary, required read-only access, and enabled behavior. Its same-origin health-check route repeats `configuration.manage`, fetches at most one device, discards the payload, and records only capability/latency or a controlled error code in audit evidence.
- No production code invokes full pagination, stores or synchronizes devices, registers or receives webhooks, constructs a deep link, calls a write method, or exposes a remote action.
- Fixture tests prove the raw non-Bearer header, one-record health read, immediate 401/403 handling, bounded throttling and `Retry-After`, timeout abort, malformed-response rejection, cursor pagination, redacted logs, same-origin enforcement, administrator authorization, safe redirects, and privacy-bounded audit records.
- Final verification on 2026-09-04: `pnpm check` passed formatting, ESLint, strict TypeScript, 28 application test files/145 tests, Prisma generation, and the Next.js production build including `/auth/level-health`.

## Step 17 implementation evidence

- Migration `20260904162215_step_17_transactional_outbox_jobs` and Prisma models add immutable outbox events, durable jobs, one-row-per-attempt history, dead-letter state, replay ancestry, and an organisation-scoped unique effect ledger. Partial indexes support pending outbox, ready work, expired leases, and failed-job inspection.
- `commitWithOutbox` writes a domain mutation and its event in one database transaction. Dispatch uses a short skip-locked transaction; claims use a bounded lease and unique token. Recovery marks an abandoned attempt `interrupted`, and token-conditional completion prevents a stale worker from committing.
- The worker applies a deterministic 5-second exponential backoff capped at 15 minutes, defaults to five attempts, sanitizes failures, and retains the final failed job. Existing effect keys bypass handler execution, while completion, effect record, and attempt outcome commit together.
- Notification, SLA evaluation, synchronization, and webhook categories exist behind provider-neutral handler boundaries. No external notification, synchronization, or webhook provider is connected in this step.
- `pnpm worker` runs the independent process and handles SIGINT/SIGTERM. `docs/background-jobs.md` documents local and deployed process topology, retry/recovery semantics, idempotency responsibilities, monitoring signals, safe logs, and provider boundaries. ADR-014 records the PostgreSQL-native mechanism.
- `/admin/jobs` preserves the established administration hierarchy and shows organisation-scoped pending-event/job counts, oldest undispatched and queued ages, and safe dead-letter summaries. IT Managers and Report Viewers can inspect; only System Administrators can replay, and replay emits a privacy-bounded audit event.
- Clock-controlled synthetic tests prove exact backoff boundaries, bounded failure, duplicate suppression, lost-lease handling, and safe logging. The database suite additionally covers atomic rollback, skip-locked dispatch, exact retry availability, expired-lease recovery, dead-letter, replay, and effect deduplication.
- Final application verification on 2026-09-04: Prisma format/validation/generation passed; `pnpm check` passed formatting, ESLint, strict TypeScript, 26 application test files/133 tests, and the Next.js production build. The guarded `pnpm test:database` run was attempted and reached `ECONNREFUSED 127.0.0.1:54329` because no local PostgreSQL service is running.
- The approved Supabase project was rechecked through MCP. Its migration history still ends at Step 6, so Step 17 was not applied out of order. Advisor output remains the pre-existing leaked-password-protection warning and informational unused-index notices on the empty foundation; Step 17 introduces no hosted finding because its tables are not deployed there yet.

## Step 15 implementation evidence

- Migration `20260904160116_step_15_asset_inventory` and Prisma models add business-owned assets, controlled type/status records, current hierarchy/custodian fields, assignment intervals, append-only from/to location history, vendors, one-to-one procurement and warranty context, and namespaced external-system links.
- Resort asset tags remain separate from manufacturer serial numbers and external-system IDs. Case-insensitive organisation uniqueness protects tags and known serials; external identity uniqueness is scoped by organisation and system.
- The initial controlled types cover workstations, laptops, printers, network equipment, phones, point-of-sale devices, televisions, audio-visual equipment, servers, and shared devices. Lifecycle states cover in stock, deployed, repair, retired, and disposed.
- `/assets`, `/assets/new`, `/assets/[assetId]`, and `/assets/[assetId]/edit` provide property-scoped list, detail, create, edit, transfer, assignment, retirement, and history workflows using the established shell, panels, fields, status treatments, and responsive hierarchy.
- Technicians use `asset.read`; IT managers and system administrators use `asset.manage`. Every mutation revalidates tenant/property scope and active hierarchy references, applies optimistic concurrency, and records a privacy-bounded audit event.
- Cross-property moves require authority in both properties and end the previous assignment. Retirement preserves the record and history; database triggers prohibit asset deletion and history rewriting.
- `docs/asset-inventory.md` identifies the source of truth for every major field. Level.io remains an explicit future owner of live telemetry only and is not connected.
- Application verification on 2026-09-04 passed Prisma validation/generation, formatting, ESLint, strict TypeScript, 23 test files/126 tests, and the Next.js production build. The database suite includes Step 15 migration, uniqueness, history, retirement, and hard-delete guards, but its guarded run stopped at `ECONNREFUSED 127.0.0.1:54329` because no local PostgreSQL service is running.
- The approved Supabase project was checked through MCP: its migration history still ends at Step 6, so Step 15 was not applied out of order. The current advisor output has one pre-existing leaked-password-protection warning and informational unused-index notices on empty foundation tables; no Step 15 tables exist there yet to advise on.

## Step 14 implementation evidence

- Supabase Storage is recorded as the approved provider. Migration `20260904154437_step_14_private_ticket_attachments` creates or hardens the non-public `ticket-attachments` bucket with a 10 MiB provider-side limit and the same controlled MIME allowlist as the server.
- Uploads and downloads are server-only flows. They reload the ticket and apply existing organisation/property/owner/affected-user/department/technician rules on every operation. Direct object policies are intentionally absent, object keys are opaque UUID paths, and downloads expose neither storage paths nor signed URLs.
- PNG, JPEG, WebP, PDF, and UTF-8 TXT inputs require agreement between byte signature/content, declared MIME type, and safe extension. Filenames are normalized and display-only. The immutable metadata identity stores the ticket, uploader, visibility, byte count, detected type, SHA-256 checksum, and random object path.
- Files are quarantined in `pending` scan state. Because no malware scanner is currently operated, only the uploader can download pending or failed-scan files; infected files are blocked for everyone. Clean files remain subject to ticket authorization.
- Explicit-clock cleanup functions atomically claim and remove one-hour abandoned uploads and 365-day expired objects in retry-safe batches while retaining lifecycle metadata. Transitional states prevent cleanup from racing upload completion. Activity/audit evidence omits file contents, object paths, credentials, signed URLs, and raw provider errors.
- Staff and technician ticket panels now list and upload attachments using the existing context-panel hierarchy and semantic styles. Internal visibility is available only to technicians; locked and quarantine states have textual labels.
- Tests cover unauthenticated and unauthorized access, guessed identifiers, opaque keys, traversal-safe filenames, spoofed types, exact size bounds, quarantine, infected files, streamed non-cacheable responses, abandoned uploads, and retention boundaries.
- Final verification on 2026-09-04: `pnpm check` passed, including Prisma generation/validation, formatting, ESLint, strict TypeScript, 21 test files/115 tests, and the Next.js production build. The guarded `pnpm test:database` run was attempted and stopped at `ECONNREFUSED 127.0.0.1:54329`; no local PostgreSQL service is running. The hosted database and bucket were not mutated because the hosted schema lacks prerequisite Steps 7 and 8 and this run is explicitly Step 14 only.

## Step 13 implementation evidence

- Added immutable, property-scoped SLA policy versions with one active version per property. Each new ticket stores the applied policy identity, version, complete JSON snapshot, response deadline, and resolution deadline; later policy versions cannot alter that history.
- The approved default policy uses `America/Tortola`, Monday–Friday 08:00–17:00 support hours, configured holiday dates, a 30-minute warning threshold, response targets of 15/30/120/240 support minutes for P1–P4, and resolution targets of 120/240/480/960 support minutes.
- First technician public response completes the response clock. `waiting_for_requester` and `waiting_for_vendor` pause open clocks; resumption preserves the exact remaining support duration. Reopen behavior is independently configurable as `reset` or `preserve` for response and resolution.
- Technician views show separate response/resolution states and exact deadlines in the policy timezone. At-risk and breached tabs are derived from the stored ticket snapshot. Staff see plain-language expectations without internal SLA terminology or internal notes.
- Clock-controlled coverage proves all 16 configured priority combinations, time zones, support hours, weekday rollover, weekends, holidays, pause/resume, immutable policy snapshots, reopen modes, and exact warning/breach boundaries. Policy parsing also rejects invalid IANA zones, fully closed schedules, reversed windows, and overlapping windows. No SLA function reads the server's local timezone or current clock implicitly.
- Verification on 2026-09-04: `pnpm db:validate`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (18 files/99 tests), and `pnpm build` passed. The hosted `Ticketing System` project is reachable, but its schema currently ends at Step 6; applying prerequisite Steps 7 and 8 or writing to the unrelated MCP-scoped project would violate this run's Step 13-only boundary. The Step 13 migration therefore remains reviewed and ready for the normal forward-only deployment sequence rather than being applied out of order.

## Step 7 implementation evidence

- Added administrator-managed `building_areas`, `service_locations`, `support_teams`, `ticket_categories`, and `ticket_subcategories` plus scoped relationships in Prisma. Existing `properties` and `departments` now use active-only uniqueness enforced in SQL so inactive historical values can remain referenced without blocking replacement values.
- Added reviewed migration `20260901120000_step_7_configuration_taxonomy` with tenant-safe foreign keys, active-only unique indexes, `updated_at` triggers, and fictional Peter Island resort hierarchy seeds for areas, villas, operational locations, departments, support teams, categories, and subcategories.
- Added a server-side configuration service and repository that enforce `configuration.manage`, validate codes/names/timezones, reject invalid hierarchy links, reject duplicate active values in scope, block parent deactivation while active dependents remain, and write audit events for create, update, and deactivate actions.
- Added `/admin/configuration` and `/auth/admin-configuration`, plus administration-shell navigation, sectioned create/edit/deactivate workflows, scoped parent selectors, state badges, and feedback states using the established design tokens and existing shell/table primitives.
- Added application coverage for the configuration navigation entry and a focused database/service suite for permissions, validation, hierarchy, duplicates, deactivation, and audit recording.
- Verification on 2026-09-01: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` passed. `pnpm test:database` could not run in this environment because no local PostgreSQL runtime was available and `pnpm db:up` failed with `docker: command not found`.

## Step 8 implementation evidence

- Added `Ticket`, `TicketActivity`, `TicketComment`, `TicketAssignment`, and `AttachmentMetadata` to Prisma with tenant-safe foreign keys back to users, resort hierarchy, and service taxonomy records. Ticket history relations are append-only by design.
- Added reviewed migration `20260901153000_step_8_ticket_domain` with the `service_desk.ticket_number_seq` sequence, `PIR-######` ticket numbering trigger, scoped indexes, status/value constraints, resolution and closure checks, and immutable-history triggers for activities, comments, assignments, and attachment metadata.
- Added `src/server/tickets/workflow.ts` for canonical statuses, allowed transitions, and permission-aware read/comment/assign/transition checks.
- Added `src/server/tickets/service.ts` and `src/server/repositories/ticket-repository.ts` for validated ticket creation, assignment, requester-visible comments, internal notes, state transitions, assignment history, and audit recording. Ticket creation now requires `ticket.submit`, and pre-assignment during creation also requires `ticket.assign`.
- Added `tests/ticket-workflow.test.ts` to cover every allowed and denied lifecycle transition plus permission rules.
- Added `tests/database/ticket-domain.test.ts` to cover ticket identifiers, direct database constraints, requester-visible versus internal comment behavior, assignment history, lifecycle progression and reopening, immutable history tables, and service-level read guards.
- Verification on 2026-09-01: `pnpm db:validate`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` passed. `pnpm test:database` did not complete because the configured local PostgreSQL target `127.0.0.1:54329` is not reachable in this environment.

## Step 9 implementation evidence

- Connected the existing approved `/new-ticket` page to the Step 8 ticket-creation service through the new authenticated route handler `src/app/auth/new-ticket/route.ts`.
- Added `src/server/tickets/intake.ts` to load active property, service location, department, category, and subcategory options within the signed-in user's scope, validate the submitted form payload, reject unsafe text and unauthorized affected-user overrides, and apply duplicate-submission protection through a short-lived HTTP-only cookie fingerprint.
- Updated `src/modules/service-desk/components/new-ticket-form.tsx` to preserve the approved layout while posting real form data, filtering dependent selects client-side, collecting both impact and urgency, and showing the real ticket number plus the next action in the existing success treatment.
- Added route and intake coverage for successful creation, field validation, authorization denial, tampered affected-user rejection, duplicate submission handling, and the success treatment copy.
- Verification on 2026-09-01: `pnpm db:validate`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` passed. A true end-to-end database-backed submission could not be executed here because the configured local PostgreSQL target `127.0.0.1:54329` is not reachable.

## Step 10 implementation evidence

- Replaced the mock `/my-tickets` content with `src/server/tickets/requester-portal.ts`, which loads only tickets the signed-in user requested or is the approved affected user for, applies server-side active/completed/all filters, trims search input, paginates on the server, and maps canonical workflow states to staff-readable language without exposing internal-only records.
- Added the authenticated mutation route `src/app/auth/my-ticket/route.ts` so requester-visible replies and resolution confirmation are validated and executed server-side with same-origin protection, generic failure handling, and audit recording for confirmation.
- Updated the approved ticket workspace components to render real list data, a staff-facing detail panel, requester-visible timeline entries, reply and confirmation actions, selected-ticket state, and pagination while preserving the established shell, tokens, and content style.
- Added coverage for authorized page rendering plus requester-portal authorization, pagination, cross-user isolation, public-versus-internal history, direct URL access denial, reply delegation, and resolution confirmation behavior with at least two requester identities.
- Verification on 2026-09-01: `pnpm db:validate`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` passed. The Vitest suite now passes 14 files and 68 tests. As with Steps 7 through 9, local database-backed verification remains blocked in this environment because no PostgreSQL listener is reachable at `127.0.0.1:54329`.

## Step 11 implementation evidence

- Replaced the placeholder technician dashboard with `src/server/tickets/technician-queue.ts`, which loads in-scope persistent tickets, applies the approved Unassigned, My Work, Team Work, Waiting, At Risk placeholder, Breached placeholder, and Recently Resolved server-side views, and paginates/sorts the queue without changing the master-detail layout.
- Added the authenticated technician mutation route `src/app/auth/technician-ticket/route.ts` so claim, assignment, and reassignment requests are validated server-side, protected by same-origin checks, and returned to the queue with success, failure, or conflict feedback states.
- Extended the ticket service and repository so assignment changes write append-only assignment history and audit/activity records while using the ticket `updated_at` value for optimistic conflict protection against two technicians racing the same ticket.
- Updated the `/technician` route and technician workspace components to display the real ticket number, subject, requester, location, category, priority, status, assignee, age, and current service indicator, plus a real detail panel and assignment controls. Level.io and formal SLA timing remain explicit placeholder states.
- Added technician queue coverage for property scope, queue views, assignable-user filtering, support-team filtering, assignment, reassignment, optimistic concurrency, and unauthorized access.
- Verification on 2026-09-01: `pnpm db:validate`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` passed. The Vitest suite now passes 15 files and 75 tests. As with Steps 7 through 10, local database-backed verification remains blocked in this environment because no PostgreSQL listener is reachable at `127.0.0.1:54329`.

## Step 6 completion evidence

- Replaced legacy `staff` and `admin` keys in place with `requester` and `system_administrator`, preserving all existing role-assignment IDs. Hosted readback confirms the first administrator now maps to `system_administrator`.
- Added Technician, IT Manager, System Administrator, Auditor / Report Viewer, and dormant Department Approver policy definitions. The administrator provisioning form exposes only roles with complete property scope; Department Approver remains unassignable until department scope is approved.
- `requireCurrentAccess` protects ticket submission, own-ticket, technician queue, user administration, and audit routes on the server. The user-provisioning mutation repeats permission checks, while PostgreSQL RPCs independently enforce identity, active status, role, organisation, and safe bounds.
- Audit events now require an actor when available, action, target type/ID, result, correlation UUID, timestamp, and an object-shaped context capped at 8 KiB. A recursive database check rejects credential, secret, token, session, cookie, file-content, authorization, and private-provider-payload keys at any nesting depth. Events remain immutable.
- The privileged `/admin/audit` view uses the approved typography, shell, tokens, responsive overflow containment, result states, accessible table caption, and empty state. It receives only a minimal audit DTO; context is not rendered.
- A clean isolated database applied all seven migrations. Database constraints passed 8/8. Prettier, ESLint, strict TypeScript, eight application test files/44 tests, and the production build passed.
- Supabase migration `step_6_authorization_and_audit` applied successfully. Security advisors report only the pre-existing leaked-password-protection configuration warning; performance advisors report expected unused indexes before workload exists.

## Step 1 inspection evidence

### Repository state

- Repository root: `/Users/devdigitalbvi/Developement/Ticketing System`
- Confirmed resort and product owner: `Peter Island Resort and Spa`.
- Git remote: `origin` points to `https://github.com/DEVDigitalBVI/Ticketing-System.git`.
- Branch: `main`, tracking `origin/main`, one local commit ahead and zero behind at inspection time.
- HEAD: `66052eef79c5fe4c0a207ffb7adc9c59cce2edba`.
- Uncommitted tracked or untracked changes reported by Git: none.
- A local `.DS_Store` exists but is excluded by the user's Git ignore configuration and is not tracked.
- Repository instructions (`AGENTS.md` or equivalent): none found.
- Current tracked application files: none.
- Attached/local project blueprint: not found in the repository or conversation payload available to this inspection.

### Current implementation

| Area                | Finding                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework           | None present.                                                                                                                                        |
| Dependency versions | No manifest or lockfile present.                                                                                                                     |
| Project structure   | No application structure present; `docs/` is the first delivery structure added in Step 1.                                                           |
| Existing features   | None in the current tree.                                                                                                                            |
| Tests               | No current test files, runner, or configuration.                                                                                                     |
| Deployment          | No hosting, CI/CD, container, infrastructure, or environment configuration.                                                                          |
| Supabase            | The project is named `Ticketing system`, per the project owner; no local Supabase configuration, schema, migrations, or generated types are present. |

### Relevant history

The repository previously contained a default Swift/Xcode project named `TEST`, including unit and UI test targets. Commit `66052ee` intentionally removed those files and the README. That historical scaffold is not treated as the current framework or as reusable Peter Island Resort and Spa IT Service Desk functionality.

## Step 2 completion evidence

### Delivered foundation

- Runtime: Node.js 24+, Next.js 16.3.3, React 19.2.8, and React DOM 19.2.8.
- Language: strict TypeScript 6.0.3. TypeScript 7 was not selected because the supported TypeScript ESLint 8.68.0 peer range ends below TypeScript 6.1.
- Styling: Tailwind CSS 4.3.3 provides the CSS pipeline and baseline; the approved interface uses explicit design tokens and purpose-built service-desk components.
- Package management: pnpm 11.24.0 with exact dependency versions and `pnpm-lock.yaml`.
- Structure: App Router routes in `src/app`, service-desk domain code in `src/modules/service-desk`, future server infrastructure in `src/server`, tests in `tests`, and delivery controls in `docs`.
- Developer controls: Prettier formatting, ESLint 10 with TypeScript and Next.js Core Web Vitals rules, strict type checking, Vitest/Testing Library unit testing, and a production build gate.
- Runtime configuration: `.env.example` contains only a descriptive public application URL placeholder. No secrets, authentication settings, or backend credentials were added.
- Developer documentation: root `README.md` contains prerequisites, local setup, checks, and project structure.
- Repository guidance: Next.js-generated `AGENTS.md` and `CLAUDE.md` keep future work aligned with the installed framework documentation.
- Production design: the full foundation experience now includes a shared resort frame, multi-section home page, reusable health panel, dedicated health route, and branded not-found state.
- Design handoff: the supplied `design-prototype 2/` reference is retained unchanged; the superseded coastal artifact has been removed.

### Verification results

| Check               | Result                                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format:check` | Passed; every matched file uses Prettier formatting.                                                                                                                   |
| `pnpm lint`         | Passed with ESLint 10.9.1, TypeScript ESLint 8.68.0, and Next.js 16.3.3 Core Web Vitals rules.                                                                         |
| `pnpm typecheck`    | Passed under strict TypeScript with no emitted files.                                                                                                                  |
| `pnpm test`         | Passed: two test files covering the home and health experiences.                                                                                                       |
| `pnpm build`        | Passed; `/`, `/_not-found`, and `/health` were statically prerendered.                                                                                                 |
| Local runtime       | `next dev` became ready on `127.0.0.1:3000`; `/` and `/health` returned HTTP 200 with their expected content, and an unknown route returned the branded HTTP 404 page. |

No ticketing feature, authentication flow, database model, Supabase configuration, remote schema change, or deployment was added in Step 2.

## Approved frontend design implementation

- Implemented the approved four-view service desk design as reusable Next.js App Router routes: `/`, `/new-ticket`, `/my-tickets`, and `/technician`.
- Preserved the reference design tokens, Avenir-style typography stack, 264-pixel graphite navigation rail, warm neutral canvas, surface contrast, spacing, radii, shadows, desktop master-detail layout, and mobile breakpoints.
- Added a shared responsive navigation shell, staff overview, guided ticket form, staff ticket filters, typed mock ticket data, technician priority queue, dynamic selected-ticket context, and a display-only Level.io device panel.
- Added local-only interactions for the mobile drawer, ticket form selection and character count, success feedback, ticket filters/search, and technician queue selection.
- Preserved the existing health and not-found routes in the approved visual language.
- Verification on 2026-08-31: Prettier, ESLint, strict TypeScript, nine Vitest tests, and the Next.js production webpack build passed. All four application routes returned HTTP 200 locally.
- Browser-based screenshots were unavailable because no browser instance was connected. The 1440×900 desktop and 390×844 mobile contracts were verified through the approved CSS values and automated responsive-design assertions; visual side-by-side review remains advisable when a browser is available.
- No authentication, database, Supabase schema, backend persistence, or live Level.io connection was introduced.

## Repository cleanup audit

- Completed a full source, configuration, dependency, test, documentation, and reference-artifact audit on 2026-08-31.
- Removed the unreachable coastal-design components, status primitive, class-name utility, stale module placeholder, superseded design artifact, and shadcn configuration.
- Removed six packages used only by that deleted layer: `class-variance-authority`, `clsx`, `lucide-react`, `shadcn`, `tailwind-merge`, and `tw-animate-css`.
- Simplified prototype-era view visibility CSS now that each interface is a real App Router route.
- Fixed staff-ticket deep links so the requested mock ticket opens as the initial technician context, and added cleanup for the form feedback timer.
- Standardized the build script on Next.js's supported webpack builder because the local Turbopack worker cannot bind its internal port in the managed environment.
- The unused-code analyzer reports only the intentionally retained standalone design-reference CSS and JavaScript; the production dependency audit reports no known vulnerabilities.

## Step 3 verification evidence

### Verified baseline

- The working tree was clean before this Step 3 revalidation. The current branch is `main` at commit `ba8e67a4884cce8b44b2c5f4f24a2ed5cd378095`, exactly aligned with `origin/main` before the documentation updates in this run.
- The repository contains one applicable root `AGENTS.md`; its Next.js 16.3.3 guidance and the project documentation were read before verification.
- The installed foundation remains Next.js 16.3.3 App Router, React/React DOM 19.2.8, strict TypeScript 6.0.3, Tailwind CSS 4.3.3, and pnpm 11.24.0. Exact versions remain pinned in `package.json` and `pnpm-lock.yaml`.
- The environment contract remains intentionally narrow: `.env.example` declares only `NEXT_PUBLIC_APP_URL` with a non-secret placeholder. No credential, backend, or integration variable exists.
- The staff overview (`/`), new-ticket interface (`/new-ticket`), staff ticket list (`/my-tickets`), technician workspace (`/technician`), and health page (`/health`) all returned HTTP 200 from the local development server.
- Every production navigation target resolves to an implemented route. Technician deep links preserve the selected mock ticket through the `ticket` query parameter.
- Source and test inspection found descriptive link, button, field, navigation, region, table, and status names; a skip link; programmatic labels; a global visible `:focus-visible` outline; reduced-motion and increased-contrast handling; and interactive hit areas of at least 44 by 44 pixels. The switch's visual thumb is smaller by design, but its enclosing label provides a 66-pixel-high hit area.
- The approved desktop rail, page grids, form layout, technician master-detail workspace, mobile drawer, single-column mobile forms, simplified mobile ticket/queue rows, sticky mobile actions, safe-area padding, and 1100/780/430-pixel breakpoints remain present without redesign. The layout has explicit `min-width: 0`, wrapping, and 320-pixel viewport support to prevent horizontal overflow.
- The prescribed browser connection was retried after the local server became ready, but no browser instance was available. Live console capture, computed-layout measurement, and screenshot-based 1440×900/390×844 comparison therefore could not be repeated. No unrelated browser fallback was substituted. Fidelity evidence consists of direct comparison with the retained approved reference, responsive contract tests, semantic component and CSS inspection, successful static rendering, clean development-server logs, and local route responses.

### Quality-gate results

| Check                       | Result                                                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format:check`         | Passed on 2026-08-31; all matched files conform to Prettier.                                                                       |
| `pnpm lint`                 | Passed on 2026-08-31 with no ESLint errors or warnings.                                                                            |
| `pnpm typecheck`            | Passed on 2026-08-31 under strict TypeScript with no emitted files.                                                                |
| `pnpm test`                 | Passed on 2026-08-31: 4 test files and 9 tests covering core views, interactions, deep links, responsive rules, and accessibility. |
| `pnpm build`                | Passed on 2026-08-31 with Next.js 16.3.3; all 6 built routes, including `/_not-found`, were statically prerendered.                |
| Local development routes    | Passed: `/`, `/new-ticket`, `/my-tickets`, `/technician`, and `/health` each returned HTTP 200.                                    |
| Dependency or feature scope | No dependency, database model, authentication, persistence, backend behavior, or new product feature was added.                    |

No application-code fix was required in Step 3.

## Approved palette update

- On 2026-08-31, the owner approved the Figma palette `#0cdc2a`, `#384166`, `#0b735f`, `#639d75`, and `#e3dba9` as a material update to the frontend design contract.
- The palette is implemented through semantic tokens in `src/app/globals.css`; no layout, typography, responsive behavior, route, component hierarchy, or interaction was redesigned.
- White text retains WCAG AA contrast on indigo and teal. Signal green, sage, and sand are paired with tested dark foregrounds or used as non-text accents. Existing amber and red remain reserved for warning and danger semantics.
- ADR-006 records the approval and `docs/design-contract.md` defines the role of each color.

## Step 4 completion evidence

- Added pinned Prisma 7.10.0, Prisma Client/adapter 7.10.0, `pg` 8.23.0, PostgreSQL configuration validation, and explicit pnpm dependency-build approvals.
- Added `compose.yaml` with the official PostgreSQL `17.11-alpine3.24` image, a persistent development volume, loopback-only port binding, health check, and separately created `resort_service_desk_test` database.
- Added the private `service_desk` schema with organisations, properties, departments, users, roles, property-scoped user roles, and append-only audit events. No ticket, asset, notification, SLA, or Level.io table existed at that boundary.
- UUIDs and timestamps have database defaults. Mutable records receive database-triggered `updated_at` values. Lowercase identifiers, check constraints, tenant-consistent composite foreign keys, explicit delete behavior, and indexes on foreign-key/query paths are present.
- Added typed repositories under `src/server/repositories`; route handlers and React components contain no database queries.
- Browser-safe and server-only configuration are separated. Next.js server instrumentation validates required values before accepting requests and errors identify variable names without exposing values.
- Step 4 originally added a fictional idempotent seed; ADR-009 subsequently retired and removed it at the owner's request.
- Verified a clean isolated development database with migrate, guarded schema reset, and remigrate. Verified the separate test database with reset, migrate, and 6 passing self-contained database constraint tests.
- Docker was not installed in the execution environment, so the Compose service could not be launched here. The same PostgreSQL migration lifecycle was verified with an isolated local Prisma Postgres process; the checked-in Compose file remains the documented developer workflow.
- Formatting, linting, strict type checking, 5 standard test files/12 tests, Prisma validation/generation, 1 database test file/6 constraint tests, migration status/drift checks, and the production build pass.

### Hosted Supabase verification

- Connected through the authenticated Supabase integration to the existing `Ticketing System` project (`zwcmljkjoxrfzfyphdtc`), active in `us-east-1` on PostgreSQL 17.6.
- Confirmed the hosted project had no application tables, migrations, or advisor findings before applying the schema.
- Applied the reviewed identity-foundation SQL as the tracked `step_4_identity_foundation` migration. No development seed data was loaded remotely.
- Verified seven empty tables, 50 constraints, 31 indexes, and eight triggers in the private `service_desk` schema.
- Added and applied `add_user_role_fk_index` after the performance advisor identified the missing covering index for the composite user-role foreign key.
- Re-ran the security and performance advisors after the correction. The security scan has no findings and the missing-foreign-key-index finding is resolved. The remaining performance notices report that indexes are unused, which is expected while every hosted table is empty and is not a reason to remove intentional foreign-key/query-path indexes. The table inspector still recommends RLS as defense in depth; RLS was not enabled without policies because the authentication and authorization model is not yet approved. `anon` and `authenticated` currently have no `USAGE` privilege on `service_desk`, so the schema is not available through the Data API.
- Runtime and direct migration credentials were not copied into the repository. The application remains configured for the local database until server-only hosted connection strings and a least-privilege database role are approved.

## Mock-data removal and application audit

- Removed bundled staff and technician ticket records, fictional profile identity, hard-coded navigation counts, fictional service-health/metric/device claims, and the development seed command/file.
- Staff overview, staff ticket list, technician metrics, queue, selected-ticket context, service monitoring, profile, and Level.io surfaces now render explicit empty or unavailable states without changing the approved route purposes or responsive layout.
- Local reset now recreates an empty migrated schema. Database constraint tests create their own isolated records after the disposable test database is reset and migrated.
- Completed Codex Security Standard scan `95174616-ad7a-4721-9ad2-a1c40ae9d0bb`. The scan found one low-severity target-validation issue in the developer-only reset guard; the guard now rejects target-affecting or ambiguous PostgreSQL query parameters and has regression tests.
- No current web route reaches Prisma, a persisted ticket, an external API, or a privileged action. Missing authentication, authorization, least-privilege runtime roles, and RLS remain mandatory prerequisites before live data is connected, but are not currently exploitable through the static/empty UI.
- Full audit evidence and residual decisions are recorded in `docs/application-audit.md`.
- Final quality gates pass: Prettier, ESLint, strict TypeScript, 5 standard test files/17 tests, Prisma validation/generation, the previously verified database test file/6 constraint tests, and the Next.js production build.
- The production dependency audit reports no known vulnerabilities after pinning `deepmerge-ts` 8.0.0 as a pnpm workspace override. The tracked-file secret scan found only explicit loopback test credentials, and `.env` is ignored.
- Hosted readback confirms all seven foundation tables contain zero rows. Supabase security advisors return no lints and performance advisors only report expected unused indexes. The table inspector flags RLS as disabled; direct privilege checks confirm `anon` and `authenticated` cannot use the schema or read/write its tables. RLS policies and a least-privilege runtime role remain mandatory before live access.
- The development server returned HTTP 200 for all five application routes with clean server logs. Browser discovery found no connected in-app or extension browser, so this pass could not add fresh screenshot, client-console, or computed-layout evidence beyond the existing design-contract tests and prior source review.

## Login interface

- Added a responsive `/login` route that extends the approved indigo, teal, sand, typography, spacing, focus, and minimum-target conventions without changing the service-desk layouts.
- Added accessible work-email/password fields, current-password autofill, visibility control, server submission, and generic live error states.
- Supabase authentication now replaces the former presentation-only handler; the approved composition remains unchanged.
- Prettier, ESLint, strict TypeScript, and 6 test files/21 tests pass after integration.

## Supabase authentication and managed onboarding

- Supabase SSR clients, verified-claim guards, signed-cookie refresh, logout, domain role mapping, forced initial password replacement, other-session revocation, and TOTP enrollment/verification are implemented.
- Account creation requires an MFA-verified administrator. It uses a server-only Supabase secret client, CSPRNG temporary passwords, pinned Nodemailer SMTP, same-origin mutation checks, generic failures, and compensating deletion when profile creation or delivery fails.
- Hosted migrations enable RLS on all seven foundation tables, expose only a security-invoker current-user view, and create narrowly granted RPCs with explicit identity, role, and AAL checks. Hosted reference data is limited to the real resort organization/property and three access roles; there are no users or tickets.
- Local migration deployment and 6 database constraint tests pass. Supabase security advisors have no actionable warning after the explicit audit-event deny policy; unused-index notices are expected before workload exists.
- The initial Jamaal Hodge account is provisioned in Supabase Auth, mapped to the active application `admin` role, and marked for mandatory password replacement. At the owner's repeated request, the supplied credential was used only as the temporary Auth password; it is not stored in the repository and must be replaced at first login.
- A service-role-only, empty-database-only `pnpm bootstrap:admin` workflow is migrated locally and remotely for the first administrator; later users must use the MFA-verified web workflow.
- The secured `api` schema is exposed through hosted PostgREST so `current_user_access` and the narrowly granted RPCs are reachable; the application login handler now verifies the account and redirects it to `/account/change-password`.
- Hosted Auth still reports public sign-up enabled. Unmapped sign-ups cannot pass domain authorization or RLS, but sign-up must be disabled and TOTP/session/password policy pushed after the production application URL is supplied; the checked-in config intentionally remains localhost-safe until then.

## Step 1 completion gate

Step 1 can move from `Approval pending` to `Complete` when:

- the blueprint is supplied and any conflicts are recorded;
- the remaining baseline decisions—hosting target, storage provider, queue technology, and property model—are approved; and
- `docs/decision-log.md` and `docs/system-context.md` are updated from proposed/unknown to accepted/confirmed.
