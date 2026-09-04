-- Step 21: Level.io inventory snapshots and synchronization run evidence.

create table service_desk.level_device_inventory (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  level_device_id text not null,
  hostname text,
  serial_number text,
  manufacturer text,
  model text,
  platform text,
  online boolean,
  last_seen_at timestamptz(6),
  source_checksum varchar(64) not null,
  sync_state text not null,
  match_reason text,
  last_error_code text,
  last_synced_at timestamptz(6) not null,
  stale_at timestamptz(6),
  created_at timestamptz(6) not null default current_timestamp,
  updated_at timestamptz(6) not null default current_timestamp,
  constraint level_device_inventory_id_organization_id_key unique (id, organization_id),
  constraint level_device_inventory_organization_id_level_device_id_key unique (organization_id, level_device_id),
  constraint level_device_inventory_level_id_not_blank check (btrim(level_device_id) <> ''),
  constraint level_device_inventory_checksum_format check (source_checksum ~ '^[0-9a-f]{64}$'),
  constraint level_device_inventory_state_allowed check (sync_state in ('matched', 'unmatched', 'ambiguous', 'stale', 'failed')),
  constraint level_device_inventory_match_reason_allowed check (match_reason is null or match_reason in ('external_link', 'serial_number', 'manual')),
  constraint level_device_inventory_state_consistent check (
    (sync_state = 'matched' and match_reason is not null and last_error_code is null and stale_at is null)
    or (sync_state in ('unmatched', 'ambiguous') and match_reason is null and last_error_code is null and stale_at is null)
    or (sync_state = 'stale' and stale_at is not null)
    or (sync_state = 'failed' and last_error_code is not null)
  ),
  constraint level_device_inventory_organization_id_fkey foreign key (organization_id)
    references service_desk.organizations (id) on delete restrict on update cascade
);

create index level_device_inventory_reconciliation_idx
  on service_desk.level_device_inventory (organization_id, sync_state, updated_at desc)
  where sync_state in ('unmatched', 'ambiguous', 'stale', 'failed');
create index level_device_inventory_serial_idx
  on service_desk.level_device_inventory (organization_id, lower(serial_number))
  where serial_number is not null and btrim(serial_number) <> '';

create table service_desk.level_inventory_sync_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  background_job_id uuid not null,
  attempt_number integer not null,
  trigger text not null,
  status text not null default 'running',
  correlation_id uuid not null,
  devices_seen integer not null default 0,
  devices_matched integer not null default 0,
  devices_unmatched integer not null default 0,
  devices_ambiguous integer not null default 0,
  devices_failed integer not null default 0,
  devices_stale integer not null default 0,
  last_error_code text,
  started_at timestamptz(6) not null,
  completed_at timestamptz(6),
  created_at timestamptz(6) not null default current_timestamp,
  constraint level_inventory_sync_runs_id_organization_id_key unique (id, organization_id),
  constraint level_inventory_sync_runs_background_job_id_attempt_number_key unique (background_job_id, attempt_number),
  constraint level_inventory_sync_runs_trigger_allowed check (trigger in ('manual', 'scheduled')),
  constraint level_inventory_sync_runs_status_allowed check (status in ('running', 'succeeded', 'partial', 'failed')),
  constraint level_inventory_sync_runs_counts_nonnegative check (
    devices_seen >= 0 and devices_matched >= 0 and devices_unmatched >= 0
    and devices_ambiguous >= 0 and devices_failed >= 0 and devices_stale >= 0
  ),
  constraint level_inventory_sync_runs_attempt_positive check (attempt_number > 0),
  constraint level_inventory_sync_runs_completion_consistent check (
    (status = 'running' and completed_at is null and last_error_code is null)
    or (status = 'succeeded' and completed_at is not null and last_error_code is null)
    or (status in ('partial', 'failed') and completed_at is not null and last_error_code is not null)
  ),
  constraint level_inventory_sync_runs_organization_id_fkey foreign key (organization_id)
    references service_desk.organizations (id) on delete restrict on update cascade,
  constraint level_inventory_sync_runs_background_job_id_organization_id_fkey foreign key (background_job_id, organization_id)
    references service_desk.background_jobs (id, organization_id) on delete restrict on update cascade
);

create index level_inventory_sync_runs_organization_started_idx
  on service_desk.level_inventory_sync_runs (organization_id, started_at desc);
create index level_inventory_sync_runs_active_idx
  on service_desk.level_inventory_sync_runs (organization_id, started_at)
  where status = 'running';

create trigger level_device_inventory_set_updated_at before update on service_desk.level_device_inventory
for each row execute function service_desk.set_updated_at();

create or replace function service_desk.protect_level_inventory_identity()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'Level inventory records are retained';
  end if;
  if row(new.id, new.organization_id, new.level_device_id, new.created_at)
     is distinct from row(old.id, old.organization_id, old.level_device_id, old.created_at) then
    raise exception using errcode = '55000', message = 'Level inventory identity is immutable';
  end if;
  return new;
end;
$$;
create trigger level_device_inventory_protect before update or delete on service_desk.level_device_inventory
for each row execute function service_desk.protect_level_inventory_identity();

create or replace function service_desk.protect_level_sync_run()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'Level sync runs are retained';
  end if;
  if row(new.id, new.organization_id, new.background_job_id, new.attempt_number, new.trigger,
         new.correlation_id, new.started_at, new.created_at)
     is distinct from
     row(old.id, old.organization_id, old.background_job_id, old.attempt_number, old.trigger,
         old.correlation_id, old.started_at, old.created_at)
     or old.completed_at is not null then
    raise exception using errcode = '55000', message = 'Level sync run history is immutable';
  end if;
  return new;
end;
$$;
create trigger level_inventory_sync_runs_protect before update or delete on service_desk.level_inventory_sync_runs
for each row execute function service_desk.protect_level_sync_run();
