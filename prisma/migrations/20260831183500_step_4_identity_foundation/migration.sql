create schema if not exists service_desk;

revoke all on schema service_desk from public;

create table service_desk.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz(6) not null default current_timestamp,
  updated_at timestamptz(6) not null default current_timestamp,
  constraint organizations_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint organizations_name_not_blank check (btrim(name) <> ''),
  constraint organizations_timestamps_ordered check (updated_at >= created_at)
);

create table service_desk.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  code text not null,
  name text not null,
  timezone text not null,
  is_active boolean not null default true,
  created_at timestamptz(6) not null default current_timestamp,
  updated_at timestamptz(6) not null default current_timestamp,
  constraint properties_id_organization_id_key unique (id, organization_id),
  constraint properties_organization_id_code_key unique (organization_id, code),
  constraint properties_organization_id_name_key unique (organization_id, name),
  constraint properties_code_format check (code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  constraint properties_name_not_blank check (btrim(name) <> ''),
  constraint properties_timezone_not_blank check (btrim(timezone) <> ''),
  constraint properties_timestamps_ordered check (updated_at >= created_at),
  constraint properties_organization_id_fkey foreign key (organization_id)
    references service_desk.organizations (id) on delete restrict on update cascade
);

create index properties_organization_id_idx
  on service_desk.properties (organization_id);

create table service_desk.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  property_id uuid not null,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz(6) not null default current_timestamp,
  updated_at timestamptz(6) not null default current_timestamp,
  constraint departments_id_organization_id_key unique (id, organization_id),
  constraint departments_property_id_code_key unique (property_id, code),
  constraint departments_property_id_name_key unique (property_id, name),
  constraint departments_code_format check (code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  constraint departments_name_not_blank check (btrim(name) <> ''),
  constraint departments_timestamps_ordered check (updated_at >= created_at),
  constraint departments_property_id_organization_id_fkey
    foreign key (property_id, organization_id)
    references service_desk.properties (id, organization_id)
    on delete restrict on update cascade
);

create index departments_organization_id_idx
  on service_desk.departments (organization_id);
create index departments_property_id_organization_id_idx
  on service_desk.departments (property_id, organization_id);

create table service_desk.users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  email text not null,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz(6) not null default current_timestamp,
  updated_at timestamptz(6) not null default current_timestamp,
  constraint users_id_organization_id_key unique (id, organization_id),
  constraint users_organization_id_email_key unique (organization_id, email),
  constraint users_email_normalized check (email = lower(email)),
  constraint users_email_format check (
    email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
  ),
  constraint users_display_name_not_blank check (btrim(display_name) <> ''),
  constraint users_timestamps_ordered check (updated_at >= created_at),
  constraint users_organization_id_fkey foreign key (organization_id)
    references service_desk.organizations (id) on delete restrict on update cascade
);

create index users_organization_id_idx
  on service_desk.users (organization_id);

create table service_desk.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  key text not null,
  name text not null,
  description text,
  created_at timestamptz(6) not null default current_timestamp,
  updated_at timestamptz(6) not null default current_timestamp,
  constraint roles_id_organization_id_key unique (id, organization_id),
  constraint roles_organization_id_key_key unique (organization_id, key),
  constraint roles_key_format check (key ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  constraint roles_name_not_blank check (btrim(name) <> ''),
  constraint roles_timestamps_ordered check (updated_at >= created_at),
  constraint roles_organization_id_fkey foreign key (organization_id)
    references service_desk.organizations (id) on delete restrict on update cascade
);

create index roles_organization_id_idx
  on service_desk.roles (organization_id);

create table service_desk.user_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  role_id uuid not null,
  property_id uuid not null,
  created_at timestamptz(6) not null default current_timestamp,
  updated_at timestamptz(6) not null default current_timestamp,
  constraint user_roles_user_id_role_id_property_id_key
    unique (user_id, role_id, property_id),
  constraint user_roles_timestamps_ordered check (updated_at >= created_at),
  constraint user_roles_organization_id_fkey foreign key (organization_id)
    references service_desk.organizations (id) on delete restrict on update cascade,
  constraint user_roles_user_id_organization_id_fkey
    foreign key (user_id, organization_id)
    references service_desk.users (id, organization_id)
    on delete cascade on update cascade,
  constraint user_roles_role_id_organization_id_fkey
    foreign key (role_id, organization_id)
    references service_desk.roles (id, organization_id)
    on delete restrict on update cascade,
  constraint user_roles_property_id_organization_id_fkey
    foreign key (property_id, organization_id)
    references service_desk.properties (id, organization_id)
    on delete restrict on update cascade
);

create index user_roles_organization_id_idx
  on service_desk.user_roles (organization_id);
create index user_roles_role_id_organization_id_idx
  on service_desk.user_roles (role_id, organization_id);
create index user_roles_property_id_organization_id_idx
  on service_desk.user_roles (property_id, organization_id);

create table service_desk.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  property_id uuid,
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz(6) not null default current_timestamp,
  constraint audit_events_action_not_blank check (btrim(action) <> ''),
  constraint audit_events_entity_type_not_blank check (btrim(entity_type) <> ''),
  constraint audit_events_organization_id_fkey foreign key (organization_id)
    references service_desk.organizations (id) on delete restrict on update cascade,
  constraint audit_events_property_id_organization_id_fkey
    foreign key (property_id, organization_id)
    references service_desk.properties (id, organization_id)
    on delete restrict on update cascade,
  constraint audit_events_actor_user_id_organization_id_fkey
    foreign key (actor_user_id, organization_id)
    references service_desk.users (id, organization_id)
    on delete restrict on update cascade
);

create index audit_events_organization_id_created_at_idx
  on service_desk.audit_events (organization_id, created_at);
create index audit_events_property_id_organization_id_idx
  on service_desk.audit_events (property_id, organization_id);
create index audit_events_actor_user_id_organization_id_idx
  on service_desk.audit_events (actor_user_id, organization_id);

create function service_desk.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = current_timestamp;
  return new;
end;
$$;

create trigger organizations_set_updated_at
before update on service_desk.organizations
for each row execute function service_desk.set_updated_at();
create trigger properties_set_updated_at
before update on service_desk.properties
for each row execute function service_desk.set_updated_at();
create trigger departments_set_updated_at
before update on service_desk.departments
for each row execute function service_desk.set_updated_at();
create trigger users_set_updated_at
before update on service_desk.users
for each row execute function service_desk.set_updated_at();
create trigger roles_set_updated_at
before update on service_desk.roles
for each row execute function service_desk.set_updated_at();
create trigger user_roles_set_updated_at
before update on service_desk.user_roles
for each row execute function service_desk.set_updated_at();

create function service_desk.reject_audit_event_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'audit events are immutable';
end;
$$;

create trigger audit_events_are_immutable
before update or delete on service_desk.audit_events
for each row execute function service_desk.reject_audit_event_mutation();
