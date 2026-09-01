-- Step 7: administrator-managed resort hierarchy and service taxonomy.

alter table service_desk.properties
  drop constraint if exists properties_organization_id_code_key,
  drop constraint if exists properties_organization_id_name_key;

create unique index if not exists properties_active_code_unique_idx
  on service_desk.properties (organization_id, code)
  where is_active;

create unique index if not exists properties_active_name_unique_idx
  on service_desk.properties (organization_id, lower(btrim(name)))
  where is_active;

alter table service_desk.departments
  drop constraint if exists departments_property_id_code_key,
  drop constraint if exists departments_property_id_name_key,
  add constraint departments_id_property_id_organization_id_key unique (id, property_id, organization_id);

create unique index if not exists departments_active_code_unique_idx
  on service_desk.departments (property_id, code)
  where is_active;

create unique index if not exists departments_active_name_unique_idx
  on service_desk.departments (property_id, lower(btrim(name)))
  where is_active;

create table service_desk.building_areas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  property_id uuid not null,
  code text not null,
  name text not null,
  kind text not null,
  is_active boolean not null default true,
  created_at timestamptz(6) not null default current_timestamp,
  updated_at timestamptz(6) not null default current_timestamp,
  constraint building_areas_id_organization_id_key unique (id, organization_id),
  constraint building_areas_id_property_id_organization_id_key unique (id, property_id, organization_id),
  constraint building_areas_code_format check (code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  constraint building_areas_name_not_blank check (btrim(name) <> ''),
  constraint building_areas_kind_allowed check (kind in ('building', 'area')),
  constraint building_areas_timestamps_ordered check (updated_at >= created_at),
  constraint building_areas_property_id_organization_id_fkey
    foreign key (property_id, organization_id)
    references service_desk.properties (id, organization_id)
    on delete restrict on update cascade
);

create index building_areas_organization_id_idx
  on service_desk.building_areas (organization_id);

create index building_areas_property_id_organization_id_idx
  on service_desk.building_areas (property_id, organization_id);

create unique index building_areas_active_code_unique_idx
  on service_desk.building_areas (property_id, code)
  where is_active;

create unique index building_areas_active_name_unique_idx
  on service_desk.building_areas (property_id, lower(btrim(name)))
  where is_active;

create table service_desk.service_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  property_id uuid not null,
  building_area_id uuid not null,
  code text not null,
  name text not null,
  kind text not null,
  is_active boolean not null default true,
  created_at timestamptz(6) not null default current_timestamp,
  updated_at timestamptz(6) not null default current_timestamp,
  constraint service_locations_id_organization_id_key unique (id, organization_id),
  constraint service_locations_code_format check (code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  constraint service_locations_name_not_blank check (btrim(name) <> ''),
  constraint service_locations_kind_allowed check (kind in ('room', 'service_location')),
  constraint service_locations_timestamps_ordered check (updated_at >= created_at),
  constraint service_locations_property_id_organization_id_fkey
    foreign key (property_id, organization_id)
    references service_desk.properties (id, organization_id)
    on delete restrict on update cascade,
  constraint service_locations_building_area_id_property_id_organization_id_fkey
    foreign key (building_area_id, property_id, organization_id)
    references service_desk.building_areas (id, property_id, organization_id)
    on delete restrict on update cascade
);

create index service_locations_organization_id_idx
  on service_desk.service_locations (organization_id);

create index service_locations_property_id_organization_id_idx
  on service_desk.service_locations (property_id, organization_id);

create index service_locations_building_area_id_property_id_organization_id_idx
  on service_desk.service_locations (building_area_id, property_id, organization_id);

create unique index service_locations_active_code_unique_idx
  on service_desk.service_locations (building_area_id, code)
  where is_active;

create unique index service_locations_active_name_unique_idx
  on service_desk.service_locations (building_area_id, lower(btrim(name)))
  where is_active;

create table service_desk.support_teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  property_id uuid not null,
  department_id uuid,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz(6) not null default current_timestamp,
  updated_at timestamptz(6) not null default current_timestamp,
  constraint support_teams_id_organization_id_key unique (id, organization_id),
  constraint support_teams_code_format check (code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  constraint support_teams_name_not_blank check (btrim(name) <> ''),
  constraint support_teams_timestamps_ordered check (updated_at >= created_at),
  constraint support_teams_property_id_organization_id_fkey
    foreign key (property_id, organization_id)
    references service_desk.properties (id, organization_id)
    on delete restrict on update cascade,
  constraint support_teams_department_id_property_id_organization_id_fkey
    foreign key (department_id, property_id, organization_id)
    references service_desk.departments (id, property_id, organization_id)
    on delete restrict on update cascade
);

