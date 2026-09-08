alter table service_desk.level_webhook_receipts
  add column alert_id text,
  add column alert_device_id text,
  add column alert_device_name text,
  add column alert_name text,
  add column alert_description text,
  add column alert_payload text,
  add column alert_severity text,
  add column alert_is_resolved boolean,
  add column alert_started_at timestamptz(6),
  add column alert_resolved_at timestamptz(6),
  add column alert_data_valid boolean;

alter table service_desk.level_webhook_receipts
  add constraint level_webhook_receipts_alert_fields_size check (
    coalesce(length(alert_id), 0) <= 160 and
    coalesce(length(alert_device_id), 0) <= 160 and
    coalesce(length(alert_device_name), 0) <= 255 and
    coalesce(length(alert_name), 0) <= 255 and
    coalesce(length(alert_description), 0) <= 4000 and
    coalesce(length(alert_payload), 0) <= 1000
  ),
  add constraint level_webhook_receipts_alert_severity_allowed check (
    alert_severity is null or alert_severity in ('information', 'warning', 'critical', 'emergency')
  );

create table service_desk.level_alert_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  is_enabled boolean not null default false,
  dry_run boolean not null default true,
  sort_order integer not null default 100,
  property_id uuid,
  requester_user_id uuid not null,
  category_id uuid not null,
  subcategory_id uuid,
  support_team_id uuid,
  match_name_contains text,
  match_severities text[] not null default array['information','warning','critical','emergency']::text[],
  severity_priority_map jsonb not null,
  subject_template text not null,
  description_template text not null,
  correlation_window_minutes integer not null default 60,
  suppression_window_minutes integer not null default 15,
  auto_resolve_policy text not null default 'never',
  created_at timestamptz(6) not null default current_timestamp,
  updated_at timestamptz(6) not null default current_timestamp,
  constraint level_alert_rules_id_organization_key unique (id, organization_id),
  constraint level_alert_rules_organization_fkey foreign key (organization_id) references service_desk.organizations (id) on delete restrict on update cascade,
  constraint level_alert_rules_property_fkey foreign key (property_id, organization_id) references service_desk.properties (id, organization_id) on delete restrict on update cascade,
  constraint level_alert_rules_requester_fkey foreign key (requester_user_id, organization_id) references service_desk.users (id, organization_id) on delete restrict on update cascade,
  constraint level_alert_rules_category_fkey foreign key (category_id, organization_id) references service_desk.ticket_categories (id, organization_id) on delete restrict on update cascade,
  constraint level_alert_rules_subcategory_fkey foreign key (subcategory_id, category_id, organization_id) references service_desk.ticket_subcategories (id, category_id, organization_id) on delete restrict on update cascade,
  constraint level_alert_rules_team_fkey foreign key (support_team_id, property_id, organization_id) references service_desk.support_teams (id, property_id, organization_id) on delete restrict on update cascade,
  constraint level_alert_rules_name_size check (length(btrim(name)) between 3 and 120),
  constraint level_alert_rules_match_name_size check (match_name_contains is null or length(match_name_contains) between 2 and 120),
  constraint level_alert_rules_severities_allowed check (match_severities <@ array['information','warning','critical','emergency']::text[] and cardinality(match_severities) > 0),
  constraint level_alert_rules_priority_map check (
    jsonb_typeof(severity_priority_map) = 'object' and
    severity_priority_map ?& array['information','warning','critical','emergency'] and
    severity_priority_map->>'information' in ('P1','P2','P3','P4') and
    severity_priority_map->>'warning' in ('P1','P2','P3','P4') and
    severity_priority_map->>'critical' in ('P1','P2','P3','P4') and
    severity_priority_map->>'emergency' in ('P1','P2','P3','P4')
  ),
  constraint level_alert_rules_templates_size check (length(subject_template) between 3 and 180 and length(description_template) between 3 and 4000),
  constraint level_alert_rules_windows check (correlation_window_minutes between 1 and 10080 and suppression_window_minutes between 0 and 10080),
  constraint level_alert_rules_auto_resolve_allowed check (auto_resolve_policy in ('never', 'if_unstarted')),
  constraint level_alert_rules_property_team_consistent check (support_team_id is null or property_id is not null)
);

create table service_desk.level_alert_correlations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  rule_id uuid not null,
  alert_id text not null,
  level_device_id text not null,
  correlation_key varchar(64) not null,
  ticket_id uuid not null,
  state text not null default 'active',
  delivery_count integer not null default 1,
  first_active_at timestamptz(6) not null,
  last_active_at timestamptz(6) not null,
  resolved_at timestamptz(6),
  last_provider_event_at timestamptz(6) not null,
  created_at timestamptz(6) not null default current_timestamp,
  updated_at timestamptz(6) not null default current_timestamp,
  constraint level_alert_correlations_id_organization_key unique (id, organization_id),
  constraint level_alert_correlations_organization_key unique (organization_id, correlation_key),
  constraint level_alert_correlations_organization_fkey foreign key (organization_id) references service_desk.organizations (id) on delete restrict on update cascade,
  constraint level_alert_correlations_rule_fkey foreign key (rule_id, organization_id) references service_desk.level_alert_rules (id, organization_id) on delete restrict on update cascade,
  constraint level_alert_correlations_ticket_fkey foreign key (ticket_id, organization_id) references service_desk.tickets (id, organization_id) on delete restrict on update cascade,
  constraint level_alert_correlations_state_allowed check (state in ('active','resolved')),
  constraint level_alert_correlations_delivery_positive check (delivery_count > 0),
  constraint level_alert_correlations_key_format check (correlation_key ~ '^[0-9a-f]{64}$')
);

