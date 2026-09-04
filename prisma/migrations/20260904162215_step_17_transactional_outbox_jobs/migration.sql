-- Step 17: transactional outbox and durable leased background jobs.

create table service_desk.outbox_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  category text not null,
  event_type text not null,
  aggregate_type text,
  aggregate_id text,
  payload jsonb not null default '{}'::jsonb,
  correlation_id uuid not null,
  idempotency_key text not null,
  occurred_at timestamptz(6) not null,
  dispatched_at timestamptz(6),
  created_at timestamptz(6) not null default current_timestamp,
  constraint outbox_events_id_organization_id_key unique (id, organization_id),
  constraint outbox_events_organization_id_idempotency_key_key unique (organization_id, idempotency_key),
  constraint outbox_events_category_allowed check (category in ('notification', 'sla_evaluation', 'synchronization', 'webhook')),
  constraint outbox_events_event_type_format check (event_type ~ '^[a-z][a-z0-9_.-]{2,99}$'),
  constraint outbox_events_aggregate_pair check ((aggregate_type is null) = (aggregate_id is null)),
  constraint outbox_events_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint outbox_events_idempotency_key_not_blank check (btrim(idempotency_key) <> ''),
  constraint outbox_events_dispatch_order check (dispatched_at is null or dispatched_at >= occurred_at),
  constraint outbox_events_organization_id_fkey foreign key (organization_id)
    references service_desk.organizations (id) on delete restrict on update cascade
);

create index outbox_events_pending_idx
  on service_desk.outbox_events (occurred_at, id)
  where dispatched_at is null;
create index outbox_events_organization_dispatch_idx
  on service_desk.outbox_events (organization_id, dispatched_at, occurred_at);

create table service_desk.background_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  outbox_event_id uuid,
  replay_of_job_id uuid,
  category text not null,
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  correlation_id uuid not null,
  idempotency_key text not null,
  effect_key text not null,
  status text not null default 'queued',
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  available_at timestamptz(6) not null,
  locked_at timestamptz(6),
  locked_until timestamptz(6),
  lock_token uuid,
  worker_id text,
  last_error_code text,
  last_error_message text,
  completed_at timestamptz(6),
  dead_lettered_at timestamptz(6),
  created_at timestamptz(6) not null default current_timestamp,
  updated_at timestamptz(6) not null default current_timestamp,
  constraint background_jobs_id_organization_id_key unique (id, organization_id),
  constraint background_jobs_outbox_event_id_key unique (outbox_event_id),
  constraint background_jobs_outbox_event_id_organization_id_key unique (outbox_event_id, organization_id),
  constraint background_jobs_organization_id_idempotency_key_key unique (organization_id, idempotency_key),
  constraint background_jobs_category_allowed check (category in ('notification', 'sla_evaluation', 'synchronization', 'webhook')),
  constraint background_jobs_job_type_format check (job_type ~ '^[a-z][a-z0-9_.-]{2,99}$'),
  constraint background_jobs_status_allowed check (status in ('queued', 'running', 'succeeded', 'dead_letter')),
  constraint background_jobs_attempt_bounds check (attempts >= 0 and max_attempts between 1 and 25),
  constraint background_jobs_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint background_jobs_keys_not_blank check (btrim(idempotency_key) <> '' and btrim(effect_key) <> ''),
  constraint background_jobs_lock_consistent check (
    (status = 'running' and locked_at is not null and locked_until is not null and lock_token is not null and worker_id is not null)
    or (status <> 'running' and locked_at is null and locked_until is null and lock_token is null and worker_id is null)
  ),
  constraint background_jobs_terminal_consistent check (
    (status = 'succeeded' and completed_at is not null and dead_lettered_at is null)
    or (status = 'dead_letter' and completed_at is null and dead_lettered_at is not null)
    or (status in ('queued', 'running') and completed_at is null and dead_lettered_at is null)
  ),
  constraint background_jobs_timestamps_ordered check (updated_at >= created_at),
  constraint background_jobs_organization_id_fkey foreign key (organization_id)
    references service_desk.organizations (id) on delete restrict on update cascade,
  constraint background_jobs_outbox_event_id_organization_id_fkey foreign key (outbox_event_id, organization_id)
    references service_desk.outbox_events (id, organization_id) on delete restrict on update cascade,
  constraint background_jobs_replay_of_job_id_organization_id_fkey foreign key (replay_of_job_id, organization_id)
    references service_desk.background_jobs (id, organization_id) on delete restrict on update cascade
);

create index background_jobs_ready_idx
  on service_desk.background_jobs (available_at, created_at)
  where status = 'queued';
create index background_jobs_expired_lease_idx
  on service_desk.background_jobs (locked_until)
  where status = 'running';
create index background_jobs_dead_letter_idx
  on service_desk.background_jobs (organization_id, dead_lettered_at desc)
  where status = 'dead_letter';
create index background_jobs_organization_status_available_idx
  on service_desk.background_jobs (organization_id, status, available_at);