create index support_teams_organization_id_idx
  on service_desk.support_teams (organization_id);

create index support_teams_property_id_organization_id_idx
  on service_desk.support_teams (property_id, organization_id);

create index support_teams_department_id_property_id_organization_id_idx
  on service_desk.support_teams (department_id, property_id, organization_id);

create unique index support_teams_active_code_unique_idx
  on service_desk.support_teams (property_id, code)
  where is_active;

create unique index support_teams_active_name_unique_idx
  on service_desk.support_teams (property_id, lower(btrim(name)))
  where is_active;

create table service_desk.ticket_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz(6) not null default current_timestamp,
  updated_at timestamptz(6) not null default current_timestamp,
  constraint ticket_categories_id_organization_id_key unique (id, organization_id),
  constraint ticket_categories_code_format check (code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  constraint ticket_categories_name_not_blank check (btrim(name) <> ''),
  constraint ticket_categories_timestamps_ordered check (updated_at >= created_at),
  constraint ticket_categories_organization_id_fkey
    foreign key (organization_id)
    references service_desk.organizations (id) on delete restrict on update cascade
);

create index ticket_categories_organization_id_idx
  on service_desk.ticket_categories (organization_id);

create unique index ticket_categories_active_code_unique_idx
  on service_desk.ticket_categories (organization_id, code)
  where is_active;

create unique index ticket_categories_active_name_unique_idx
  on service_desk.ticket_categories (organization_id, lower(btrim(name)))
  where is_active;

create table service_desk.ticket_subcategories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  category_id uuid not null,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz(6) not null default current_timestamp,
  updated_at timestamptz(6) not null default current_timestamp,
  constraint ticket_subcategories_id_organization_id_key unique (id, organization_id),
  constraint ticket_subcategories_code_format check (code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  constraint ticket_subcategories_name_not_blank check (btrim(name) <> ''),
  constraint ticket_subcategories_timestamps_ordered check (updated_at >= created_at),
  constraint ticket_subcategories_category_id_organization_id_fkey
    foreign key (category_id, organization_id)
    references service_desk.ticket_categories (id, organization_id)
    on delete restrict on update cascade
);

create index ticket_subcategories_organization_id_idx
  on service_desk.ticket_subcategories (organization_id);

create index ticket_subcategories_category_id_organization_id_idx
  on service_desk.ticket_subcategories (category_id, organization_id);

create unique index ticket_subcategories_active_code_unique_idx
  on service_desk.ticket_subcategories (category_id, code)
  where is_active;

create unique index ticket_subcategories_active_name_unique_idx
  on service_desk.ticket_subcategories (category_id, lower(btrim(name)))
  where is_active;

create trigger building_areas_set_updated_at
before update on service_desk.building_areas
for each row execute function service_desk.set_updated_at();

create trigger service_locations_set_updated_at
before update on service_desk.service_locations
for each row execute function service_desk.set_updated_at();

create trigger support_teams_set_updated_at
before update on service_desk.support_teams
for each row execute function service_desk.set_updated_at();

create trigger ticket_categories_set_updated_at
before update on service_desk.ticket_categories
for each row execute function service_desk.set_updated_at();

create trigger ticket_subcategories_set_updated_at
before update on service_desk.ticket_subcategories
for each row execute function service_desk.set_updated_at();

