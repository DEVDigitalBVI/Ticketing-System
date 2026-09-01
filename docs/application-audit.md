# Peter Island Resort and Spa IT Service Desk — Application Audit

Date: 2026-08-31  
Scope: complete tracked application, database foundation, scripts, tests, configuration, and retained design reference

## Outcome

The application contains no bundled production mock records or fictional development seed. Unconnected product surfaces render empty or unavailable states while preserving the approved desktop/mobile design contract.

The current browser application has no route handler, Server Action, authentication session, ticket persistence call, file upload, queue producer, Microsoft integration, or Level.io client. Form values remain local to the browser and are not transmitted or persisted. The database repositories are not reachable from a web route.

## Security review

Codex Security Standard scan `95174616-ad7a-4721-9ad2-a1c40ae9d0bb` reviewed browser inputs, public routes, server configuration, Prisma repositories/schema, migration/reset workflows, tests, and supporting configuration. It reported one validated low-severity finding:

- The local database reset guard validated the URL authority and database path but returned a connection string whose query parameters were interpreted later by `node-postgres`. A query-string `host` could override the validated authority when a developer or CI process explicitly ran a reset command.

The guard now allows only a single optional `schema=service_desk` parameter, rejects fragments and all target-affecting or ambiguous parameters, and returns the normalized URL. Regression coverage includes host, port, encoded host, duplicate schema, and wrong-schema cases.

No remotely reachable vulnerability was found in the current application. The following are release blockers before live data—not current bypasses:

- authentication and server-side route protection;
- organization, property, role, ownership, and active-user authorization;
- a least-privilege runtime database role separate from migration authority;
- authentication-aware RLS before any Data API exposure;
- production hosting, TLS/origin policy, and secret delivery;
- attachment, queue, Microsoft, and Level.io security controls if those features are approved.

The production dependency audit initially identified `deepmerge-ts` below 8.0.0 through Prisma's configuration package. pnpm now overrides that transitive package to 8.0.0 from `pnpm-workspace.yaml`; Prisma validation, client generation, the application tests, and the production build pass with the override, and `pnpm audit --prod` reports no known vulnerabilities.

Supabase's table inspector reports a critical defense-in-depth warning because RLS is disabled on all seven foundation tables. Direct privilege readback confirms that `anon` and `authenticated` currently have neither schema usage nor table read/write privileges, so those roles cannot access the private schema today. Enabling RLS without approved policies would block future application access; authentication, authorization, RLS policies, and a least-privilege runtime role therefore remain a blocking design decision before any live data or Data API access is introduced. See the [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Data audit

- All seven Supabase foundation tables were read back as empty during this audit.
- Production source no longer contains the ticket IDs, names, device records, metrics, or organization seed previously used for demonstration.
- The retained `design-prototype 2/` directory remains unchanged because it is the approved visual reference, not production application data.
- Synthetic values remain only in automated tests and local credential examples. Tests use an isolated database and reset it before execution; example credentials are loopback-only and explicitly non-production.

## Verification results

- Prettier, ESLint, strict TypeScript, Prisma validation, and Prisma client generation passed.
- Five standard test files passed with 17 tests; the isolated database suite passed with 6 constraint tests.
- The Next.js 16.3.3 webpack production build passed and statically prerendered all application routes.
- The development server returned HTTP 200 for `/`, `/new-ticket`, `/my-tickets`, `/technician`, and `/health` with no server-side runtime errors. No in-app or extension browser was connected, so a fresh visual/console inspection could not be performed during this audit.
- `pnpm audit --prod` reports no known production dependency vulnerabilities.
- The tracked-file secret scan found only explicit loopback-only test credentials; `.env` remains ignored and no secret was found in tracked source.
- Supabase security advisors returned no lints. Performance advisors report only expected unused indexes on empty tables; the table inspector separately reports the RLS decision above.
