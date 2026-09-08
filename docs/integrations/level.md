# Level.io integration boundary

Last verified: 2026-09-08
Status: Step 23 approved signed webhook receipt

## Official sources

The following current Level-owned sources were reviewed before implementation:

- [Public API: Getting Started](https://docs.level.io/en/articles/12152745-public-api-getting-started)
- [Level Developer API reference](https://developers.level.io/reference/getting-started-with-your-api)
- [Level v2 OpenAPI definition](https://developers.level.io/openapi/level-v2-rest-api.json)
- [Webhooks: Developer Guide](https://docs.level.io/en/articles/16650292-webhooks-developer-guide)
- [Webhook Settings](https://docs.level.io/en/articles/13909290-webhook-settings)
- [Device Listing](https://docs.level.io/en/articles/9926476-device-listing)
- [Device Overview](https://docs.level.io/en/articles/13928697-device-overview)

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

This was rechecked on 2026-09-08. The current official Device Listing and Device Overview guides confirm that selecting a device in the Level interface opens its overview, but neither guide publishes a stable URL pattern that accepts a device ID. Step 22 therefore shows the immutable Level device ID and deliberately ignores every stored external URL. The URL allowlist is empty until a stable contract is documented and reviewed.

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

On 2026-09-04, the server-configured credential passed the live approved read-only health request on its first attempt with HTTP 200. A complete guarded pagination traversal also succeeded and returned a nonempty device inventory. The verification retained no device payloads and printed only safe request metadata and the aggregate count.

This confirms that the current tenant and key can access the Public API, list devices, and return responses compatible with the implemented schema. The configured `LEVEL_ORGANIZATION_ID` supplies the explicit service-desk tenant binding because the reviewed Level API exposes no general tenant/profile lookup.

The tenant's numeric rate ceiling, Level administrator permission for future webhook configuration, account-specific UI links, and remote-action capability remain unknown and are not inferred. Webhook registration, deep links, writes, and remote actions remain out of scope.

## Step 21 inventory ownership and field mapping

`LEVEL_ORGANIZATION_ID` binds one server credential to one service-desk organisation. A job refuses to run when the job tenant and configured tenant differ. `LEVEL_INVENTORY_SYNC_ENABLED=true` enables hourly scheduled enqueueing; administrators can request the same job manually regardless of that schedule flag. Both paths use the transactional outbox.

| Provider field                      | Stored field                                                                   | Owner                             | Synchronization rule                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------ | --------------------------------- | --------------------------------------------------------------------------------------- |
| `id`                                | `LevelDeviceInventory.levelDeviceId` and Level `ExternalSystemLink.externalId` | Level.io                          | Stable remote identity; immutable and unique per organisation.                          |
| `hostname`                          | `LevelDeviceInventory.hostname`                                                | Level.io                          | Curated operational context; a rename updates the same device. Never used to match.     |
| `serial_number`                     | `LevelDeviceInventory.serialNumber`                                            | Level.io snapshot                 | Normalized for deterministic comparison. It does not overwrite `Asset.serialNumber`.    |
| `manufacturer`, `model`, `platform` | Same-named inventory snapshot fields                                           | Level.io                          | Curated context only; never copied into service-desk business fields.                   |
| `online`, `last_seen_at`            | `online`, `lastSeenAt`                                                         | Level.io                          | Current telemetry snapshot.                                                             |
| Curated canonical fields            | `sourceChecksum`                                                               | Application-derived               | SHA-256 detects source-version changes without retaining the full provider response.    |
| Sync execution                      | `lastSyncedAt`, `syncState`, run counters                                      | Service desk integration boundary | Explicit UTC instants and retained per-attempt evidence.                                |
| Successful snapshot                 | `lastSuccessfulSyncAt`                                                         | Service desk integration boundary | Updated only by a successful device synchronization; failures preserve the prior value. |

The service desk remains authoritative for asset tag, business name, type and lifecycle, property/building/room, department, custodian, criticality, procurement/warranty, and ticket relationships. Inventory code never updates an `Asset` row.

## Matching and reconciliation

1. An exact organisation-scoped Level external link wins.
2. Without a link, exactly one asset may match an exact normalized serial number.
3. More than one serial candidate, or a candidate already linked to a different Level device, is `ambiguous`.
4. No candidate is `unmatched`. Hostnames and other approximate identifiers are never match keys.
5. No asset is automatically created. Replacement hardware with a new Level ID cannot inherit ownership merely because its hostname was reused.

Unmatched, ambiguous, stale, and failed snapshots appear only to administrators at `/admin/integrations/level`. A manual link checks both sides for conflicts, changes only the external link and integration state, and records an audit event. Knowing or supplying a device ID cannot bypass organisation and permission checks.

A full successful traversal marks previously known devices not seen in that run as `stale`. Provider/pagination failure does not stale devices because absence was not proven. Individual persistence failures are retained as `failed`, allow the rest of the page stream to proceed, produce a partial run, and cause the durable job to retry. Database upserts plus unique Level identity/link constraints make repeated pages, jobs, and recovery safe.

## Step 22 technician context policy

The ticket and asset pages read the synchronized database snapshot only. They never make a live provider request, so Level latency, throttling, authentication failure, or outage cannot block the primary service-desk record. A failed or partial sync newer than the device snapshot produces a degraded state and preserves the last known fields.

Only an actor with property-scoped `level.context.read` may call the context service. The current matrix grants that permission to Technician, IT Manager, and System Administrator. Requesters, Department Approvers, and Report Viewers receive no query and no UI context. Ticket context resolves through the ticket's optional primary asset, then through that asset's current Level external link. Replacing the external link causes the next page read to use the replacement device and ignore the former snapshot.

The view model contains only device ID, hostname, platform, online state, last seen time, derived health summary, last successful sync time, freshness state, and empty approved placeholders for group and selected alerts. Group names and selected alert summaries are not part of the Step 21 snapshot and are labelled `Not synchronized`; they are not guessed or fetched live. Raw provider objects, API keys, command output, network telemetry, provider error bodies, internal error codes, checksums, serial numbers, and match metadata are not present in the view model.

A snapshot is clearly labelled stale when Level marked the device stale or when its last device synchronization is more than two hours old. Query failure returns a controlled degraded context instead of throwing into the parent page. Stable deep links and remote actions remain unavailable pending an official documented contract and a separate approval.

## Step 23 webhook receiver

The public receiver is `POST /webhooks/level` on the deployed HTTPS origin. It accepts only `application/json` and bodies up to 256 KiB. The route reads the request stream with a hard byte limit, verifies `X-Level-Signature` against the exact raw bytes using constant-time HMAC-SHA256 comparison, and only then parses the JSON envelope. A missing, malformed, or incorrect signature returns `401`; malformed signed content returns `400`; oversized content returns `413`; and an unsupported content type returns `415`. None of those paths creates a receipt or background job.

The envelope requires a UUID `event_id`, bounded event type, ISO 8601 timestamp with offset, object `data`, and bounded `data.id`. A supported signed event atomically creates a minimal `LevelWebhookReceipt` and a `webhook.level.process` outbox event, then returns `202`. A duplicate event ID returns `200` without changing the original receipt or creating more work. A well-formed but unknown event type is retained as `unsupported` and acknowledged with `200`, allowing new provider event types to be reviewed safely without retry storms.

Receipts retain only organisation, external event ID, event type, resource key, provider occurrence time, receipt time, processing state, attempt count, correlation ID, controlled diagnostic codes, and final processing time. The raw request, signature, device/alert/group object, headers, API keys, webhook secrets, command output, and provider responses are not retained. The background handler currently records `received_no_ticket_action`; it does not create, update, or resolve tickets. When a newer event for the same resource has already arrived, the older receipt becomes `out_of_order` and no downstream action occurs.

### Registration

1. Deploy the migration, application, and worker with `LEVEL_ORGANIZATION_ID` and a high-entropy `LEVEL_WEBHOOK_SECRET` stored in the server secret manager.
2. Publish the application behind HTTPS and confirm `https://<service-desk-origin>/webhooks/level` is publicly reachable.
3. In Level, open Settings, then Webhooks, and create a webhook using that URL and the exact same secret.
4. Select only the eight currently documented alert, device, and group events required for receipt validation.
5. Send or re-run one delivery and confirm a successful `2xx` in Level Requests and a receipt in the administrator integration page.

### Secret rotation

1. Generate a new high-entropy secret. Deploy it as `LEVEL_WEBHOOK_SECRET` while placing the old value in `LEVEL_WEBHOOK_PREVIOUS_SECRET`.
2. Change the saved webhook secret in Level to the new value.
3. Confirm a newly signed delivery is accepted, then remove `LEVEL_WEBHOOK_PREVIOUS_SECRET` and redeploy.

Only the current and optional previous secret are checked. Neither is logged or persisted. If compromise is suspected, rotate immediately rather than extending the overlap window. The Level administrator can re-run an original delivery, which remains safe because `event_id` is unique. A System Administrator can also queue receipt replay from `/admin/integrations/level`; the replay uses the original effect key and remains idempotent.
