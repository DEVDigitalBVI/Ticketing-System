-- Step 14: private ticket attachments with quarantine and retention lifecycle.

alter table service_desk.attachment_metadata
  add column upload_status text not null default 'pending',
  add column scan_status text not null default 'pending',
  add column checksum_sha256 text,
  add column upload_expires_at timestamptz(6) not null default (current_timestamp + interval '1 hour'),
  add column uploaded_at timestamptz(6),
  add column scan_completed_at timestamptz(6),
  add column retention_until timestamptz(6) not null default (current_timestamp + interval '365 days'),
  add column deleted_at timestamptz(6),
  add constraint attachment_metadata_storage_path_key unique (storage_path),
  add constraint attachment_metadata_upload_status_allowed
    check (upload_status in ('pending', 'uploaded', 'abandoning', 'deleting', 'abandoned', 'deleted')),
  add constraint attachment_metadata_scan_status_allowed
    check (scan_status in ('pending', 'clean', 'infected', 'failed')),
  add constraint attachment_metadata_checksum_sha256_format
    check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'),
  add constraint attachment_metadata_lifecycle_consistent check (
    (upload_status in ('pending', 'abandoning') and uploaded_at is null and deleted_at is null)
    or (upload_status in ('uploaded', 'deleting') and uploaded_at is not null and deleted_at is null)
    or (upload_status = 'abandoned' and uploaded_at is null and deleted_at is not null)
    or (upload_status = 'deleted' and uploaded_at is not null and deleted_at is not null)
  ),
  add constraint attachment_metadata_scan_completion_consistent check (
    (scan_status = 'pending' and scan_completed_at is null)
    or (scan_status in ('clean', 'infected', 'failed') and scan_completed_at is not null)
  );

create index attachment_metadata_abandoned_cleanup_idx
  on service_desk.attachment_metadata (upload_expires_at)
  where upload_status in ('pending', 'abandoning');

create index attachment_metadata_retention_cleanup_idx
  on service_desk.attachment_metadata (retention_until)
  where upload_status in ('uploaded', 'deleting');

drop trigger attachment_metadata_are_immutable on service_desk.attachment_metadata;

create or replace function service_desk.protect_attachment_identity()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'attachment records are retained';
  end if;

  if row(
    new.id, new.organization_id, new.ticket_id, new.comment_id,
    new.uploaded_by_user_id, new.visibility, new.file_name,
    new.content_type, new.byte_size, new.storage_path, new.created_at
  ) is distinct from row(
    old.id, old.organization_id, old.ticket_id, old.comment_id,
    old.uploaded_by_user_id, old.visibility, old.file_name,
    old.content_type, old.byte_size, old.storage_path, old.created_at
  ) then
    raise exception using errcode = '55000', message = 'attachment identity is immutable';
  end if;

  return new;
end;
$$;

create trigger attachment_metadata_protect_identity
before update or delete on service_desk.attachment_metadata
for each row execute function service_desk.protect_attachment_identity();

-- Plain PostgreSQL test environments do not include Supabase Storage. Hosted
-- Supabase environments create or harden the approved private bucket here.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'ticket-attachments',
      'ticket-attachments',
      false,
      10485760,
      array['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain']
    )
    on conflict (id) do update set
      public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
  end if;
end;
$$;
