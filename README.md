# Peter Island Resort and Spa IT Service Desk

This repository contains the approved frontend and PostgreSQL identity foundation for the Peter Island Resort and Spa IT Service Desk. Unconnected ticket, identity, monitoring, and integration surfaces render explicit empty states; no production mock records are bundled. Authentication, ticket persistence, and external integrations remain intentionally deferred.

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

`NEXT_PUBLIC_APP_URL` is browser-safe. `DATABASE_URL`, `DATABASE_DIRECT_URL`, and `TEST_DATABASE_URL` are server-only and must never use the `NEXT_PUBLIC_` prefix. Startup validation reports invalid variable names without printing their values.

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

## Frontend routes

- `/login`: responsive work-account sign-in screen; currently presentation-only and does not transmit credentials.
- `/`: staff overview and active requests.
- `/new-ticket`: guided request form with local success feedback.
- `/my-tickets`: filterable ticket workspace with an honest empty state until persistence exists.
- `/technician`: empty service metrics, queue, selected-ticket context, and Level.io integration states until live services exist.
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
- `prisma/`: schema and reviewed SQL migrations.
- `docker/postgres/` and `compose.yaml`: pinned PostgreSQL 17.11 local infrastructure.
- `scripts/`: guarded development and test database workflows.
- `tests/`: automated test setup and cross-cutting tests.
- `docs/`: delivery controls, architecture decisions, and product context.
- `design-prototype 2/`: the supplied approved design reference retained unchanged for fidelity checks.
