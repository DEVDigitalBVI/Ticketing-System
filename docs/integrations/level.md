# Level.io integration boundary

Last verified: 2026-09-04
Status: Step 21 approved read-only inventory synchronization

## Official sources

The following current Level-owned sources were reviewed before implementation:

- [Public API: Getting Started](https://docs.level.io/en/articles/12152745-public-api-getting-started)
- [Level Developer API reference](https://developers.level.io/reference/getting-started-with-your-api)
- [Level v2 OpenAPI definition](https://developers.level.io/openapi/level-v2-rest-api.json)
- [Webhooks: Developer Guide](https://docs.level.io/en/articles/16650292-webhooks-developer-guide)
- [Webhook Settings](https://docs.level.io/en/articles/13909290-webhook-settings)

## Confirmed API contract

- Base URL: `https://api.level.io` over HTTPS.
- Current public version prefix: `/v2`.
- Authentication: the API key itself is the `Authorization` header value. It is not a Bearer token.
- API keys are configured as either read-only or read/write. Level documents no finer API-key scopes. This application requires a dedicated read-only key.
- The key is stored only as server environment secret `LEVEL_API_KEY`. It is absent from client bundles, browser responses, tracked configuration values, logs, and audit metadata.
- List pagination accepts `limit` from 1 through 100, defaults to 20, and returns `data` plus `has_more`. Forward pagination sends the final item ID as `starting_after`; reverse pagination can use the first ID as `ending_before`.
- A `429` response means the organisation exceeded its current request rate and supplies a `Retry-After` period. Level does not publish a numeric requests-per-period quota in the reviewed public documentation.
- Common documented statuses are 200, 201, 400, 401, 403, 404, 422, and 429. A 403 can mean insufficient write access or a resource outside the key's organisation.

The reviewed OpenAPI definition exposes these read endpoints:

| Resource      | Confirmed GET endpoints                                                   |
| ------------- | ------------------------------------------------------------------------- |
| Devices       | `/v2/devices`, `/v2/devices/{id}`                                         |
| Groups        | `/v2/groups`, `/v2/groups/{id}`                                           |
| Alerts        | `/v2/alerts`, `/v2/alerts/{id}`                                           |
| Activities    | `/v2/activities`                                                          |
| Automations   | `/v2/automations`, `/v2/automation-runs/{id}`, `/v2/automations/webhooks` |
| Custom fields | `/v2/custom-fields`, `/v2/custom-fields/{id}`, `/v2/custom-field-values`  |
| Tags          | `/v2/tags`, `/v2/tags/{id}`                                               |
| Updates       | `/v2/updates`, `/v2/updates/{id}`                                         |

The same definition contains write methods for supported groups, tags, custom fields, devices, alert resolution, group/tag membership, and automation-webhook triggers. Step 20 deliberately implements none of them.

No reviewed official endpoint documents a general tenant/profile lookup. No reviewed endpoint or help article documents a stable device deep link. No reviewed endpoint documents a direct device remote-action API. The application must not construct links or expose action controls from guesses.

## Confirmed webhook contract

Level's outbound webhooks support eight documented events:

- `alert_active` and `alert_resolved`
- `device_created`, `device_updated`, and `device_deleted`
- `group_created`, `group_updated`, and `group_deleted`

The JSON envelope contains `event_type`, stable UUID `event_id`, UTC `occurred_at`, and an event-specific `data` object. With a configured secret, `X-Level-Signature` is `sha256=<hex>` for an HMAC-SHA256 of the exact raw request body. Receivers must verify before parsing and deduplicate by `event_id`.

The current Webhook Settings guide says failed deliveries receive up to three attempts total, approximately two minutes plus 1–60 seconds of jitter between attempts, and can be manually re-run with the same event ID. Level requires administrator access and a publicly reachable HTTPS destination to configure them. Step 20 does not register a webhook or add a receiving route.

## Implemented client policy

The server-only client implements device-list reads and uses `GET /v2/devices?limit=1` for health. Step 21 uses the same guarded cursor iterator for approved inventory synchronization.

- Per-attempt timeout: 5 seconds by default, bounded from 100 milliseconds through 30 seconds.
- Retries: two by default, bounded from zero through four; only network failures, timeouts, 429, and 5xx responses retry.
- Backoff: 250 milliseconds then exponential doubling for network/5xx responses.
- `Retry-After`: supports delta seconds and HTTP dates. Waiting is capped at 30 seconds by default and cannot exceed 60 seconds in client configuration, keeping the administrator request bounded.
- 401 and 403 fail immediately. Successful bodies are schema-validated. Malformed JSON, missing device IDs, invalid `has_more`, repeated cursors, and excessive page counts fail closed.
- Pagination is capped at 1,000 pages per invocation. Inventory requests use pages of 100 records.
- Safe logs contain only operation, correlation ID, attempt, HTTP status, duration, retry delay, and controlled error code. Keys, authorization headers, URLs, device data, and provider response bodies are excluded.

## Tenant-specific verification status

No `LEVEL_API_KEY` is present in the current server environment. Consequently these facts remain unknown and are not inferred:

- whether this Level tenant and plan currently permit Public API access;
- whether an issued key is read-only and can list devices;
- which organisation and device/group scope that key can see;
- the tenant's effective rate-limit threshold and current throttling state;
- whether the current operator has Level administrator permission to configure future webhooks;
- whether any account-specific UI link or remote capability exists outside the documented Public API.

After an administrator places a dedicated read-only key in the deployment secret environment, `/admin/configuration` can run the approved one-record read check. A successful check confirms authentication, device-list permission, reachability, and response compatibility for that key at that moment. Webhook registration, deep links, writes, and remote actions remain out of scope.

## Step 21 inventory ownership and field mapping

`LEVEL_ORGANIZATION_ID` binds one server credential to one service-desk organisation. A job refuses to run when the job tenant and configured tenant differ. `LEVEL_INVENTORY_SYNC_ENABLED=true` enables hourly scheduled enqueueing; administrators can request the same job manually regardless of that schedule flag. Both paths use the transactional outbox.

| Provider field                      | Stored field                                                                   | Owner                             | Synchronization rule                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------ |
| `id`                                | `LevelDeviceInventory.levelDeviceId` and Level `ExternalSystemLink.externalId` | Level.io                          | Stable remote identity; immutable and unique per organisation.                       |
| `hostname`                          | `LevelDeviceInventory.hostname`                                                | Level.io                          | Curated operational context; a rename updates the same device. Never used to match.  |
| `serial_number`                     | `LevelDeviceInventory.serialNumber`                                            | Level.io snapshot                 | Normalized for deterministic comparison. It does not overwrite `Asset.serialNumber`. |
| `manufacturer`, `model`, `platform` | Same-named inventory snapshot fields                                           | Level.io                          | Curated context only; never copied into service-desk business fields.                |
| `online`, `last_seen_at`            | `online`, `lastSeenAt`                                                         | Level.io                          | Current telemetry snapshot.                                                          |
| Curated canonical fields            | `sourceChecksum`                                                               | Application-derived               | SHA-256 detects source-version changes without retaining the full provider response. |
| Sync execution                      | `lastSyncedAt`, `syncState`, run counters                                      | Service desk integration boundary | Explicit UTC instants and retained per-attempt evidence.                             |

The service desk remains authoritative for asset tag, business name, type and lifecycle, property/building/room, department, custodian, criticality, procurement/warranty, and ticket relationships. Inventory code never updates an `Asset` row.

## Matching and reconciliation

1. An exact organisation-scoped Level external link wins.
2. Without a link, exactly one asset may match an exact normalized serial number.
3. More than one serial candidate, or a candidate already linked to a different Level device, is `ambiguous`.
4. No candidate is `unmatched`. Hostnames and other approximate identifiers are never match keys.
5. No asset is automatically created. Replacement hardware with a new Level ID cannot inherit ownership merely because its hostname was reused.

Unmatched, ambiguous, stale, and failed snapshots appear only to administrators at `/admin/integrations/level`. A manual link checks both sides for conflicts, changes only the external link and integration state, and records an audit event. Knowing or supplying a device ID cannot bypass organisation and permission checks.

A full successful traversal marks previously known devices not seen in that run as `stale`. Provider/pagination failure does not stale devices because absence was not proven. Individual persistence failures are retained as `failed`, allow the rest of the page stream to proceed, produce a partial run, and cause the durable job to retry. Database upserts plus unique Level identity/link constraints make repeated pages, jobs, and recovery safe.
