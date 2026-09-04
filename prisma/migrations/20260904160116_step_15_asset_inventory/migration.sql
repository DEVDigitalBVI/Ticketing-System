-- Step 15: business-owned asset inventory and immutable movement history.

alter table service_desk.service_locations
  add constraint service_locations_id_building_area_id_property_id_organization_id_key
  unique (id, building_area_id, property_id, organization_id);

create table service_desk.asset_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz(6) not null default current_timestamp,
  updated_at timestamptz(6) not null default current_timestamp,
  constraint asset_types_id_organization_id_key unique (id, organization_id),
  constraint asset_types_organization_id_code_key unique (organization_id, code),
  constraint asset_types_code_format check (code ~ '^[a-z][a-z0-9_]{1,49}$'),
  constraint asset_types_name_not_blank check (btrim(name) <> ''),
  constraint asset_types_organization_id_fkey foreign key (organization_id)
    references service_desk.organizations (id) on delete restrict on update cascade
);

create index asset_types_organization_id_is_active_idx
  on service_desk.asset_types (organization_id, is_active);

create table service_desk.asset_statuses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  code text not null,
  name text not null,
  is_terminal boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz(6) not null default current_timestamp,
  updated_at timestamptz(6) not null default current_timestamp,
  constraint asset_statuses_id_organization_id_key unique (id, organization_id),
  constraint asset_statuses_organization_id_code_key unique (organization_id, code),
  constraint asset_statuses_code_format check (code ~ '^[a-z][a-z0-9_]{1,49}$'),
  constraint asset_statuses_name_not_blank check (btrim(name) <> ''),
  constraint asset_statuses_organization_id_fkey foreign key (organization_id)
    references service_desk.organizations (id) on delete restrict on update cascade
);

create index asset_statuses_organization_id_is_active_idx
  on service_desk.asset_statuses (organization_id, is_active);

create table service_desk.assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  asset_tag text not null,
  serial_number text,
  name text not null,
  description text,
  asset_type_id uuid not null,
  asset_status_id uuid not null,
  property_id uuid not null,
  building_area_id uuid,
  service_location_id uuid,
  department_id uuid,
  custodian_user_id uuid,
  criticality text not null default 'standard',
  manufacturer text,
  model text,
  acquired_at date,
  retired_at timestamptz(6),
  retirement_reason text,
  created_at timestamptz(6) not null default current_timestamp,
  updated_at timestamptz(6) not null default current_timestamp,
  constraint assets_id_organization_id_key unique (id, organization_id),
  constraint assets_asset_tag_not_blank check (btrim(asset_tag) <> ''),
  constraint assets_name_not_blank check (btrim(name) <> ''),
  constraint assets_serial_number_not_blank check (serial_number is null or btrim(serial_number) <> ''),
  constraint assets_criticality_allowed check (criticality in ('low', 'standard', 'high', 'mission_critical')),
  constraint assets_location_hierarchy check (service_location_id is null or building_area_id is not null),
  constraint assets_retirement_consistent check (
    (retired_at is null and retirement_reason is null)
    or (retired_at is not null and retirement_reason is not null and btrim(retirement_reason) <> '')
  ),
  constraint assets_organization_id_fkey foreign key (organization_id)
    references service_desk.organizations (id) on delete restrict on update cascade,
  constraint assets_asset_type_id_organization_id_fkey foreign key (asset_type_id, organization_id)
    references service_desk.asset_types (id, organization_id) on delete restrict on update cascade,
  constraint assets_asset_status_id_organization_id_fkey foreign key (asset_status_id, organization_id)
    references service_desk.asset_statuses (id, organization_id) on delete restrict on update cascade,
  constraint assets_property_id_organization_id_fkey foreign key (property_id, organization_id)
    references service_desk.properties (id, organization_id) on delete restrict on update cascade,
  constraint assets_building_area_id_property_id_organization_id_fkey foreign key (building_area_id, property_id, organization_id)
    references service_desk.building_areas (id, property_id, organization_id) on delete restrict on update cascade,
  constraint assets_service_location_hierarchy_fkey foreign key (service_location_id, building_area_id, property_id, organization_id)
    references service_desk.service_locations (id, building_area_id, property_id, organization_id) on delete restrict on update cascade,
  constraint assets_department_id_property_id_organization_id_fkey foreign key (department_id, property_id, organization_id)
    references service_desk.departments (id, property_id, organization_id) on delete restrict on update cascade,
  constraint assets_custodian_user_id_organization_id_fkey foreign key (custodian_user_id, organization_id)
    references service_desk.users (id, organization_id) on delete restrict on update cascade
);

create unique index assets_organization_asset_tag_ci_key
  on service_desk.assets (organization_id, lower(asset_tag));
