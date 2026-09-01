-- Step 6: canonical application roles and append-only, privacy-bounded audit records.

update service_desk.roles
set key = 'requester', name = 'Requester',
    description = 'May submit tickets and view tickets they submitted.'
where key = 'staff';

update service_desk.roles
set key = 'system_administrator', name = 'System Administrator',
    description = 'May administer service desk access and configuration.'
where key = 'admin';

update service_desk.roles
set name = 'Technician',
    description = 'May work assigned property queues and operational ticket actions.'
where key = 'technician';

insert into service_desk.roles (organization_id, key, name, description)
select organization.id, role.key, role.name, role.description
from service_desk.organizations as organization
cross join (values
  ('it_manager', 'IT Manager', 'May supervise ticket operations, assets, Level.io actions, and reporting.'),
  ('report_viewer', 'Auditor / Report Viewer', 'May view reports and audit records without operational write access.'),
  ('department_approver', 'Department Approver', 'Reserved for department-scoped approval once a workflow is introduced.')
) as role(key, name, description)
on conflict (organization_id, key) do update
set name = excluded.name, description = excluded.description;

alter table service_desk.audit_events
  add column result text not null default 'success',
  add column request_correlation_id uuid not null default gen_random_uuid(),
  add constraint audit_events_result_allowed
    check (result in ('success', 'denied', 'failure')),
  add constraint audit_events_action_format
    check (action ~ '^[a-z0-9]+(?:[._][a-z0-9]+)*$' and length(action) <= 120),
  add constraint audit_events_entity_type_format
    check (entity_type ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$' and length(entity_type) <= 80),
  add constraint audit_events_entity_id_length
    check (entity_id is null or length(entity_id) <= 200),
  add constraint audit_events_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  add constraint audit_events_metadata_size
    check (pg_column_size(metadata) <= 8192);

create index audit_events_request_correlation_id_idx
  on service_desk.audit_events (request_correlation_id);

create or replace function service_desk.audit_context_is_safe(candidate jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  item record;
  child jsonb;
begin
  if candidate is null then return true; end if;
  if jsonb_typeof(candidate) = 'object' then
    for item in select key, value from jsonb_each(candidate) loop
      if lower(item.key) = any (array[
        'password', 'credential', 'credentials', 'secret', 'token', 'access_token',
        'refresh_token', 'session', 'cookie', 'authorization', 'file', 'file_contents',
        'provider_payload', 'private_payload'
      ]) then return false; end if;
      if not service_desk.audit_context_is_safe(item.value) then return false; end if;
    end loop;
  elsif jsonb_typeof(candidate) = 'array' then
    for child in select value from jsonb_array_elements(candidate) loop
      if not service_desk.audit_context_is_safe(child) then return false; end if;
    end loop;
  end if;
  return true;
end;
$$;

alter table service_desk.audit_events
  add constraint audit_events_metadata_safe
    check (service_desk.audit_context_is_safe(metadata));

do $migration$
begin
  if to_regprocedure('auth.uid()') is not null
     and exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'drop view api.current_user_access';
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
        null::uuid as department_id,
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
    execute 'grant select on api.current_user_access to authenticated';
    execute 'revoke all on api.current_user_access from public, anon';

    execute 'drop function api.provision_user(uuid, text, text, uuid, text)';
    execute $function$
      create function api.provision_user(
        target_auth_user_id uuid,
        target_email text,
        target_display_name text,
        target_property_id uuid,
        target_role_key text,
        request_correlation_id uuid default gen_random_uuid()
      ) returns uuid
      language plpgsql security definer set search_path = ''
      as $body$
      declare actor service_desk.users%rowtype;
      declare target_organization_id uuid;
      declare target_role_id uuid;
      declare created_user_id uuid;
      begin
        if (select auth.uid()) is null or coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2' then
          raise exception using errcode = '42501', message = 'administrator MFA verification required';
        end if;
        select domain_user.* into actor from service_desk.users as domain_user
        where domain_user.auth_user_id = (select auth.uid()) and domain_user.is_active;
        if actor.id is null or not exists (
          select 1 from service_desk.user_roles assignment
          join service_desk.roles role on role.id = assignment.role_id
            and role.organization_id = assignment.organization_id
          where assignment.user_id = actor.id and role.key = 'system_administrator'
        ) then raise exception using errcode = '42501', message = 'administrator access required'; end if;
        select property.organization_id into target_organization_id
        from service_desk.properties property
        where property.id = target_property_id and property.is_active
          and property.organization_id = actor.organization_id;
        select role.id into target_role_id from service_desk.roles role
        where role.organization_id = target_organization_id and role.key = target_role_key
          and role.key in ('requester', 'technician', 'it_manager', 'system_administrator', 'report_viewer');
        if target_organization_id is null or target_role_id is null then
          raise exception using errcode = '22023', message = 'invalid property or role';
        end if;
        insert into service_desk.users (auth_user_id, organization_id, email, display_name, must_change_password)
        values (target_auth_user_id, target_organization_id, lower(target_email), btrim(target_display_name), true)
        returning id into created_user_id;
        insert into service_desk.user_roles (organization_id, user_id, role_id, property_id)
        values (target_organization_id, created_user_id, target_role_id, target_property_id);
        insert into service_desk.audit_events (
          organization_id, property_id, actor_user_id, action, entity_type, entity_id,
          result, request_correlation_id, metadata
        ) values (
          target_organization_id, target_property_id, actor.id, 'user.created', 'user',
          created_user_id::text, 'success', request_correlation_id,
          jsonb_build_object('role', target_role_key)
        );
        return created_user_id;
      end;
      $body$
    $function$;

    execute 'drop function api.complete_initial_password_change()';
    execute $function$
      create function api.complete_initial_password_change(
        request_correlation_id uuid default gen_random_uuid()
      ) returns void
      language plpgsql security definer set search_path = ''
      as $body$
      declare current_domain_user service_desk.users%rowtype;
      begin
        select * into current_domain_user from service_desk.users
        where auth_user_id = (select auth.uid()) and is_active;
        if current_domain_user.id is null then
          raise exception using errcode = '42501', message = 'active user profile required';
        end if;
        update service_desk.users set must_change_password = false where id = current_domain_user.id;
        insert into service_desk.audit_events (
          organization_id, actor_user_id, action, entity_type, entity_id,
          result, request_correlation_id, metadata
        ) values (
          current_domain_user.organization_id, current_domain_user.id,
          'user.initial_password_changed', 'user', current_domain_user.id::text,
          'success', request_correlation_id, '{}'::jsonb
        );
      end;
      $body$
    $function$;

    execute 'drop function api.remove_failed_user_provision(uuid)';
    execute $function$
      create function api.remove_failed_user_provision(
        target_auth_user_id uuid,
        request_correlation_id uuid default gen_random_uuid()
      ) returns void
      language plpgsql security definer set search_path = ''
      as $body$
      declare actor service_desk.users%rowtype;
      declare target service_desk.users%rowtype;
      begin
        select * into actor from service_desk.users where auth_user_id = (select auth.uid()) and is_active;
        if actor.id is null or coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2'
          or not exists (
            select 1 from service_desk.user_roles assignment
            join service_desk.roles role on role.id = assignment.role_id
              and role.organization_id = assignment.organization_id
            where assignment.user_id = actor.id and role.key = 'system_administrator'
          ) then raise exception using errcode = '42501', message = 'administrator MFA verification required'; end if;
        select * into target from service_desk.users
        where auth_user_id = target_auth_user_id and organization_id = actor.organization_id;
        if target.id is not null then
          insert into service_desk.audit_events (
            organization_id, actor_user_id, action, entity_type, entity_id,
            result, request_correlation_id, metadata
          ) values (
            actor.organization_id, actor.id, 'user.provision_failed', 'user', target.id::text,
            'failure', request_correlation_id, jsonb_build_object('cleanup', 'completed')
          );
          delete from service_desk.users where id = target.id;
        end if;
      end;
      $body$
    $function$;

    execute $function$
      create function api.list_audit_events(result_limit integer default 50)
      returns table (
        id uuid, actor_display_name text, action text, target_type text, target_id text,
        result text, request_correlation_id uuid, context jsonb, occurred_at timestamptz
      ) language plpgsql security definer set search_path = ''
      as $body$
      declare actor service_desk.users%rowtype;
      begin
        select * into actor from service_desk.users
        where auth_user_id = (select auth.uid()) and is_active;
        if actor.id is null or not exists (
          select 1 from service_desk.user_roles assignment
          join service_desk.roles role on role.id = assignment.role_id
            and role.organization_id = assignment.organization_id
          where assignment.user_id = actor.id
            and role.key in ('system_administrator', 'report_viewer')
        ) then raise exception using errcode = '42501', message = 'audit access required'; end if;
        return query
          select event.id, coalesce(event_actor.display_name, 'System'), event.action,
            event.entity_type, event.entity_id, event.result, event.request_correlation_id,
            event.metadata, event.created_at
          from service_desk.audit_events event
          left join service_desk.users event_actor
            on event_actor.id = event.actor_user_id
           and event_actor.organization_id = event.organization_id
          where event.organization_id = actor.organization_id
          order by event.created_at desc, event.id desc
          limit least(greatest(result_limit, 1), 100);
      end;
      $body$
    $function$;

    execute 'revoke all on function api.provision_user(uuid, text, text, uuid, text, uuid) from public, anon';
    execute 'grant execute on function api.provision_user(uuid, text, text, uuid, text, uuid) to authenticated';
    execute 'revoke all on function api.complete_initial_password_change(uuid) from public, anon';
    execute 'grant execute on function api.complete_initial_password_change(uuid) to authenticated';
    execute 'revoke all on function api.remove_failed_user_provision(uuid, uuid) from public, anon';
    execute 'grant execute on function api.remove_failed_user_provision(uuid, uuid) to authenticated';
    execute 'revoke all on function api.list_audit_events(integer) from public, anon';
    execute 'grant execute on function api.list_audit_events(integer) to authenticated';
  else
    execute 'drop view api.current_user_access';
    execute $view$
      create view api.current_user_access with (security_invoker = true) as
      select
        domain_user.id as user_id, domain_user.auth_user_id, domain_user.email,
        domain_user.display_name, domain_user.must_change_password,
        domain_user.organization_id, organization.name as organization_name,
        property.id as property_id, property.name as property_name,
        null::uuid as department_id, role.key as role_key
      from service_desk.users domain_user
      join service_desk.organizations organization on organization.id = domain_user.organization_id
      join service_desk.user_roles assignment on assignment.user_id = domain_user.id
      join service_desk.properties property on property.id = assignment.property_id
      join service_desk.roles role on role.id = assignment.role_id
      where false
    $view$;
  end if;
end
$migration$;

revoke all on function service_desk.audit_context_is_safe(jsonb) from public;
do $migration$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function service_desk.audit_context_is_safe(jsonb) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function service_desk.audit_context_is_safe(jsonb) from authenticated';
  end if;
end
$migration$;
