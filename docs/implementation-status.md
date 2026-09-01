# Peter Island Resort and Spa IT Service Desk — Implementation Status

Last updated: 2026-09-01

## Status definitions

- `Not started`: no implementation work has begun.
- `In progress`: work has begun but the completion evidence is incomplete.
- `Approval pending`: preparatory work is complete, but an approval-gated dependency remains.
- `Complete`: the stated outcome and its verification evidence are present.
- `Blocked`: work cannot safely continue without a required input.

## Playbook steps

| Step                                                   | Outcome                                                                     | Status           | Dependencies                                                                                         | Evidence of completion                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------ | --------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Inspect the project and establish delivery controls | Understand the repository and create the implementation tracking documents. | Approval pending | The project blueprint must be supplied or located, and the architecture checkpoint must be approved. | Repository instructions, tracked files, history, working tree, remote, framework/dependency manifests, tests, and deployment files inspected on 2026-08-30. Delivery controls created in `docs/implementation-status.md`, `docs/decision-log.md`, `docs/open-questions.md`, and `docs/system-context.md`. Findings are recorded below.                                                                                                                                                   |
| 2. Bootstrap the application and quality gates         | Deliver a clean, runnable application shell with reliable developer checks. | Complete         | ADR-002.                                                                                             | Next.js App Router site, `/health`, branded not-found state, approved portable design reference, pinned dependencies and lockfile, strict TypeScript, Tailwind CSS, shadcn/ui convention, Prettier, ESLint, Vitest, setup guide, and environment template added. All checks and live route verification passed on 2026-08-30.                                                                                                                                                            |
| 3. Verify the setup and approved frontend baseline     | Confirm the application is stable before backend behavior is introduced.    | Complete         | ADR-003, ADR-004, and ADR-005; the approved files in `design-prototype 2/`.                          | Reverified at commit `ba8e67a` on 2026-08-31. Repository state, four service-desk routes, design system, environment boundary, scripts, tests, and exact installed dependency versions were audited. Formatting, linting, strict type checking, 9 tests, the production build, local route responses, navigation targets, accessibility names, focus treatment, touch-target rules, overflow guards, and responsive rules passed. See the Step 3 evidence and `docs/design-contract.md`. |
| 4. Establish the persistent data foundation            | Create a safe PostgreSQL and Prisma baseline before domain persistence.     | Complete         | ADR-007 and ADR-008.                                                                                 | PostgreSQL 17.11 Compose infrastructure, Prisma 7.10, private `service_desk` schema, initial migration, guarded empty reset/test workflows, repositories, server/public environment validation, and six self-contained database constraint tests are present. Clean development and test databases were migrated, tested, and reset on 2026-08-31. The same empty foundation was migrated and verified in the approved Supabase project.                                                 |
| 5. Establish authentication and managed onboarding     | Authenticate managed users and map provider identities to domain access.    | Complete         | Supabase Auth and the Step 4 identity foundation.                                                    | Supabase SSR sessions, Auth UUID mapping, forced initial password change, MFA-gated administrator provisioning, SMTP delivery boundary, RLS, and narrowly granted RPCs are implemented. The first administrator is mapped and remains subject to the initial-password gate.                                                                                                                                                                                                              |
| 6. Establish server-side access boundaries             | Prove explicit allow and deny behavior before business data is added.       | Complete         | ADR-011 and `docs/role-permission-matrix.md`.                                                        | Six canonical roles, 15 explicit permissions, organisation/property/owner/department object checks, server route guards, database-enforced audit retrieval, privacy-bounded append-only audit events, and the privileged `/admin/audit` view are implemented. Eight application test files/44 tests and eight database constraint tests pass; the clean migration is applied locally and in Supabase.                                                                                    |
| 7. Make configuration values administrator-managed     | Let administrators manage resort hierarchy and service taxonomy in product. | In progress      | Step 6 access boundaries and a runnable PostgreSQL verification target.                              | Prisma models, a reviewed Step 7 migration, configuration services, audited mutation route, administrator `/admin/configuration` interface, fictional resort hierarchy seeds, useful IT categories/subcategories, and focused tests are added on 2026-09-01. Prettier, ESLint, strict TypeScript, 9 application test files/45 tests, and the production build pass. Local database migration and `pnpm test:database` verification remain blocked here because Docker/PostgreSQL is unavailable (`docker: command not found`, `ECONNREFUSED 127.0.0.1:54329`). |

Steps 1 through 3 have been supplied. Add each later numbered step here before starting it so the status register remains complete.

## Step 7 implementation evidence

- Added administrator-managed `building_areas`, `service_locations`, `support_teams`, `ticket_categories`, and `ticket_subcategories` plus scoped relationships in Prisma. Existing `properties` and `departments` now use active-only uniqueness enforced in SQL so inactive historical values can remain referenced without blocking replacement values.
- Added reviewed migration `20260901120000_step_7_configuration_taxonomy` with tenant-safe foreign keys, active-only unique indexes, `updated_at` triggers, and fictional Peter Island resort hierarchy seeds for areas, villas, operational locations, departments, support teams, categories, and subcategories.
- Added a server-side configuration service and repository that enforce `configuration.manage`, require AAL2, validate codes/names/timezones, reject invalid hierarchy links, reject duplicate active values in scope, block parent deactivation while active dependents remain, and write audit events for create, update, and deactivate actions.
- Added `/admin/configuration` and `/auth/admin-configuration`, plus administration-shell navigation, sectioned create/edit/deactivate workflows, scoped parent selectors, state badges, and feedback states using the established design tokens and existing shell/table primitives.
- Added application coverage for the configuration navigation entry and a focused database/service suite for permissions, validation, hierarchy, duplicates, deactivation, and audit recording.
- Verification on 2026-09-01: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` passed. `pnpm test:database` could not run in this environment because no local PostgreSQL runtime was available and `pnpm db:up` failed with `docker: command not found`.

## Step 6 completion evidence

- Replaced legacy `staff` and `admin` keys in place with `requester` and `system_administrator`, preserving all existing role-assignment IDs. Hosted readback confirms the first administrator now maps to `system_administrator`.
- Added Technician, IT Manager, System Administrator, Auditor / Report Viewer, and dormant Department Approver policy definitions. The administrator provisioning form exposes only roles with complete property scope; Department Approver remains unassignable until department scope is approved.
- `requireCurrentAccess` protects ticket submission, own-ticket, technician queue, user administration, and audit routes on the server. The user-provisioning mutation repeats permission and AAL2 checks, while PostgreSQL RPCs independently enforce identity, active status, role, organisation, and safe bounds.
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
- No authentication, database, Supabase schema, backend persistence, Microsoft integration, or live Level.io connection was introduced.

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
- Added the private `service_desk` schema with organisations, properties, departments, users, roles, property-scoped user roles, and append-only audit events. No ticket, asset, notification, SLA, Microsoft, or Level.io table exists.
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
- the remaining baseline decisions—hosting target, Microsoft tenant approach, storage provider, queue technology, and property model—are approved; and
- `docs/decision-log.md` and `docs/system-context.md` are updated from proposed/unknown to accepted/confirmed.
