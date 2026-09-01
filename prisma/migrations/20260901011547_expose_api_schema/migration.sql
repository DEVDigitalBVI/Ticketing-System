do $migration$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    alter role authenticator set pgrst.db_schemas = 'public, graphql_public, api';
    notify pgrst, 'reload config';
  end if;
end
$migration$;