create table service_desk.level_alert_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  receipt_id uuid not null,
  rule_id uuid,
  ticket_id uuid,
  outcome text not null,
  reason_code text not null,
  explanation text not null,
  correlation_key varchar(64),
  exception_state text,
  created_at timestamptz(6) not null default current_timestamp,
  updated_at timestamptz(6) not null default current_timestamp,
  constraint level_alert_decisions_id_organization_key unique (id, organization_id),
  constraint level_alert_decisions_receipt_key unique (organization_id, receipt_id),
  constraint level_alert_decisions_organization_fkey foreign key (organization_id) references service_desk.organizations (id) on delete restrict on update cascade,
  constraint level_alert_decisions_receipt_fkey foreign key (receipt_id, organization_id) references service_desk.level_webhook_receipts (id, organization_id) on delete restrict on update cascade,
  constraint level_alert_decisions_rule_fkey foreign key (rule_id, organization_id) references service_desk.level_alert_rules (id, organization_id) on delete restrict on update cascade,
  constraint level_alert_decisions_ticket_fkey foreign key (ticket_id, organization_id) references service_desk.tickets (id, organization_id) on delete restrict on update cascade,
  constraint level_alert_decisions_outcome_allowed check (outcome in ('created','correlated','resolved','resolution_deferred','suppressed','dry_run','ignored','exception')),
  constraint level_alert_decisions_reason_format check (reason_code ~ '^[a-z][a-z0-9_]{2,99}$'),
  constraint level_alert_decisions_explanation_size check (length(explanation) between 3 and 1000),
  constraint level_alert_decisions_exception_consistent check ((outcome = 'exception' and exception_state in ('open','resolved','ignored')) or (outcome <> 'exception' and exception_state is null))
);

create index level_alert_rules_enabled_idx on service_desk.level_alert_rules (organization_id, is_enabled, sort_order);
create index level_alert_correlations_lookup_idx on service_desk.level_alert_correlations (organization_id, alert_id, level_device_id, rule_id, state, last_active_at desc);
create index level_alert_correlations_ticket_idx on service_desk.level_alert_correlations (ticket_id, organization_id);
create index level_alert_decisions_exception_idx on service_desk.level_alert_decisions (organization_id, outcome, exception_state, created_at desc);
create index level_alert_decisions_ticket_idx on service_desk.level_alert_decisions (ticket_id, organization_id) where ticket_id is not null;

create trigger level_alert_rules_set_updated_at before update on service_desk.level_alert_rules for each row execute function service_desk.set_updated_at();
create trigger level_alert_correlations_set_updated_at before update on service_desk.level_alert_correlations for each row execute function service_desk.set_updated_at();
create trigger level_alert_decisions_set_updated_at before update on service_desk.level_alert_decisions for each row execute function service_desk.set_updated_at();

create function service_desk.protect_level_alert_decision()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'alert decisions are retained';
  end if;
  if row(new.id, new.organization_id, new.receipt_id, new.rule_id, new.ticket_id,
         new.outcome, new.reason_code, new.explanation, new.correlation_key, new.created_at)
     is distinct from
     row(old.id, old.organization_id, old.receipt_id, old.rule_id, old.ticket_id,
         old.outcome, old.reason_code, old.explanation, old.correlation_key, old.created_at) then
    raise exception using errcode = '55000', message = 'alert decision evidence is immutable';
  end if;
  return new;
end;
$$;
create trigger level_alert_decisions_protect
before update or delete on service_desk.level_alert_decisions
for each row execute function service_desk.protect_level_alert_decision();

create or replace function service_desk.protect_level_webhook_receipt()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'webhook receipts are retained';
  end if;
  if row(new.id, new.organization_id, new.external_event_id, new.event_type,
         new.resource_key, new.occurred_at, new.received_at, new.correlation_id,
         new.alert_id, new.alert_device_id, new.alert_device_name, new.alert_name,
         new.alert_description, new.alert_payload, new.alert_severity,
         new.alert_is_resolved, new.alert_started_at, new.alert_resolved_at,
         new.alert_data_valid, new.created_at)
     is distinct from
     row(old.id, old.organization_id, old.external_event_id, old.event_type,
         old.resource_key, old.occurred_at, old.received_at, old.correlation_id,
         old.alert_id, old.alert_device_id, old.alert_device_name, old.alert_name,
         old.alert_description, old.alert_payload, old.alert_severity,
         old.alert_is_resolved, old.alert_started_at, old.alert_resolved_at,
         old.alert_data_valid, old.created_at) then
    raise exception using errcode = '55000', message = 'webhook receipt identity is immutable';
  end if;
  return new;
end;
$$;

revoke all on table service_desk.level_alert_rules from anon, authenticated;
revoke all on table service_desk.level_alert_correlations from anon, authenticated;
revoke all on table service_desk.level_alert_decisions from anon, authenticated;
