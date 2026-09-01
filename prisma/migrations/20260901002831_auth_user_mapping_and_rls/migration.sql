alter table service_desk.users
  add column auth_user_id uuid;

alter table service_desk.users
  add column must_change_password boolean not null default true;

alter table service_desk.users
  add constraint users_auth_user_id_key unique (auth_user_id);

alter table service_desk.organizations enable row level security;
alter table service_desk.properties enable row level security;
alter table service_desk.departments enable row level security;
alter table service_desk.users enable row level security;
alter table service_desk.roles enable row level security;
alter table service_desk.user_roles enable row level security;
alter table service_desk.audit_events enable row level security;

create schema if not exists api;
revoke all on schema api from public;

-- Production reference data, not demonstration records. These stable identifiers make
-- clean environments and the hosted project agree on the launch resort and access roles.
insert into service_desk.organizations (id, slug, name)
values ('18b8d97e-9622-4ca7-b344-6230ad863e84', 'peter-island-resort-and-spa', 'Peter Island Resort and Spa')
on conflict (id) do nothing;

insert into service_desk.properties (id, organization_id, code, name, timezone)
values (
  'ab9c2f07-e909-4f9d-9092-49ad4e06df1f',
  '18b8d97e-9622-4ca7-b344-6230ad863e84',
  'peter_island',
  'Peter Island Resort and Spa',
  'America/Tortola'
)
on conflict (id) do nothing;

insert into service_desk.roles (id, organization_id, key, name, description)
values
  ('c97ef5e8-0323-409b-8721-8f2a66bf180d', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'staff', 'Staff', 'May use the staff service desk.'),
  ('717f9de2-291a-44cc-801d-3dd7d51e56e9', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'technician', 'Technician', 'May use staff and technician workspaces.'),
  ('e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f', '18b8d97e-9622-4ca7-b344-6230ad863e84', 'admin', 'Administrator', 'May administer service desk access.')
on conflict (id) do nothing;