create unique index assets_organization_serial_number_ci_key
  on service_desk.assets (organization_id, lower(serial_number)) where serial_number is not null;
create index assets_property_status_updated_idx
  on service_desk.assets (property_id, asset_status_id, updated_at desc);
create index assets_asset_type_organization_idx on service_desk.assets (asset_type_id, organization_id);
create index assets_asset_status_organization_idx on service_desk.assets (asset_status_id, organization_id);
create index assets_building_property_organization_idx on service_desk.assets (building_area_id, property_id, organization_id);
create index assets_location_hierarchy_idx on service_desk.assets (service_location_id, building_area_id, property_id, organization_id);
create index assets_department_property_organization_idx on service_desk.assets (department_id, property_id, organization_id);
create index assets_custodian_organization_idx on service_desk.assets (custodian_user_id, organization_id);

create table service_desk.asset_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  asset_id uuid not null,
  property_id uuid not null,
  custodian_user_id uuid,
  department_id uuid,
  assigned_by_user_id uuid not null,
  note text,
  assigned_at timestamptz(6) not null,
  ended_at timestamptz(6),
  constraint asset_assignments_time_order check (ended_at is null or ended_at >= assigned_at),
  constraint asset_assignments_target_present check (custodian_user_id is not null or department_id is not null),
  constraint asset_assignments_note_not_blank check (note is null or btrim(note) <> ''),
  constraint asset_assignments_organization_id_fkey foreign key (organization_id)
    references service_desk.organizations (id) on delete restrict on update cascade,
  constraint asset_assignments_asset_id_organization_id_fkey foreign key (asset_id, organization_id)
    references service_desk.assets (id, organization_id) on delete restrict on update cascade,
  constraint asset_assignments_property_id_organization_id_fkey foreign key (property_id, organization_id)
    references service_desk.properties (id, organization_id) on delete restrict on update cascade,
  constraint asset_assignments_custodian_user_id_organization_id_fkey foreign key (custodian_user_id, organization_id)
    references service_desk.users (id, organization_id) on delete restrict on update cascade,
  constraint asset_assignments_department_id_property_id_organization_id_fkey foreign key (department_id, property_id, organization_id)
    references service_desk.departments (id, property_id, organization_id) on delete restrict on update cascade,
  constraint asset_assignments_assigned_by_user_id_organization_id_fkey foreign key (assigned_by_user_id, organization_id)
    references service_desk.users (id, organization_id) on delete restrict on update cascade
);

create unique index asset_assignments_one_current_idx
  on service_desk.asset_assignments (asset_id) where ended_at is null;
create index asset_assignments_asset_history_idx on service_desk.asset_assignments (asset_id, organization_id, assigned_at desc);
create index asset_assignments_property_idx on service_desk.asset_assignments (property_id, organization_id);
create index asset_assignments_custodian_idx on service_desk.asset_assignments (custodian_user_id, organization_id);
create index asset_assignments_department_idx on service_desk.asset_assignments (department_id, property_id, organization_id);
create index asset_assignments_actor_idx on service_desk.asset_assignments (assigned_by_user_id, organization_id);

create table service_desk.asset_location_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  asset_id uuid not null,
  from_property_id uuid,
  from_building_area_id uuid,
  from_service_location_id uuid,
  to_property_id uuid not null,
  to_building_area_id uuid,
  to_service_location_id uuid,
  moved_by_user_id uuid not null,
  reason text not null,
  moved_at timestamptz(6) not null,
  constraint asset_location_history_reason_not_blank check (btrim(reason) <> ''),
  constraint asset_location_history_from_hierarchy check (from_service_location_id is null or from_building_area_id is not null),
  constraint asset_location_history_to_hierarchy check (to_service_location_id is null or to_building_area_id is not null),
  constraint asset_location_history_organization_id_fkey foreign key (organization_id)
    references service_desk.organizations (id) on delete restrict on update cascade,
  constraint asset_location_history_asset_id_organization_id_fkey foreign key (asset_id, organization_id)
    references service_desk.assets (id, organization_id) on delete restrict on update cascade,
  constraint asset_location_history_from_property_fkey foreign key (from_property_id, organization_id)
    references service_desk.properties (id, organization_id) on delete restrict on update cascade,
  constraint asset_location_history_from_building_fkey foreign key (from_building_area_id, from_property_id, organization_id)
    references service_desk.building_areas (id, property_id, organization_id) on delete restrict on update cascade,
  constraint asset_location_history_from_location_fkey foreign key (from_service_location_id, from_building_area_id, from_property_id, organization_id)
    references service_desk.service_locations (id, building_area_id, property_id, organization_id) on delete restrict on update cascade,
  constraint asset_location_history_to_property_fkey foreign key (to_property_id, organization_id)
    references service_desk.properties (id, organization_id) on delete restrict on update cascade,
  constraint asset_location_history_to_building_fkey foreign key (to_building_area_id, to_property_id, organization_id)
    references service_desk.building_areas (id, property_id, organization_id) on delete restrict on update cascade,
  constraint asset_location_history_to_location_fkey foreign key (to_service_location_id, to_building_area_id, to_property_id, organization_id)
    references service_desk.service_locations (id, building_area_id, property_id, organization_id) on delete restrict on update cascade,
  constraint asset_location_history_actor_fkey foreign key (moved_by_user_id, organization_id)
    references service_desk.users (id, organization_id) on delete restrict on update cascade
);

