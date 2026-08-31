create index user_roles_user_id_organization_id_idx
  on service_desk.user_roles (user_id, organization_id);