create index background_jobs_replay_of_idx on service_desk.background_jobs (replay_of_job_id, organization_id);
create index background_jobs_correlation_idx on service_desk.background_jobs (correlation_id);

create table service_desk.background_job_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  job_id uuid not null,
  attempt_number integer not null,
  worker_id text not null,
  started_at timestamptz(6) not null,
  completed_at timestamptz(6),
  outcome text not null default 'running',
  error_code text,
  error_message text,
  created_at timestamptz(6) not null default current_timestamp,
  constraint background_job_attempts_job_id_attempt_number_key unique (job_id, attempt_number),
  constraint background_job_attempts_number_positive check (attempt_number > 0),
  constraint background_job_attempts_outcome_allowed check (outcome in ('running', 'succeeded', 'retry', 'dead_letter', 'interrupted', 'duplicate')),
  constraint background_job_attempts_completion_consistent check (
    (outcome = 'running' and completed_at is null)
    or (outcome <> 'running' and completed_at is not null)
  ),
  constraint background_job_attempts_organization_id_fkey foreign key (organization_id)
    references service_desk.organizations (id) on delete restrict on update cascade,
  constraint background_job_attempts_job_id_organization_id_fkey foreign key (job_id, organization_id)
    references service_desk.background_jobs (id, organization_id) on delete restrict on update cascade
);
create index background_job_attempts_organization_started_idx on service_desk.background_job_attempts (organization_id, started_at desc);
create index background_job_attempts_job_started_idx on service_desk.background_job_attempts (job_id, organization_id, started_at desc);

create table service_desk.background_job_effects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  job_id uuid not null,
  effect_key text not null,
  result jsonb not null default '{}'::jsonb,
  completed_at timestamptz(6) not null,
  constraint background_job_effects_organization_id_effect_key_key unique (organization_id, effect_key),
  constraint background_job_effects_effect_key_not_blank check (btrim(effect_key) <> ''),
  constraint background_job_effects_result_object check (jsonb_typeof(result) = 'object'),
  constraint background_job_effects_organization_id_fkey foreign key (organization_id)
    references service_desk.organizations (id) on delete restrict on update cascade,
  constraint background_job_effects_job_id_organization_id_fkey foreign key (job_id, organization_id)
    references service_desk.background_jobs (id, organization_id) on delete restrict on update cascade
);
create index background_job_effects_job_idx on service_desk.background_job_effects (job_id, organization_id);

create trigger background_jobs_set_updated_at before update on service_desk.background_jobs
for each row execute function service_desk.set_updated_at();

create or replace function service_desk.protect_outbox_event()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'outbox events are retained';
  end if;
  if row(new.id, new.organization_id, new.category, new.event_type, new.aggregate_type,
         new.aggregate_id, new.payload, new.correlation_id, new.idempotency_key,
         new.occurred_at, new.created_at)
     is distinct from
     row(old.id, old.organization_id, old.category, old.event_type, old.aggregate_type,
         old.aggregate_id, old.payload, old.correlation_id, old.idempotency_key,
         old.occurred_at, old.created_at)
     or old.dispatched_at is not null
     or new.dispatched_at is null then
    raise exception using errcode = '55000', message = 'outbox event identity is immutable';
  end if;
  return new;
end;
$$;
create trigger outbox_events_protect before update or delete on service_desk.outbox_events
for each row execute function service_desk.protect_outbox_event();

create or replace function service_desk.protect_job_record()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'background jobs are retained';
  end if;
  if row(new.id, new.organization_id, new.outbox_event_id, new.replay_of_job_id,
         new.category, new.job_type, new.payload, new.correlation_id,
         new.idempotency_key, new.effect_key, new.max_attempts, new.created_at)
     is distinct from
     row(old.id, old.organization_id, old.outbox_event_id, old.replay_of_job_id,
         old.category, old.job_type, old.payload, old.correlation_id,
         old.idempotency_key, old.effect_key, old.max_attempts, old.created_at) then
    raise exception using errcode = '55000', message = 'background job identity is immutable';
  end if;
  return new;
end;
$$;
create trigger background_jobs_protect before update or delete on service_desk.background_jobs
for each row execute function service_desk.protect_job_record();

create or replace function service_desk.protect_job_history()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'background job history is retained';
  end if;
  if tg_table_name = 'background_job_effects' then
    raise exception using errcode = '55000', message = 'background job effects are immutable';
  end if;
  if row(new.id, new.organization_id, new.job_id, new.attempt_number,
         new.worker_id, new.started_at, new.created_at)
     is distinct from
     row(old.id, old.organization_id, old.job_id, old.attempt_number,
         old.worker_id, old.started_at, old.created_at)
     or old.completed_at is not null
     or new.completed_at is null
     or new.outcome = 'running' then
    raise exception using errcode = '55000', message = 'background job attempt history is immutable';
  end if;
  return new;
end;
$$;
create trigger background_job_attempts_protect before update or delete on service_desk.background_job_attempts
for each row execute function service_desk.protect_job_history();
create trigger background_job_effects_protect before update or delete on service_desk.background_job_effects
for each row execute function service_desk.protect_job_history();