create index asset_location_history_asset_idx on service_desk.asset_location_history (asset_id, organization_id, moved_at desc);
create index asset_location_history_from_property_idx on service_desk.asset_location_history (from_property_id, organization_id);
create index asset_location_history_from_building_idx on service_desk.asset_location_history (from_building_area_id, from_property_id, organization_id);
create index asset_location_history_from_location_idx on service_desk.asset_location_history (from_service_location_id, from_building_area_id, from_property_id, organization_id);
create index asset_location_history_to_property_idx on service_desk.asset_location_history (to_property_id, organization_id);
create index asset_location_history_to_building_idx on service_desk.asset_location_history (to_building_area_id, to_property_id, organization_id);
create index asset_location_history_to_location_idx on service_desk.asset_location_history (to_service_location_id, to_building_area_id, to_property_id, organization_id);
create index asset_location_history_actor_idx on service_desk.asset_location_history (moved_by_user_id, organization_id);

create table service_desk.vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  contact_name text,
  email text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz(6) not null default current_timestamp,
  updated_at timestamptz(6) not null default current_timestamp,
  constraint vendors_id_organization_id_key unique (id, organization_id),
  constraint vendors_name_not_blank check (btrim(name) <> ''),
  constraint vendors_organization_id_fkey foreign key (organization_id)
    references service_desk.organizations (id) on delete restrict on update cascade
);
create unique index vendors_organization_name_ci_key on service_desk.vendors (organization_id, lower(name));
create index vendors_organization_active_name_idx on service_desk.vendors (organization_id, is_active, name);

create table service_desk.procurement_metadata (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  asset_id uuid not null,
  vendor_id uuid,
  purchase_date date,
  purchase_cost numeric(12,2),
  currency_code char(3),
  purchase_order text,
  warranty_start date,
  warranty_end date,
  warranty_reference text,
  notes text,
  created_at timestamptz(6) not null default current_timestamp,
  updated_at timestamptz(6) not null default current_timestamp,
  constraint procurement_metadata_asset_id_key unique (asset_id),
  constraint procurement_metadata_asset_id_organization_id_key unique (asset_id, organization_id),
  constraint procurement_metadata_purchase_cost_nonnegative check (purchase_cost is null or purchase_cost >= 0),
  constraint procurement_metadata_currency_format check (currency_code is null or currency_code ~ '^[A-Z]{3}$'),
  constraint procurement_metadata_warranty_order check (warranty_end is null or warranty_start is null or warranty_end >= warranty_start),
  constraint procurement_metadata_organization_id_fkey foreign key (organization_id)
    references service_desk.organizations (id) on delete restrict on update cascade,
  constraint procurement_metadata_asset_id_organization_id_fkey foreign key (asset_id, organization_id)
    references service_desk.assets (id, organization_id) on delete restrict on update cascade,
  constraint procurement_metadata_vendor_id_organization_id_fkey foreign key (vendor_id, organization_id)
    references service_desk.vendors (id, organization_id) on delete restrict on update cascade
);
create index procurement_metadata_organization_idx on service_desk.procurement_metadata (organization_id);
create index procurement_metadata_vendor_idx on service_desk.procurement_metadata (vendor_id, organization_id);
create index procurement_metadata_warranty_end_idx on service_desk.procurement_metadata (warranty_end);

create table service_desk.external_system_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  asset_id uuid not null,
  system_key text not null,
  external_id text not null,
  external_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz(6) not null default current_timestamp,
  updated_at timestamptz(6) not null default current_timestamp,
  constraint external_system_links_asset_system_key unique (asset_id, system_key),
  constraint external_system_links_external_identity unique (organization_id, system_key, external_id),
  constraint external_system_links_system_key_format check (system_key ~ '^[a-z][a-z0-9_]{1,49}$'),
  constraint external_system_links_external_id_not_blank check (btrim(external_id) <> ''),
  constraint external_system_links_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint external_system_links_organization_id_fkey foreign key (organization_id)
    references service_desk.organizations (id) on delete restrict on update cascade,
  constraint external_system_links_asset_id_organization_id_fkey foreign key (asset_id, organization_id)
    references service_desk.assets (id, organization_id) on delete restrict on update cascade
);
create index external_system_links_asset_organization_idx on service_desk.external_system_links (asset_id, organization_id);

