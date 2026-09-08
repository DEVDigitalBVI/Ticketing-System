create table service_desk.level_webhook_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  external_event_id uuid not null,
  event_type text not null,
  resource_key text,
  occurred_at timestamptz(6) not null,
  received_at timestamptz(6) not null,
  processing_state text not null default 'accepted',
  attempt_count integer not null default 0,
  correlation_id uuid not null,
  diagnostics jsonb not null default '{}'::jsonb,
  last_processed_at timestamptz(6),
  created_at timestamptz(6) not null default current_timestamp,
  updated_at timestamptz(6) not null default current_timestamp,
  constraint level_webhook_receipts_id_organization_id_key unique (id, organization_id),
  constraint level_webhook_receipts_organization_event_key unique (organization_id, external_event_id),
  constraint level_webhook_receipts_organization_id_fkey foreign key (organization_id)
    references service_desk.organizations (id) on delete restrict on update cascade,
  constraint level_webhook_receipts_event_type_format check (event_type ~ '^[a-z][a-z0-9_]{2,99}$'),
  constraint level_webhook_receipts_state_allowed check (
    processing_state in ('accepted', 'processing', 'processed', 'unsupported', 'out_of_order')
  ),
  constraint level_webhook_receipts_attempt_count_nonnegative check (attempt_count >= 0),
  constraint level_webhook_receipts_diagnostics_object check (jsonb_typeof(diagnostics) = 'object'),
  constraint level_webhook_receipts_diagnostics_size check (pg_column_size(diagnostics) <= 2048),
  constraint level_webhook_receipts_processed_consistent check (
    (processing_state in ('processed', 'unsupported', 'out_of_order') and last_processed_at is not null)
    or (processing_state in ('accepted', 'processing') and last_processed_at is null)
  )
);

create index level_webhook_receipts_state_received_idx
  on service_desk.level_webhook_receipts (organization_id, processing_state, received_at desc);
create index level_webhook_receipts_resource_occurred_idx
  on service_desk.level_webhook_receipts (organization_id, resource_key, occurred_at desc)
  where resource_key is not null;
create index level_webhook_receipts_correlation_idx
  on service_desk.level_webhook_receipts (correlation_id);

create trigger level_webhook_receipts_set_updated_at
before update on service_desk.level_webhook_receipts
for each row execute function service_desk.set_updated_at();

create or replace function service_desk.protect_level_webhook_receipt()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'webhook receipts are retained';
  end if;
  if row(new.id, new.organization_id, new.external_event_id, new.event_type,
         new.resource_key, new.occurred_at, new.received_at, new.correlation_id,
         new.created_at)
     is distinct from
     row(old.id, old.organization_id, old.external_event_id, old.event_type,
         old.resource_key, old.occurred_at, old.received_at, old.correlation_id,
         old.created_at) then
    raise exception using errcode = '55000', message = 'webhook receipt identity is immutable';
  end if;
  return new;
end;
$$;
create trigger level_webhook_receipts_protect
before update or delete on service_desk.level_webhook_receipts
for each row execute function service_desk.protect_level_webhook_receipt();

revoke all on table service_desk.level_webhook_receipts from anon, authenticated;
