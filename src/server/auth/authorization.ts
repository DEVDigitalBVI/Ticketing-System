import "server-only";

import { redirect } from "next/navigation";

import {
  isAuthorized,
  type AuthorizationResource,
  type Permission,
} from "@/modules/auth/authorization";
import { getCurrentAccess, type AccessProfile } from "@/server/auth/access";

export function accessCan(
  access: AccessProfile,
  permission: Permission,
  resource?: AuthorizationResource,
) {
  return isAuthorized(
    {
      userId: access.userId,
      organizationId: access.organizationId,
      propertyIds: access.properties.map((property) => property.id),
      departmentIds: access.departmentIds,
      roles: access.roles,
    },
    permission,
    resource,
  );
}

export async function requireCurrentAccess(permission: Permission, deniedPath = "/") {
  const access = await getCurrentAccess();
  if (!access) redirect("/login");
  if (access.mustChangePassword) redirect("/account/change-password");
  if (!accessCan(access, permission)) redirect(deniedPath);
  return access;
}