insert into service_desk.departments (id, organization_id, property_id, code, name)
values
  ('56b9da6f-ab84-48d1-8b88-c0dd55092b76', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f', 'front_office', 'Front Office'),
  ('16bd6d77-b7c6-47fb-b9d7-3d44fe9bbd54', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f', 'food_and_beverage', 'Food and Beverage'),
  ('4f4fc4bc-c0cc-42c1-9d72-30fb4e2a4c16', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f', 'housekeeping', 'Housekeeping'),
  ('6d93e5bf-c2db-4d42-a53a-b0ee460efb8d', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f', 'spa_and_wellness', 'Spa and Wellness'),
  ('ee6f38e3-a91d-4dd8-85c3-12e1f91dd4c9', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f', 'marine_and_recreation', 'Marine and Recreation'),
  ('dd5dcb32-7eb0-4127-9be0-46dfd53bd418', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f', 'finance_and_admin', 'Finance and Administration')
on conflict (id, organization_id) do update
set property_id = excluded.property_id,
    code = excluded.code,
    name = excluded.name,
    is_active = true;

insert into service_desk.building_areas (id, organization_id, property_id, code, name, kind)
values
  ('8c452bab-cc6d-4615-b73c-7b7fb5dc9ac0', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f', 'great_harbour_arrivals', 'Great Harbour Arrivals', 'area'),
  ('b63ba9c4-a898-451b-afbe-a232615b8a60', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f', 'beachfront_villas', 'Beachfront Villas', 'building'),
  ('778aa7a2-b1f8-4949-aaee-3317f618aa8c', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f', 'spa_pavilion', 'Spa Pavilion', 'building'),
  ('44cb695f-64c6-454e-8b98-756f4a7558a0', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f', 'marina_village', 'Marina Village', 'area'),
  ('50ec4331-13dc-4d09-ac83-c8f1d89e0d90', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f', 'the_drake_restaurant', 'The Drake Restaurant', 'building')
on conflict (id, organization_id) do update
set property_id = excluded.property_id,
    code = excluded.code,
    name = excluded.name,
    kind = excluded.kind,
    is_active = true;

insert into service_desk.service_locations (
  id, organization_id, property_id, building_area_id, code, name, kind
)
values
  ('c7a17b7c-55e1-49d4-aac4-d0e56cfa15f7', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f', '8c452bab-cc6d-4615-b73c-7b7fb5dc9ac0', 'arrival_lounge', 'Arrival Lounge', 'service_location'),
  ('940549de-fdde-45e8-8138-f53f7737532c', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f', 'b63ba9c4-a898-451b-afbe-a232615b8a60', 'villa_101', 'Villa 101', 'room'),
  ('27be8cb5-a1d8-4ce5-b9de-c565ae483bc6', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f', 'b63ba9c4-a898-451b-afbe-a232615b8a60', 'villa_102', 'Villa 102', 'room'),
  ('b2eb0210-0592-47f4-a997-5c2c83dce9bb', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f', '778aa7a2-b1f8-4949-aaee-3317f618aa8c', 'treatment_suite_a', 'Treatment Suite A', 'service_location'),
  ('4ff4dfa2-032e-4d4a-98a2-ded702f0c0d1', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f', '44cb695f-64c6-454e-8b98-756f4a7558a0', 'dock_master_office', 'Dock Master Office', 'service_location'),
  ('c3ed9c91-7c7e-4f5b-9976-b7f33735a1a5', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f', '50ec4331-13dc-4d09-ac83-c8f1d89e0d90', 'host_stand', 'Host Stand', 'service_location')
on conflict (id, organization_id) do update
set property_id = excluded.property_id,
    building_area_id = excluded.building_area_id,
    code = excluded.code,
    name = excluded.name,
    kind = excluded.kind,
    is_active = true;

insert into service_desk.support_teams (id, organization_id, property_id, department_id, code, name)
values
  ('74049d0c-4a07-4af5-b0c1-7dfec09b5f79', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f', '56b9da6f-ab84-48d1-8b88-c0dd55092b76', 'front_office_support', 'Front Office Support'),
  ('900f7c4d-9370-4a17-b34b-e4940b9ec71e', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f', '16bd6d77-b7c6-47fb-b9d7-3d44fe9bbd54', 'pos_and_payments', 'POS and Payments'),
  ('3687d8d9-3ccd-44eb-959a-2ee7122d5373', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f', '4f4fc4bc-c0cc-42c1-9d72-30fb4e2a4c16', 'guest_rooms_and_housekeeping', 'Guest Rooms and Housekeeping'),
  ('8d1a7cc7-fcf9-4535-b0bc-fbaad0327b73', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f', null, 'core_it_operations', 'Core IT Operations')
on conflict (id, organization_id) do update
set property_id = excluded.property_id,
    department_id = excluded.department_id,
    code = excluded.code,
    name = excluded.name,
    is_active = true;

insert into service_desk.ticket_categories (id, organization_id, code, name)
values
  ('8d59eaf4-47d0-4202-8f8c-61dd71cfb5ab', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'accounts_and_access', 'Accounts and Access'),
  ('871cf7eb-2658-4cb7-b6b7-bfbfa279d6fd', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'guest_technology', 'Guest Technology'),
  ('ab08a7bf-d558-4fcb-b7fd-74ddc4ba1c2f', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'network_and_wifi', 'Network and Wi-Fi'),
  ('87bba2fe-4d74-45f0-9158-fdb25db7750a', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'point_of_sale', 'Point of Sale'),
  ('4ee77708-c6eb-49c2-81e8-7f2ece553e34', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'workstations', 'Workstations'),
  ('7df399bf-f99f-427b-9c79-b27c4f3970f9', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'printers', 'Printers'),
  ('6c142dc5-c91f-4196-a6bc-f33d2c947fc4', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'telephony', 'Telephony'),
  ('85d2eb57-2995-4831-9c71-840685618f98', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'audio_visual', 'Audio Visual')
on conflict (id, organization_id) do update
set code = excluded.code,
    name = excluded.name,
    is_active = true;

insert into service_desk.ticket_subcategories (id, organization_id, category_id, code, name)
values
  ('f8f0f8a6-4d6f-47d8-a1f6-c10b788eed37', '18b8d97e-9622-4ca7-b344-6230ad863e84', '8d59eaf4-47d0-4202-8f8c-61dd71cfb5ab', 'password_reset', 'Password Reset'),
  ('5af08ed9-d14c-4172-8b3e-bb11ac4644e0', '18b8d97e-9622-4ca7-b344-6230ad863e84', '8d59eaf4-47d0-4202-8f8c-61dd71cfb5ab', 'new_account', 'New Account'),
  ('8146d235-e31b-4127-a9b9-e030860a6c4c', '18b8d97e-9622-4ca7-b344-6230ad863e84', '871cf7eb-2658-4cb7-b6b7-bfbfa279d6fd', 'guest_tv', 'Guest TV'),
  ('53e48d5e-61c4-4f94-9d02-e86335fb0f5c', '18b8d97e-9622-4ca7-b344-6230ad863e84', '871cf7eb-2658-4cb7-b6b7-bfbfa279d6fd', 'guest_tablet', 'Guest Tablet'),
  ('f1972e88-627d-4e80-a3b2-c3c1587ea790', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'ab08a7bf-d558-4fcb-b7fd-74ddc4ba1c2f', 'wifi_outage', 'Wi-Fi Outage'),
  ('b45d6fb5-39ea-45f3-bc3a-bdb84d0da63d', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'ab08a7bf-d558-4fcb-b7fd-74ddc4ba1c2f', 'low_bandwidth', 'Low Bandwidth'),
  ('6ba2ef32-2fde-43ff-8e2a-7f9ab50f34ab', '18b8d97e-9622-4ca7-b344-6230ad863e84', '87bba2fe-4d74-45f0-9158-fdb25db7750a', 'terminal_down', 'Terminal Down'),
  ('7c566d91-9247-46af-8b0f-c8c7c633834e', '18b8d97e-9622-4ca7-b344-6230ad863e84', '4ee77708-c6eb-49c2-81e8-7f2ece553e34', 'desktop_setup', 'Desktop Setup'),
  ('6d7f8cad-e849-4200-94f4-b014d5f4290b', '18b8d97e-9622-4ca7-b344-6230ad863e84', '7df399bf-f99f-427b-9c79-b27c4f3970f9', 'label_printer', 'Label Printer'),
  ('26cd0c09-c2a5-467d-bd72-3c6caa356b0a', '18b8d97e-9622-4ca7-b344-6230ad863e84', '6c142dc5-c91f-4196-a6bc-f33d2c947fc4', 'handset_issue', 'Handset Issue'),
  ('c43455ef-c878-4450-b35b-61975c3c6eb7', '18b8d97e-9622-4ca7-b344-6230ad863e84', '85d2eb57-2995-4831-9c71-840685618f98', 'conference_display', 'Conference Display')
on conflict (id, organization_id) do update
set category_id = excluded.category_id,
    code = excluded.code,
    name = excluded.name,
    is_active = true;
