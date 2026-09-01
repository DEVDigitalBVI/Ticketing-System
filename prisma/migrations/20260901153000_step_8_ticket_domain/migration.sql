-- Step 8: core ticket domain, lifecycle, and append-only history.

create sequence if not exists service_desk.ticket_number_seq
  as bigint
  start with 1001
  increment by 1
  minvalue 1001
  no maxvalue
  cache 1;

create or replace function service_desk.set_ticket_number()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.number_sequence is null then
    new.number_sequence := nextval('service_desk.ticket_number_seq'::regclass);
  end if;

  if new.ticket_number is null or btrim(new.ticket_number) = '' then
    new.ticket_number := 'PIR-' || lpad(new.number_sequence::text, 6, '0');
  end if;

  return new;
end;
$$;

create table service_desk.tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  number_sequence bigint not null default nextval('service_desk.ticket_number_seq'::regclass),
  ticket_number text not null,
  summary text not null,
  description text not null,
  requester_user_id uuid not null,
  affected_user_id uuid,
  property_id uuid not null,
  service_location_id uuid,
  department_id uuid,
  category_id uuid not null,
  subcategory_id uuid,
  impact text not null,
  urgency text not null,
  priority text not null default 'P3',
  support_team_id uuid,
  assignee_user_id uuid,
  source text not null default 'portal',
  status text not null default 'new',
  resolution_code text,
  resolution_summary text,
  closure_details text,
  created_at timestamptz(6) not null default current_timestamp,
  updated_at timestamptz(6) not null default current_timestamp,
  triaged_at timestamptz(6),
  assigned_at timestamptz(6),
  started_at timestamptz(6),
  resolved_at timestamptz(6),
  closed_at timestamptz(6),
  cancelled_at timestamptz(6),
  constraint tickets_id_organization_id_key unique (id, organization_id),
  constraint tickets_ticket_number_key unique (ticket_number),
  constraint tickets_number_sequence_key unique (number_sequence),
  constraint tickets_summary_not_blank check (btrim(summary) <> ''),
  constraint tickets_description_not_blank check (btrim(description) <> ''),
  constraint tickets_ticket_number_format check (ticket_number ~ '^PIR-[0-9]{6,}$'),
  constraint tickets_impact_allowed check (impact in ('low', 'medium', 'high', 'critical')),
  constraint tickets_urgency_allowed check (urgency in ('low', 'medium', 'high', 'critical')),
  constraint tickets_priority_allowed check (priority in ('P1', 'P2', 'P3', 'P4')),
  constraint tickets_source_allowed check (source in ('portal', 'email', 'phone', 'walk_up', 'system')),
  constraint tickets_status_allowed check (
    status in (
      'new',
      'triage',
      'assigned',
      'in_progress',
      'waiting_for_requester',
      'waiting_for_vendor',
      'resolved',
      'closed',
      'cancelled'
    )
  ),
  constraint tickets_resolution_code_allowed check (
    resolution_code is null or resolution_code in (
      'resolved',
      'workaround',
      'vendor_fix',
      'duplicate',
      'no_issue_found',
      'request_fulfilled',
      'cancelled'
    )
  ),
  constraint tickets_resolution_summary_required_for_resolution check (
    status not in ('resolved', 'closed') or (resolution_summary is not null and btrim(resolution_summary) <> '')
  ),
  constraint tickets_resolution_code_required_for_resolution check (
    status not in ('resolved', 'closed') or resolution_code is not null
  ),
  constraint tickets_closure_details_required_for_terminal_close check (
    status <> 'closed' or (closure_details is not null and btrim(closure_details) <> '')
  ),
  constraint tickets_closure_details_required_for_cancel check (
    status <> 'cancelled' or (closure_details is not null and btrim(closure_details) <> '')
  ),
  constraint tickets_terminal_timestamps_consistent check (
    (resolved_at is null or resolved_at >= created_at) and
    (closed_at is null or closed_at >= created_at) and
    (cancelled_at is null or cancelled_at >= created_at)
  ),
  constraint tickets_timestamps_ordered check (updated_at >= created_at),
  constraint tickets_organization_id_fkey foreign key (organization_id)
    references service_desk.organizations (id) on delete restrict on update cascade,
  constraint tickets_requester_user_id_organization_id_fkey foreign key (requester_user_id, organization_id)
    references service_desk.users (id, organization_id) on delete restrict on update cascade,
  constraint tickets_affected_user_id_organization_id_fkey foreign key (affected_user_id, organization_id)
    references service_desk.users (id, organization_id) on delete restrict on update cascade,
  constraint tickets_property_id_organization_id_fkey foreign key (property_id, organization_id)
    references service_desk.properties (id, organization_id) on delete restrict on update cascade,
  constraint tickets_service_location_id_property_id_organization_id_fkey foreign key (service_location_id, property_id, organization_id)
    references service_desk.service_locations (id, property_id, organization_id) on delete restrict on update cascade,
  constraint tickets_department_id_property_id_organization_id_fkey foreign key (department_id, property_id, organization_id)
    references service_desk.departments (id, property_id, organization_id) on delete restrict on update cascade,
  constraint tickets_category_id_organization_id_fkey foreign key (category_id, organization_id)
    references service_desk.ticket_categories (id, organization_id) on delete restrict on update cascade,
  constraint tickets_subcategory_id_category_id_organization_id_fkey foreign key (subcategory_id, category_id, organization_id)
    references service_desk.ticket_subcategories (id, category_id, organization_id) on delete restrict on update cascade,
  constraint tickets_support_team_id_property_id_organization_id_fkey foreign key (support_team_id, property_id, organization_id)
    references service_desk.support_teams (id, property_id, organization_id) on delete restrict on update cascade,
  constraint tickets_assignee_user_id_organization_id_fkey foreign key (assignee_user_id, organization_id)
    references service_desk.users (id, organization_id) on delete restrict on update cascade
);

