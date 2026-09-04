# Background jobs and transactional outbox

Last updated: 2026-09-04  
Status: Step 17 operating policy

## Architecture

Step 17 uses a PostgreSQL-native durable queue in the private `service_desk` schema. This keeps local, test, and hosted behavior consistent without adding a provider dependency before integrations are approved.

1. A web request changes domain records and inserts one `outbox_events` row in the same Prisma transaction through `commitWithOutbox`.
2. A worker locks pending outbox rows with `FOR UPDATE SKIP LOCKED`, creates idempotent `background_jobs` rows, and marks the events dispatched in one short transaction.
3. A worker claims one ready job with a time-bounded lease and unique lock token. Multiple workers can claim safely without blocking each other.
4. The handler returns a JSON result. Job completion, the durable effect key, and attempt history commit together. A stale worker whose lease was recovered cannot commit.
5. A delivery whose effect key already exists completes as `duplicate` without calling the handler.

Outbox, job, attempt, and effect records are retained. Database triggers prevent deletion and protect event/job identity and completed history from rewriting.

## Job contract

Every event and job has an organisation, category, controlled job type, UUID correlation ID, unique idempotency key, effect key, object-shaped JSON payload, and explicit timestamps. The supported categories are:

| Category          | Purpose                                     | Step 17 behavior                 |
| ----------------- | ------------------------------------------- | -------------------------------- |
| `notification`    | Email or other user notifications           | Provider adapter not configured  |
| `sla_evaluation`  | Deterministic service-target evaluation     | Local handler boundary available |
| `synchronization` | Future external-system synchronization      | Provider adapter not configured  |
| `webhook`         | Durable inbound/outbound webhook processing | Provider adapter not configured  |

Provider-facing handlers must pass the job idempotency/effect key to any provider that supports idempotency. PostgreSQL prevents the application result from being applied twice; a future non-transactional provider call also needs that provider-side idempotency guarantee.

## Retry, recovery, and dead letters

- Default maximum: five attempts, configurable per stored job from 1 through 25.
- Backoff after attempts 1–4: 5, 10, 20, and 40 seconds. The deterministic policy doubles thereafter and caps at 15 minutes for jobs with a larger configured maximum.
- A failed final attempt becomes `dead_letter` and is never silently discarded.
- A running job has a 60-second default lease. If its process exits or loses connectivity, another worker can claim it after `locked_until`; the prior open attempt is marked `interrupted`.
- Lock-token conditions prevent the interrupted worker from committing after recovery.
- SIGINT and SIGTERM stop new polling and signal the in-flight handler. An interrupted job remains recoverable by lease expiry.
- Replay creates a new job linked to the dead-letter record while retaining the original effect key. If the original result was already committed, replay is a no-op duplicate.

All clocks are explicit `Date` inputs in queue policy and persistence functions. PostgreSQL stores `timestamptz`; the application never derives scheduling from the server's local time zone.

## Operational access and logs

`/admin/jobs` shows organisation-scoped pending-event and job counts, oldest undispatched/queued ages, and safe dead-letter summaries. IT Managers and Auditor / Report Viewers can inspect; only System Administrators can replay. Every replay is audited with the original job ID, category, job type, actor, and correlation ID.

Worker logs are one-line JSON with an allowlisted structure: component, event, IDs, category/type, correlation ID, attempt, state, error code, duration, and count. Payloads, results, credentials, provider responses, and URLs are excluded. Unknown exceptions become the generic `handler_failed` code and message.

## Running locally

Use two processes after the database is started and migrated:

```sh
pnpm dev
pnpm worker
```

The worker reads the same server-only `DATABASE_URL` as the web process. Stop it with SIGINT or SIGTERM. `pnpm test` runs clock-controlled synthetic policy and worker tests. `pnpm test:database` resets only the guarded disposable test database, applies migrations, and proves atomic commit/rollback, exact retry boundaries, duplicate suppression, expired-lease recovery, dead-letter, and replay.

## Deployment

Run `pnpm db:migrate:deploy` once as a release migration task, then run independent long-lived web and worker process types from the same immutable build:

- web command: `pnpm start`
- worker command: `pnpm worker`

At least one worker replica is required. Multiple replicas are supported by skip-locked claims and leases. Deployments should send SIGTERM, allow a drain window longer than the job lease, and only then terminate the old worker. Monitor queued count, oldest queued age, running count, dead-letter count, worker exits, and database availability. Alert thresholds are deployment policy and must be set before production launch.

The worker requires database access only. No notification, synchronization, or webhook provider credentials are introduced in Step 17.
