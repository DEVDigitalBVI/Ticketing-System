# Peter Island Resort and Spa IT Service Desk

This repository contains the approved frontend for the Peter Island Resort and Spa IT Service Desk. It includes staff ticket intake and tracking views, a technician workspace, typed mock data, and local-only interactions. Authentication, persistence, and external integrations are intentionally deferred.

## Prerequisites

- Node.js 24 or newer
- pnpm 11.24.0 (the exact version is declared in `package.json`)

If `pnpm` is not installed globally, commands can be run with `npx --yes pnpm@11.24.0 <command>`.

## Local setup

1. Install dependencies with `pnpm install --frozen-lockfile`.
2. Copy `.env.example` to `.env.local` and replace placeholder values. No secrets or backend credentials are currently required.
3. Start the application with `pnpm dev`.
4. Open `http://localhost:3000`.

## Frontend routes

- `/`: staff overview and active requests.
- `/new-ticket`: guided request form with local success feedback.
- `/my-tickets`: filterable and searchable mock ticket list.
- `/technician`: technician metrics, queue, selected-ticket context, and display-only Level.io data.
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
- `src/modules/service-desk/`: reusable domain components, typed mock data, and ticket types.
- `src/server/`: server-only infrastructure and integration adapters.
- `tests/`: automated test setup and cross-cutting tests.
- `docs/`: delivery controls, architecture decisions, and product context.
- `design-prototype 2/`: the supplied approved design reference retained unchanged for fidelity checks.
