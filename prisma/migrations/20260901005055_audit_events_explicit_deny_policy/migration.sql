do $migration$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute $policy$
      create policy audit_events_deny_direct_access
      on service_desk.audit_events
      for all
      to authenticated
      using (false)
      with check (false)
    $policy$;
  end if;
end
$migration$;
