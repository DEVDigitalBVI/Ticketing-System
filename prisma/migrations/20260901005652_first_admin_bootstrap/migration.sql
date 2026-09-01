do $migration$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute $function$
      create function api.bootstrap_first_admin(
        target_auth_user_id uuid,
        target_email text,
        target_display_name text
      ) returns uuid
      language plpgsql
      security definer
      set search_path = ''
      as $body$
      declare created_user_id uuid;
      begin
        if exists (select 1 from service_desk.users) then
          raise exception using errcode = '55000', message = 'first administrator already exists';
        end if;
        insert into service_desk.users (
          auth_user_id, organization_id, email, display_name, must_change_password
        ) values (
          target_auth_user_id,
          '18b8d97e-9622-4ca7-b344-6230ad863e84',
          lower(target_email), btrim(target_display_name), true
        ) returning id into created_user_id;
        insert into service_desk.user_roles (organization_id, user_id, role_id, property_id)
        values (
          '18b8d97e-9622-4ca7-b344-6230ad863e84', created_user_id,
          'e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f',
          'ab9c2f07-e909-4f9d-9092-49ad4e06df1f'
        );
        insert into service_desk.audit_events (
          organization_id, property_id, action, entity_type, entity_id
        ) values (
          '18b8d97e-9622-4ca7-b344-6230ad863e84',
          'ab9c2f07-e909-4f9d-9092-49ad4e06df1f',
          'user.first_admin_bootstrapped', 'user', created_user_id::text
        );
        return created_user_id;
      end;
      $body$
    $function$;

    execute $function$
      create function api.rollback_first_admin(target_auth_user_id uuid) returns void
      language plpgsql
      security definer
      set search_path = ''
      as $body$
      begin
        if (select count(*) from service_desk.users) = 1 then
          delete from service_desk.users where auth_user_id = target_auth_user_id;
        end if;
      end;
      $body$
    $function$;

    revoke all on function api.bootstrap_first_admin(uuid, text, text) from public, anon, authenticated;
    grant execute on function api.bootstrap_first_admin(uuid, text, text) to service_role;
    revoke all on function api.rollback_first_admin(uuid) from public, anon, authenticated;
    grant execute on function api.rollback_first_admin(uuid) to service_role;
  end if;
end
$migration$;