create index tickets_organization_id_created_at_idx
  on service_desk.tickets (organization_id, created_at desc);

create index tickets_property_id_status_created_at_idx
  on service_desk.tickets (property_id, status, created_at desc);

create index tickets_requester_user_id_organization_id_created_at_idx
  on service_desk.tickets (requester_user_id, organization_id, created_at desc);

create index tickets_assignee_user_id_organization_id_updated_at_idx
  on service_desk.tickets (assignee_user_id, organization_id, updated_at desc);

create table service_desk.ticket_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  ticket_id uuid not null,
  actor_user_id uuid,
  activity_type text not null,
  from_status text,
  to_status text,
  requester_visible boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz(6) not null default current_timestamp,
  constraint ticket_activities_activity_type_not_blank check (btrim(activity_type) <> ''),
  constraint ticket_activities_status_values_allowed check (
    (from_status is null or from_status in (
      'new','triage','assigned','in_progress','waiting_for_requester','waiting_for_vendor','resolved','closed','cancelled'
    )) and
    (to_status is null or to_status in (
      'new','triage','assigned','in_progress','waiting_for_requester','waiting_for_vendor','resolved','closed','cancelled'
    ))
  ),
  constraint ticket_activities_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint ticket_activities_organization_id_fkey foreign key (organization_id)
    references service_desk.organizations (id) on delete restrict on update cascade,
  constraint ticket_activities_ticket_id_organization_id_fkey foreign key (ticket_id, organization_id)
    references service_desk.tickets (id, organization_id) on delete cascade on update cascade,
  constraint ticket_activities_actor_user_id_organization_id_fkey foreign key (actor_user_id, organization_id)
    references service_desk.users (id, organization_id) on delete restrict on update cascade
);

create index ticket_activities_organization_id_created_at_idx
  on service_desk.ticket_activities (organization_id, created_at desc);

create index ticket_activities_ticket_id_organization_id_created_at_idx
  on service_desk.ticket_activities (ticket_id, organization_id, created_at);

create table service_desk.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  ticket_id uuid not null,
  author_user_id uuid not null,
  visibility text not null,
  body text not null,
  created_at timestamptz(6) not null default current_timestamp,
  constraint ticket_comments_id_organization_id_key unique (id, organization_id),
  constraint ticket_comments_id_ticket_id_organization_id_key unique (id, ticket_id, organization_id),
  constraint ticket_comments_visibility_allowed check (visibility in ('requester', 'internal')),
  constraint ticket_comments_body_not_blank check (btrim(body) <> ''),
  constraint ticket_comments_organization_id_fkey foreign key (organization_id)
    references service_desk.organizations (id) on delete restrict on update cascade,
  constraint ticket_comments_ticket_id_organization_id_fkey foreign key (ticket_id, organization_id)
    references service_desk.tickets (id, organization_id) on delete cascade on update cascade,
  constraint ticket_comments_author_user_id_organization_id_fkey foreign key (author_user_id, organization_id)
    references service_desk.users (id, organization_id) on delete restrict on update cascade
);

create index ticket_comments_organization_id_created_at_idx
  on service_desk.ticket_comments (organization_id, created_at desc);

create index ticket_comments_ticket_id_organization_id_created_at_idx
  on service_desk.ticket_comments (ticket_id, organization_id, created_at);

