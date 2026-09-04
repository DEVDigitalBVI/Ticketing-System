# Peter Island Resort and Spa IT Service Desk

This repository contains the approved frontend, PostgreSQL identity foundation, managed Supabase authentication flow, administrator-managed configuration console, the server-side core ticket domain, the authenticated ticket-submission workflow, the requester-facing My Tickets workspace, and the live technician queue for the Peter Island Resort and Spa IT Service Desk.

## Prerequisites

- Node.js 24 or newer
- pnpm 11.24.0 (the exact version is declared in `package.json`)
- Docker Desktop or another Docker Compose-compatible runtime for local PostgreSQL

If `pnpm` is not installed globally, commands can be run with `npx --yes pnpm@11.24.0 <command>`.

## Local setup

1. Install dependencies with `pnpm install --frozen-lockfile`.
2. Copy `.env.example` to `.env`. The committed values are fictional local-development credentials only.
3. Start PostgreSQL with `pnpm db:up`.
4. Apply migrations with `pnpm db:migrate:deploy`.
5. Start the application with `pnpm dev` and open `http://127.0.0.1:3000`.
6. In a second terminal, start the durable background worker with `pnpm worker`.

`NEXT_PUBLIC_APP_URL` is browser-safe. `DATABASE_URL`, `DATABASE_DIRECT_URL`, and `TEST_DATABASE_URL` are server-only and must never use the `NEXT_PUBLIC_` prefix. Startup validation reports invalid variable names without printing their values.

Account administration also requires the server-only `SUPABASE_SECRET_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` values shown in `.env.example`. Never add `NEXT_PUBLIC_` to them. The application emails a generated temporary password and the login URL; users must replace it before service-desk access.

Level.io requires a dedicated read-only `LEVEL_API_KEY` and its service-desk tenant binding in `LEVEL_ORGANIZATION_ID`. Set `LEVEL_INVENTORY_SYNC_ENABLED=true` only when hourly worker scheduling is approved. All three values are server-only and must never use the `NEXT_PUBLIC_` prefix.

To create the first administrator in a clean environment, set the SMTP/Auth values plus `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_DISPLAY_NAME`, then run `pnpm bootstrap:admin` exactly once. The database refuses the operation after any domain user exists. The command never prints the temporary password and rolls back both records if email delivery fails.

## Database workflow

- `pnpm db:validate`: validate the Prisma schema.
- `pnpm db:generate`: regenerate the typed Prisma client.
- `pnpm db:migrate -- --name <name>`: create a development migration, then review its SQL.
- `pnpm db:migrate:deploy`: apply committed migrations without creating new ones.
- `pnpm db:reset`: reset only the `service_desk` schema in the exact local development database, then migrate it to an empty state.
- `pnpm test:database`: reset the separate local test schema, migrate it, and run self-contained database constraint tests.
- `pnpm db:down`: stop local PostgreSQL without deleting its volume.

The reset commands reject non-local hosts and unexpected database names. They must never be pointed at staging or production.

The empty Step 4 foundation is also migrated to Supabase project `Ticketing System` (`zwcmljkjoxrfzfyphdtc`). Hosted databases must use reviewed forward-only migrations; never run the local reset command against Supabase. Runtime and direct migration connection strings remain server-only deployment configuration and are not committed.

Step 7 adds the reviewed migration `20260901120000_step_7_configuration_taxonomy`, which seeds fictional resort hierarchy values and useful IT categories/subcategories. Active-only uniqueness for configuration values is enforced in SQL so inactive historical records can remain referenced.

Step 8 adds the reviewed migration `20260901153000_step_8_ticket_domain`, which introduces the core ticket tables, human-readable `PIR-######` ticket numbering, append-only history records, and validated lifecycle transitions. See `docs/ticket-domain.md`.

Step 13 adds versioned SLA policies, ticket-level policy snapshots, deterministic support-calendar deadlines, and operational warning/breach evaluation. See `docs/sla-policy.md`.

Step 17 adds the PostgreSQL transactional outbox, leased background worker, bounded retries, duplicate-effect protection, dead-letter replay, and an authorized operations view. See `docs/background-jobs.md`.

Step 21 synchronizes a curated read-only Level device snapshot, associates it to assets through deterministic identity rules, and sends unresolved devices to administrator reconciliation. See `docs/integrations/level.md`.

## Frontend routes

- `/login`: responsive Supabase work-account sign-in with generic failure states.
- `/account/change-password`: mandatory first-login password replacement.
- `/account/mfa`: authenticator enrollment and verification screen retained for future login hardening.
- `/admin/users/new`: permission-gated account creation and SMTP credential delivery.
- `/admin/configuration`: permission-gated hierarchy/service-taxonomy administration, Level.io server-secret status, and the administrator-only read health check.
- `/admin/jobs`: organisation-scoped background backlog and dead-letter inspection with administrator-only replay.
- `/admin/integrations/level`: administrator-only Level inventory synchronization, reconciliation, and retained run status.
- `/`: staff overview and active requests.
- `/new-ticket`: guided request form connected to authenticated ticket creation with controlled reference data and real ticket-number confirmation.
- `/my-tickets`: requester-authorized ticket workspace with server-side filters, search, pagination, public history, replies, and resolution confirmation.
- `/technician`: live technician queue with server-side views, pagination, assignment controls, conflict protection, precise SLA timing, and a real ticket detail panel. Level.io remains an explicit unavailable state.
- `/health`: application-boundary health status.

## Quality gates

- `pnpm format:check` verifies formatting.
- `pnpm lint` runs ESLint with the Next.js Core Web Vitals and TypeScript rules.
- `pnpm typecheck` runs strict TypeScript checking without emitting files.
- `pnpm test` runs the Vitest suite once.
- `pnpm build` creates a production build.
- `pnpm check` runs every required gate in sequence.

Use `pnpm format` and `pnpm lint:fix` for safe local fixes. Never commit `.env.local` or other environment files.

## Project structure

- `src/app/`: App Router routes, layouts, metadata, and global design tokens.
- `src/modules/service-desk/`: reusable domain components, typed view contracts, and explicit empty states.
- `src/server/`: server-only infrastructure and integration adapters.
- `scripts/worker.ts`: independent durable worker process entry point.
- `prisma/`: schema and reviewed SQL migrations.
- `docker/postgres/` and `compose.yaml`: pinned PostgreSQL 17.11 local infrastructure.
- `scripts/`: guarded development and test database workflows.
- `tests/`: automated test setup and cross-cutting tests.
- `docs/`: delivery controls, architecture decisions, and product context.
- `design-prototype 2/`: the supplied approved design reference retained unchanged for fidelity checks.
