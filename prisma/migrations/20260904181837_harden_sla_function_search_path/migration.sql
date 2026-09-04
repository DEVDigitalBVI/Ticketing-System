-- Fix the trigger function's namespace resolution before production use.
alter function service_desk.prevent_sla_policy_version_rewrite()
  set search_path = pg_catalog;