create table service_desk.ticket_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  ticket_id uuid not null,
  assigned_by_user_id uuid not null,
  assigned_user_id uuid,
  assigned_support_team_id uuid,
  note text,
  created_at timestamptz(6) not null default current_timestamp,
  constraint ticket_assignments_target_required check (
    assigned_user_id is not null or assigned_support_team_id is not null
  ),
  constraint ticket_assignments_note_not_blank check (
    note is null or btrim(note) <> ''
  ),
  constraint ticket_assignments_organization_id_fkey foreign key (organization_id)
    references service_desk.organizations (id) on delete restrict on update cascade,
  constraint ticket_assignments_ticket_id_organization_id_fkey foreign key (ticket_id, organization_id)
    references service_desk.tickets (id, organization_id) on delete cascade on update cascade,
  constraint ticket_assignments_assigned_by_user_id_organization_id_fkey foreign key (assigned_by_user_id, organization_id)
    references service_desk.users (id, organization_id) on delete restrict on update cascade,
  constraint ticket_assignments_assigned_user_id_organization_id_fkey foreign key (assigned_user_id, organization_id)
    references service_desk.users (id, organization_id) on delete restrict on update cascade,
  constraint ticket_assignments_assigned_support_team_id_organization_id_fkey foreign key (assigned_support_team_id, organization_id)
    references service_desk.support_teams (id, organization_id) on delete restrict on update cascade
);

create index ticket_assignments_organization_id_created_at_idx
  on service_desk.ticket_assignments (organization_id, created_at desc);

create index ticket_assignments_ticket_id_organization_id_created_at_idx
  on service_desk.ticket_assignments (ticket_id, organization_id, created_at);

create table service_desk.attachment_metadata (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  ticket_id uuid not null,
  comment_id uuid,
  uploaded_by_user_id uuid not null,
  visibility text not null,
  file_name text not null,
  content_type text not null,
  byte_size integer not null,
  storage_path text not null,
  created_at timestamptz(6) not null default current_timestamp,
  constraint attachment_metadata_visibility_allowed check (visibility in ('requester', 'internal')),
  constraint attachment_metadata_file_name_not_blank check (btrim(file_name) <> ''),
  constraint attachment_metadata_content_type_not_blank check (btrim(content_type) <> ''),
  constraint attachment_metadata_storage_path_not_blank check (btrim(storage_path) <> ''),
  constraint attachment_metadata_byte_size_positive check (byte_size > 0),
  constraint attachment_metadata_organization_id_fkey foreign key (organization_id)
    references service_desk.organizations (id) on delete restrict on update cascade,
  constraint attachment_metadata_ticket_id_organization_id_fkey foreign key (ticket_id, organization_id)
    references service_desk.tickets (id, organization_id) on delete cascade on update cascade,
  constraint attachment_metadata_comment_id_ticket_id_organization_id_fkey foreign key (comment_id, ticket_id, organization_id)
    references service_desk.ticket_comments (id, ticket_id, organization_id) on delete cascade on update cascade,
  constraint attachment_metadata_uploaded_by_user_id_organization_id_fkey foreign key (uploaded_by_user_id, organization_id)
    references service_desk.users (id, organization_id) on delete restrict on update cascade
);

create index attachment_metadata_organization_id_created_at_idx
  on service_desk.attachment_metadata (organization_id, created_at desc);

create index attachment_metadata_ticket_id_organization_id_created_at_idx
  on service_desk.attachment_metadata (ticket_id, organization_id, created_at);

create index attachment_metadata_comment_id_organization_id_idx
  on service_desk.attachment_metadata (comment_id, organization_id);

create trigger tickets_set_updated_at
before update on service_desk.tickets
for each row execute function service_desk.set_updated_at();

create trigger tickets_set_ticket_number
before insert on service_desk.tickets
for each row execute function service_desk.set_ticket_number();

create or replace function service_desk.reject_ticket_history_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'ticket history records are immutable';
end;
$$;

create trigger ticket_activities_are_immutable
before update or delete on service_desk.ticket_activities
for each row execute function service_desk.reject_ticket_history_mutation();

create trigger ticket_comments_are_immutable
before update or delete on service_desk.ticket_comments
for each row execute function service_desk.reject_ticket_history_mutation();

create trigger ticket_assignments_are_immutable
before update or delete on service_desk.ticket_assignments
for each row execute function service_desk.reject_ticket_history_mutation();

create trigger attachment_metadata_are_immutable
before update or delete on service_desk.attachment_metadata
for each row execute function service_desk.reject_ticket_history_mutation();
