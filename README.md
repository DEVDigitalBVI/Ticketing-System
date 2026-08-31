# Peter Island Resort and Spa IT Service Desk

This repository contains the Next.js application shell for the Peter Island Resort and Spa IT Service Desk. Step 2 establishes the developer toolchain and health page only; ticketing workflows, authentication, and database models are intentionally not included yet.

## Prerequisites

- Node.js 24 or newer
- pnpm 11.24.0 (the exact version is declared in `package.json`)

If `pnpm` is not installed globally, commands can be run with `npx --yes pnpm@11.24.0 <command>`.

## Local setup

1. Install dependencies with `pnpm install --frozen-lockfile`.
2. Copy `.env.example` to `.env.local` and replace placeholder values. No secrets or backend credentials are required in Step 2.
3. Start the application with `pnpm dev`.
4. Open `http://localhost:3000` for the application shell or `http://localhost:3000/health` for the health page.

## Quality gates

- `pnpm format:check` verifies formatting.
- `pnpm lint` runs ESLint with the Next.js Core Web Vitals and TypeScript rules.
- `pnpm typecheck` runs strict TypeScript checking without emitting files.
- `pnpm test` runs the Vitest suite once.
- `pnpm build` creates a production build.
- `pnpm check` runs every required gate in sequence.

Use `pnpm format` and `pnpm lint:fix` for safe local fixes. Never commit `.env.local` or other environment files.

## Project structure

- `src/app/`: App Router routes, layouts, and route-specific styles.
- `src/modules/`: future domain modules, grouped by business capability.
- `src/components/`: shared application and shadcn/ui-compatible components.
- `src/lib/`: framework-agnostic shared utilities.
- `src/server/`: server-only infrastructure and integration adapters.
- `tests/`: automated test setup and cross-cutting tests.
- `docs/`: delivery controls, architecture decisions, and product context.
- `outputs/design-prototype/`: portable design reference, behavior hooks, and design handoff notes.