do $migration$
begin
  if to_regprocedure('auth.uid()') is not null
     and exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute $policy$
      create policy users_select_own_active_profile
      on service_desk.users
      for select
      to authenticated
      using (
        auth_user_id = (select auth.uid())
        and is_active
      )
    $policy$;

    execute $policy$
      create policy organizations_select_own_membership
      on service_desk.organizations
      for select
      to authenticated
      using (
        exists (
          select 1
          from service_desk.users as current_user_profile
          where current_user_profile.organization_id = organizations.id
            and current_user_profile.auth_user_id = (select auth.uid())
            and current_user_profile.is_active
        )
      )
    $policy$;

    execute $policy$
      create policy user_roles_select_own_assignments
      on service_desk.user_roles
      for select
      to authenticated
      using (
        exists (
          select 1
          from service_desk.users as current_user_profile
          where current_user_profile.id = user_roles.user_id
            and current_user_profile.organization_id = user_roles.organization_id
            and current_user_profile.auth_user_id = (select auth.uid())
            and current_user_profile.is_active
        )
      )
    $policy$;

    execute $policy$
      create policy properties_select_own_assignments
      on service_desk.properties
      for select
      to authenticated
      using (
        is_active
        and exists (
          select 1
          from service_desk.user_roles as own_assignment
          join service_desk.users as current_user_profile
            on current_user_profile.id = own_assignment.user_id
           and current_user_profile.organization_id = own_assignment.organization_id
          where own_assignment.property_id = properties.id
            and own_assignment.organization_id = properties.organization_id
            and current_user_profile.auth_user_id = (select auth.uid())
            and current_user_profile.is_active
        )
      )
    $policy$;

    execute $policy$
      create policy departments_select_own_properties
      on service_desk.departments
      for select
      to authenticated
      using (
        is_active
        and exists (
          select 1
          from service_desk.user_roles as own_assignment
          join service_desk.users as current_user_profile
            on current_user_profile.id = own_assignment.user_id
           and current_user_profile.organization_id = own_assignment.organization_id
          where own_assignment.property_id = departments.property_id
            and own_assignment.organization_id = departments.organization_id
            and current_user_profile.auth_user_id = (select auth.uid())
            and current_user_profile.is_active
        )
      )
    $policy$;

    execute $policy$
      create policy roles_select_own_assignments
      on service_desk.roles
      for select
      to authenticated
      using (
        exists (
          select 1
          from service_desk.user_roles as own_assignment
          join service_desk.users as current_user_profile
            on current_user_profile.id = own_assignment.user_id
           and current_user_profile.organization_id = own_assignment.organization_id
          where own_assignment.role_id = roles.id
            and own_assignment.organization_id = roles.organization_id
            and current_user_profile.auth_user_id = (select auth.uid())
            and current_user_profile.is_active
        )
      )
    $policy$;

    execute $view$
      create view api.current_user_access
      with (security_invoker = true)
      as
      select
        domain_user.id as user_id,
        domain_user.auth_user_id,
        domain_user.email,
        domain_user.display_name,
        domain_user.must_change_password,
        domain_user.organization_id,
        organization.name as organization_name,
        property.id as property_id,
        property.name as property_name,
        role.key as role_key
      from service_desk.users as domain_user
      join service_desk.organizations as organization
        on organization.id = domain_user.organization_id
      join service_desk.user_roles as assignment
        on assignment.user_id = domain_user.id
       and assignment.organization_id = domain_user.organization_id
      join service_desk.properties as property
        on property.id = assignment.property_id
       and property.organization_id = assignment.organization_id
      join service_desk.roles as role
        on role.id = assignment.role_id
       and role.organization_id = assignment.organization_id
      where domain_user.auth_user_id = (select auth.uid())
        and domain_user.is_active
        and property.is_active
    $view$;

    grant usage on schema api to authenticated;
    grant select on api.current_user_access to authenticated;
    grant usage on schema service_desk to authenticated;
    grant select on
      service_desk.organizations,
      service_desk.properties,
      service_desk.departments,
      service_desk.users,
      service_desk.roles,
      service_desk.user_roles
    to authenticated;

    revoke all on service_desk.audit_events from anon, authenticated;
    revoke all on all tables in schema service_desk from anon;
    revoke all on api.current_user_access from anon;
  else
    create view api.current_user_access
    with (security_invoker = true)
    as
    select
      domain_user.id as user_id,
      domain_user.auth_user_id,
      domain_user.email,
      domain_user.display_name,
      domain_user.must_change_password,
      domain_user.organization_id,
      organization.name as organization_name,
      property.id as property_id,
      property.name as property_name,
      role.key as role_key
    from service_desk.users as domain_user
    join service_desk.organizations as organization
      on organization.id = domain_user.organization_id
    join service_desk.user_roles as assignment
      on assignment.user_id = domain_user.id
     and assignment.organization_id = domain_user.organization_id
    join service_desk.properties as property
      on property.id = assignment.property_id
     and property.organization_id = assignment.organization_id
    join service_desk.roles as role
      on role.id = assignment.role_id
     and role.organization_id = assignment.organization_id
    where false;
  end if;
end
$migration$;

