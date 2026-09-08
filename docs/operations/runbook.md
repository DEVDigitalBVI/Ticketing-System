# Operational monitoring runbook

Last updated: 2026-09-08

Status: Step 28 operating policy

## Purpose and operating model

The service desk exposes safe application telemetry through one-line structured JSON logs, durable failure ledgers, two machine-readable probes, and the authorized `/admin/operations` view. This is the production monitoring boundary. A production deployment must send stdout and stderr to its approved log collector and configure alerts from the thresholds below. No separate analytics platform or vendor-specific error-monitoring SDK is introduced by Step 28.

Every request receives an `x-request-id`. Background work carries the originating correlation ID through the outbox, job, attempt, effect, webhook receipt, Level sync run, ticket activity, and audit records. Search the log collector and operational records by that UUID before searching by time. Never paste credentials, provider bodies, private comments, or personal data into an incident record.

## Health endpoints

| Endpoint            | Meaning                                                         | Success                                       | Failure behavior                                                                                               |
| ------------------- | --------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `GET /health/live`  | The web process can serve a response                            | Always `200` while the process is alive       | A connection failure or timeout means the process or route is unavailable                                      |
| `GET /health/ready` | The service database is reachable and a worker heartbeat exists | `200` for healthy or warning-level worker age | `503` when the database fails, no heartbeat exists, or the newest active heartbeat is at least 180 seconds old |

Both responses are `private, no-store`, contain only controlled status fields, and return an `x-request-id`. They never include connection strings, hostnames, exception messages, or credentials. The human `/health` page reports web liveness only and deliberately does not claim that dependencies are healthy.

## Alert thresholds and ownership

Thresholds are evaluated in UTC. The primary owner is the on-duty IT Manager. The System Administrator owns database, deployment, secret, and replay work. Resort Operations leadership is informed when a critical incident affects staff service or a property for more than 15 minutes.

| Signal                          | Healthy              | Warning            | Critical                                    | First response                                                                                                        |
| ------------------------------- | -------------------- | ------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Web liveness                    | Probe succeeds       | Not applicable     | Two failures within 60 seconds              | System Administrator checks the web process and deployment logs                                                       |
| Database readiness              | Query succeeds       | Not applicable     | One readiness failure                       | System Administrator checks reachability, connection limits, migrations, and credentials without printing secrets     |
| Worker heartbeat                | Under 90 seconds old | 90 to 179 seconds  | Missing or at least 180 seconds old         | IT Manager inspects worker process and queue; System Administrator restarts only after checking leases                |
| Oldest ready job                | Under 120 seconds    | 120 to 299 seconds | At least 300 seconds                        | IT Manager checks queue growth and worker throughput                                                                  |
| Dead letters                    | None                 | Not applicable     | One or more                                 | IT Manager classifies the cause; System Administrator performs any approved replay                                    |
| Unfinished Level webhook        | Under 120 seconds    | 120 to 299 seconds | At least 300 seconds                        | IT Manager checks webhook jobs, receipt state, and correlation ID                                                     |
| Level inventory freshness       | Under 90 minutes     | 90 to 119 minutes  | At least 120 minutes                        | IT Manager checks the last sync run and reconciliation queue                                                          |
| Email and notification failures | None in 15 minutes   | One or two         | Three or more                               | IT Manager checks the controlled error code and affected workflow; System Administrator checks provider configuration |
| SLA evaluation freshness        | Under 10 minutes     | 10 to 19 minutes   | At least 20 minutes or repeated dead letter | IT Manager checks scheduler and worker; System Administrator checks database and job handler                          |

An unconfigured Level integration is `unknown`, not failed. Unknown signals must be reviewed before production launch but do not create a false outage. A warning should be acknowledged within 15 minutes. A critical state should be acknowledged within five minutes and escalated immediately to the System Administrator. If critical service impact persists for 15 minutes, notify Resort Operations leadership with impact, workaround, owner, and next update time.

## Operational views

- `/admin/operations` is available to roles with `job.read`. It summarizes dependency state and lists safe unresolved delivery or application failures.
- `/admin/jobs` contains the worker backlog, failed jobs, attempt counts, safe error summaries, and dead letters. Only a System Administrator with `job.replay` can replay.
- `/admin/integrations/level/exceptions` contains malformed, unmatched, and policy exception events. It requires configuration management permission.
- `/admin/integrations/level` contains Level sync history and device reconciliation. It requires configuration management permission.

All queries are restricted to the current organization. Browser access to the private service schema remains revoked. A view link is a convenience, not an authorization boundary; every service repeats permission and organization checks.

## Troubleshooting workflow

1. Record the visible signal, UTC time, scope, and correlation ID. Confirm whether liveness or readiness is failing.
2. Search structured logs using the correlation ID. Use `component`, `event`, `jobId`, `errorCode`, status, attempt, and duration to follow the path. Do not request a raw provider body.
3. For worker failures, inspect `/admin/jobs`. Check heartbeat age, oldest ready job, attempt history, lease expiry, and dead letters. Restore the worker before replaying. A replay keeps the original effect key and is idempotent.
4. For webhook failures, confirm signature rejections in the log stream, then inspect the receipt and its linked background job. Invalid signatures create no receipt. Do not bypass verification or replay an untrusted body.
5. For Level sync failures, inspect the latest run, safe error code, and reconciliation count. The ticket and asset pages continue to use the last successful snapshot. Confirm key and organization configuration without logging either value.
6. For email delivery failures, confirm SMTP availability and controlled error code. Failed new-user provisioning is rolled back, so retry through the managed provisioning flow after recovery rather than replaying an email independently.
7. For notification failures, restore the approved provider, then use the dead-letter workflow. Confirm the effect before replay so users do not receive duplicate messages.
8. For stale SLA evaluation, confirm the worker is scheduling five-minute `sla.evaluate` jobs and that a recent job succeeded. Ticket deadlines remain stored; do not edit snapshots to clear the alert.
9. After recovery, verify two healthy observations, document the cause and corrective action, and resolve the incident through the approved operational process. Preserve logs, job attempts, receipts, sync runs, and audit evidence.

## Structured log and redaction contract

Logs contain an ISO timestamp, severity, component, event, optional request or job correlation identifiers, safe error code, status, duration, and a bounded context object. Values are recursively bounded and sanitized before serialization. Authentication headers, cookies, passwords, credentials, secrets, tokens, API keys, request or response bodies, raw provider payloads, file URLs, private comments, email addresses, and arbitrary URLs are redacted. Unknown exceptions are reduced to controlled codes; exception messages and stack traces are not emitted by application logging.

Alert rules in the production log collector must target the structured fields, not free-text matching. Retention and access to the collector follow the resort security policy. Operators should use correlation IDs to join records; raw database access is not an operational workflow.

## Deployment and validation

Apply the Step 28 migration before deploying the worker or web release. Run at least one independent worker process. Configure the platform to use `/health/live` for liveness and `/health/ready` for readiness, with a timeout shorter than its probe interval. Ensure the log collector preserves each JSON line as one event and does not enrich it with request headers or bodies.

Before production cutover, simulate a provider timeout and a worker stop. Confirm the provider failure produces a safe error code and correlation ID, the worker crosses warning and critical heartbeat thresholds, readiness returns `503` at the critical threshold, and no secret or payload appears in logs or the operator view. Restore service and confirm recovery without duplicate effects.
