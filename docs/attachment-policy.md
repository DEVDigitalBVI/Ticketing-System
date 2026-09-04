# Private ticket attachment policy

Step 14 uses the approved Supabase Storage provider and the private `ticket-attachments` bucket. The bucket is never public and the application creates no end-user `storage.objects` policies for it. Browser clients never receive the Supabase secret key, an object path, or a signed object URL.

## Authorization boundary

- Upload and download requests terminate at authenticated Next.js route handlers.
- Every operation reloads the attachment metadata and its ticket inside the caller's organisation, then applies the existing ticket ownership, affected-user, property, department, and technician permissions.
- Internal attachments require technician queue access. Requesters can only upload or list requester-visible attachments on tickets they may access.
- Downloads use the attachment metadata UUID, not an object key. The server retrieves the private object with its server-only Supabase client and returns a non-cacheable attachment response with `X-Content-Type-Options: nosniff`.
- Object keys contain organisation ID, ticket ID, and a random UUID only. They contain no user filename and are globally unique. Knowing either the metadata ID or object key is insufficient without a current authorized ticket session.

## File acceptance

The server accepts PNG, JPEG, WebP, PDF, and UTF-8 text files up to 10 MiB. It normalizes the displayed leaf filename, removes traversal and control characters, limits it to 120 characters, and never uses it as the object key. Declared MIME type, extension, and file signature/content must agree. Empty, oversized, unsupported, or spoofed files are rejected before storage.

## Quarantine and scanning

Each upload is reserved in PostgreSQL before the external object write and begins with `scan_status = pending`. A successful object write moves it to `upload_status = uploaded`, but it remains quarantined. The lifecycle supports `pending`, `clean`, `infected`, and `failed` scan states.

Malware scanning infrastructure is not currently available. Therefore an unscanned or failed-scan file can be downloaded only by its uploader; other otherwise-authorized ticket users receive a locked response. Infected files cannot be downloaded by anyone. `recordAttachmentScanResult` is the background-safe handoff for a future scanner and requires an explicit scan time.

## Cleanup, retention, and evidence

Pending uploads expire after one hour. A background call to `cleanupAbandonedAttachmentUploads(now)` claims the row, deletes any partial object, and marks its retained metadata abandoned. Uploaded objects are retained for 365 days; `cleanupExpiredTicketAttachments(now)` similarly claims and removes expired objects before marking metadata deleted. The transitional `abandoning` and `deleting` states prevent upload/cleanup races and allow interrupted work to resume. Both functions require an explicit clock, process at most 100 records per run, and tolerate duplicate workers.

Attachment identity, ownership, ticket binding, filename, type, size, checksum, and object key are immutable. Lifecycle fields may advance without deleting the record. Ticket activity and audit records contain only the attachment ID, controlled type/state, visibility, and size; they never contain file bytes, object keys, secret credentials, signed URLs, or provider error payloads.