do $migration$
begin
  if to_regprocedure('auth.uid()') is not null
     and exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute $function$
      create function api.provision_user(
        target_auth_user_id uuid,
        target_email text,
        target_display_name text,
        target_property_id uuid,
        target_role_key text
      ) returns uuid
      language plpgsql
      security definer
      set search_path = ''
      as $body$
      declare
        actor service_desk.users%rowtype;
        target_organization_id uuid;
        target_role_id uuid;
        created_user_id uuid;
      begin
        if (select auth.uid()) is null or coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2' then
          raise exception using errcode = '42501', message = 'administrator MFA verification required';
        end if;

        select domain_user.* into actor
        from service_desk.users as domain_user
        where domain_user.auth_user_id = (select auth.uid()) and domain_user.is_active;

        if actor.id is null or not exists (
          select 1 from service_desk.user_roles assignment
          join service_desk.roles role
            on role.id = assignment.role_id and role.organization_id = assignment.organization_id
          where assignment.user_id = actor.id and role.key = 'admin'
        ) then
          raise exception using errcode = '42501', message = 'administrator access required';
        end if;

        select property.organization_id into target_organization_id
        from service_desk.properties property
        where property.id = target_property_id and property.is_active
          and property.organization_id = actor.organization_id;

        select role.id into target_role_id
        from service_desk.roles role
        where role.organization_id = target_organization_id and role.key = target_role_key;

        if target_organization_id is null or target_role_id is null then
          raise exception using errcode = '22023', message = 'invalid property or role';
        end if;

        insert into service_desk.users (
          auth_user_id, organization_id, email, display_name, must_change_password
        ) values (
          target_auth_user_id, target_organization_id, lower(target_email), btrim(target_display_name), true
        ) returning id into created_user_id;

        insert into service_desk.user_roles (organization_id, user_id, role_id, property_id)
        values (target_organization_id, created_user_id, target_role_id, target_property_id);

        insert into service_desk.audit_events (
          organization_id, property_id, actor_user_id, action, entity_type, entity_id,
          metadata
        ) values (
          target_organization_id, target_property_id, actor.id, 'user.created', 'user', created_user_id::text,
          jsonb_build_object('role', target_role_key)
        );

        return created_user_id;
      end;
      $body$
    $function$;

    execute $function$
      create function api.complete_initial_password_change() returns void
      language plpgsql
      security definer
      set search_path = ''
      as $body$
      declare current_domain_user service_desk.users%rowtype;
      begin
        select * into current_domain_user from service_desk.users
        where auth_user_id = (select auth.uid()) and is_active;
        if current_domain_user.id is null then
          raise exception using errcode = '42501', message = 'active user profile required';
        end if;
        update service_desk.users set must_change_password = false
        where id = current_domain_user.id;
        insert into service_desk.audit_events (
          organization_id, actor_user_id, action, entity_type, entity_id
        ) values (
          current_domain_user.organization_id, current_domain_user.id,
          'user.initial_password_changed', 'user', current_domain_user.id::text
        );
      end;
      $body$
    $function$;

    execute $function$
      create function api.remove_failed_user_provision(target_auth_user_id uuid) returns void
      language plpgsql
      security definer
      set search_path = ''
      as $body$
      declare actor service_desk.users%rowtype;
      declare target service_desk.users%rowtype;
      begin
        select * into actor from service_desk.users
        where auth_user_id = (select auth.uid()) and is_active;
        if actor.id is null or coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2'
          or not exists (
            select 1 from service_desk.user_roles assignment
            join service_desk.roles role on role.id = assignment.role_id
              and role.organization_id = assignment.organization_id
            where assignment.user_id = actor.id and role.key = 'admin'
          ) then
          raise exception using errcode = '42501', message = 'administrator MFA verification required';
        end if;
        select * into target from service_desk.users
        where auth_user_id = target_auth_user_id and organization_id = actor.organization_id;
        if target.id is not null then
          insert into service_desk.audit_events (
            organization_id, actor_user_id, action, entity_type, entity_id
          ) values (
            actor.organization_id, actor.id, 'user.provision_failed', 'user', target.id::text
          );
          delete from service_desk.users where id = target.id;
        end if;
      end;
      $body$
    $function$;

    revoke all on function api.provision_user(uuid, text, text, uuid, text) from public, anon;
    grant execute on function api.provision_user(uuid, text, text, uuid, text) to authenticated;
    revoke all on function api.complete_initial_password_change() from public, anon;
    grant execute on function api.complete_initial_password_change() to authenticated;
    revoke all on function api.remove_failed_user_provision(uuid) from public, anon;
    grant execute on function api.remove_failed_user_provision(uuid) to authenticated;
  end if;
end
$migration$;

revoke all on api.current_user_access from public;

alter default privileges for role postgres in schema service_desk
  revoke select, insert, update, delete on tables from public;
alter default privileges for role postgres in schema service_desk
  revoke execute on functions from public;
alter default privileges for role postgres in schema api
  revoke select, insert, update, delete on tables from public;
alter default privileges for role postgres in schema api
  revoke execute on functions from public;