alter table service_desk.asset_types add constraint asset_types_timestamps_ordered check (updated_at >= created_at);
alter table service_desk.asset_statuses add constraint asset_statuses_timestamps_ordered check (updated_at >= created_at);
alter table service_desk.assets add constraint assets_timestamps_ordered check (updated_at >= created_at);
alter table service_desk.vendors add constraint vendors_timestamps_ordered check (updated_at >= created_at);
alter table service_desk.procurement_metadata add constraint procurement_metadata_timestamps_ordered check (updated_at >= created_at);
alter table service_desk.external_system_links add constraint external_system_links_timestamps_ordered check (updated_at >= created_at);

create trigger asset_types_set_updated_at before update on service_desk.asset_types
for each row execute function service_desk.set_updated_at();
create trigger asset_statuses_set_updated_at before update on service_desk.asset_statuses
for each row execute function service_desk.set_updated_at();
create trigger assets_set_updated_at before update on service_desk.assets
for each row execute function service_desk.set_updated_at();
create trigger vendors_set_updated_at before update on service_desk.vendors
for each row execute function service_desk.set_updated_at();
create trigger procurement_metadata_set_updated_at before update on service_desk.procurement_metadata
for each row execute function service_desk.set_updated_at();
create trigger external_system_links_set_updated_at before update on service_desk.external_system_links
for each row execute function service_desk.set_updated_at();

create or replace function service_desk.validate_asset_lifecycle()
returns trigger language plpgsql set search_path = pg_catalog as $$
declare terminal_status boolean;
begin
  select s.is_terminal into terminal_status
  from service_desk.asset_statuses s
  where s.id = new.asset_status_id and s.organization_id = new.organization_id;
  if terminal_status is null then
    raise exception using errcode = '23514', message = 'asset status is invalid';
  end if;
  if terminal_status <> (new.retired_at is not null) then
    raise exception using errcode = '23514', message = 'asset lifecycle status and retirement details disagree';
  end if;
  return new;
end;
$$;
create trigger assets_validate_lifecycle before insert or update on service_desk.assets
for each row execute function service_desk.validate_asset_lifecycle();

create or replace function service_desk.prevent_asset_delete()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  raise exception using errcode = '55000', message = 'assets are retired, not deleted';
end;
$$;
create trigger assets_prevent_delete before delete on service_desk.assets
for each row execute function service_desk.prevent_asset_delete();

create or replace function service_desk.protect_asset_history()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if tg_op = 'DELETE' or tg_table_name = 'asset_location_history' then
    raise exception using errcode = '55000', message = 'asset history is immutable';
  end if;
  if row(new.id, new.organization_id, new.asset_id, new.property_id, new.custodian_user_id, new.department_id,
         new.assigned_by_user_id, new.note, new.assigned_at)
     is distinct from
     row(old.id, old.organization_id, old.asset_id, old.property_id, old.custodian_user_id, old.department_id,
         old.assigned_by_user_id, old.note, old.assigned_at)
     or old.ended_at is not null
     or new.ended_at is null then
    raise exception using errcode = '55000', message = 'asset assignment history is immutable';
  end if;
  return new;
end;
$$;
create trigger asset_assignments_protect_history before update or delete on service_desk.asset_assignments
for each row execute function service_desk.protect_asset_history();
create trigger asset_location_history_protect_history before update or delete on service_desk.asset_location_history
for each row execute function service_desk.protect_asset_history();

insert into service_desk.asset_types (organization_id, code, name)
select o.id, seed.code, seed.name
from service_desk.organizations o
cross join (values
  ('workstation', 'Workstation'), ('laptop', 'Laptop'), ('printer', 'Printer'),
  ('network_equipment', 'Network equipment'), ('phone', 'Phone'),
  ('point_of_sale', 'Point-of-sale device'), ('television', 'Television'),
  ('audio_visual', 'Audio-visual equipment'), ('server', 'Server'),
  ('shared_device', 'Shared device')
) as seed(code, name)
on conflict (organization_id, code) do nothing;

insert into service_desk.asset_statuses (organization_id, code, name, is_terminal)
select o.id, seed.code, seed.name, seed.is_terminal
from service_desk.organizations o
cross join (values
  ('in_stock', 'In stock', false), ('deployed', 'Deployed', false),
  ('in_repair', 'In repair', false), ('retired', 'Retired', true),
  ('disposed', 'Disposed', true)
) as seed(code, name, is_terminal)
on conflict (organization_id, code) do nothing;
