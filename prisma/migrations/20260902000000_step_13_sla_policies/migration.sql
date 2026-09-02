-- Step 13: SLA policy configuration and ticket SLA snapshots.

create table service_desk.ticket_sla_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  property_id uuid not null,
  version int not null,
  name text not null,
  is_active boolean not null default false,
  description text,
  timezone text not null,
  support_hours jsonb not null,
  holidays jsonb not null,
  impact_urgency_rules jsonb not null,
  warning_minutes int not null default 30,
  pause_statuses jsonb not null,
  reopen_behavior jsonb not null,
  response_targets jsonb not null,
  resolution_targets jsonb not null,
  created_at timestamptz(6) not null default current_timestamp,
  updated_at timestamptz(6) not null default current_timestamp,
  constraint ticket_sla_policies_version_check check (version > 0),
  constraint ticket_sla_policies_warning_minutes_check check (warning_minutes >= 0),
  constraint ticket_sla_policies_organization_id_property_id_version_key unique (organization_id, property_id, version),
  constraint ticket_sla_policies_id_organization_id_key unique (id, organization_id),
  constraint ticket_sla_policies_organization_id_fkey foreign key (organization_id)
    references service_desk.organizations (id) on delete restrict on update cascade,
  constraint ticket_sla_policies_property_id_organization_id_fkey foreign key (property_id, organization_id)
    references service_desk.properties (id, organization_id) on delete restrict on update cascade
);

create index ticket_sla_policies_organization_id_property_id_is_active_idx
  on service_desk.ticket_sla_policies (organization_id, property_id, is_active, version desc);
create unique index ticket_sla_policies_one_active_per_property_idx
  on service_desk.ticket_sla_policies (organization_id, property_id)
  where is_active;

alter table service_desk.tickets
  add column sla_policy_id uuid,
  add column sla_policy_version int,
  add column sla_policy_snapshot jsonb,
  add column sla_response_due_at timestamptz(6),
  add column sla_responded_at timestamptz(6),
  add column sla_resolution_due_at timestamptz(6),
  add column sla_waiting_at timestamptz(6),
  add column sla_paused_seconds int not null default 0;

alter table service_desk.tickets
  add constraint tickets_sla_policy_id_organization_id_fkey foreign key (sla_policy_id, organization_id)
  references service_desk.ticket_sla_policies (id, organization_id) on delete restrict on update cascade;

create index tickets_sla_status_idx
  on service_desk.tickets (organization_id, sla_policy_id);
create index tickets_sla_evaluation_idx
  on service_desk.tickets (organization_id, status, sla_response_due_at, sla_resolution_due_at);

create function service_desk.prevent_sla_policy_version_rewrite()
returns trigger
language plpgsql
as $$
begin
  if row(
    new.organization_id, new.property_id, new.version, new.name, new.description,
    new.timezone, new.support_hours, new.holidays, new.impact_urgency_rules,
    new.warning_minutes, new.pause_statuses, new.reopen_behavior,
    new.response_targets, new.resolution_targets
  ) is distinct from row(
    old.organization_id, old.property_id, old.version, old.name, old.description,
    old.timezone, old.support_hours, old.holidays, old.impact_urgency_rules,
    old.warning_minutes, old.pause_statuses, old.reopen_behavior,
    old.response_targets, old.resolution_targets
  ) then
    raise exception 'SLA policy versions are immutable; create a new version instead.';
  end if;
  return new;
end;
$$;

create trigger ticket_sla_policies_prevent_version_rewrite
before update on service_desk.ticket_sla_policies
for each row execute function service_desk.prevent_sla_policy_version_rewrite();
create trigger ticket_sla_policies_set_updated_at
before update on service_desk.ticket_sla_policies
for each row execute function service_desk.set_updated_at();
