export const roleKeys = [
  "requester",
  "technician",
  "it_manager",
  "system_administrator",
  "report_viewer",
  "department_approver",
] as const;

export type RoleKey = (typeof roleKeys)[number];

export const permissions = [
  "ticket.submit",
  "ticket.read.own",
  "ticket.queue.read",
  "ticket.assign",
  "ticket.note.internal",
  "ticket.transition",
  "ticket.department.approve",
  "asset.read",
  "asset.manage",
  "level.context.read",
  "level.action.execute",
  "report.read",
  "audit.read",
  "user.manage",
  "configuration.manage",
] as const;

export type Permission = (typeof permissions)[number];

export const rolePermissionMatrix = {
  requester: ["ticket.submit", "ticket.read.own"],
  technician: [
    "ticket.submit",
    "ticket.read.own",
    "ticket.queue.read",
    "ticket.assign",
    "ticket.note.internal",
    "ticket.transition",
    "asset.read",
    "level.context.read",
  ],
  it_manager: [
    "ticket.submit",
    "ticket.read.own",
    "ticket.queue.read",
    "ticket.assign",
    "ticket.note.internal",
    "ticket.transition",
    "asset.read",
    "asset.manage",
    "level.context.read",
    "level.action.execute",
    "report.read",
  ],
  system_administrator: permissions,
  report_viewer: ["report.read", "audit.read"],
  department_approver: ["ticket.submit", "ticket.read.own", "ticket.department.approve"],
} as const satisfies Record<RoleKey, readonly Permission[]>;

export type AuthorizationSubject = {
  userId: string;
  organizationId: string;
  propertyIds: readonly string[];
  departmentIds: readonly string[];
  roles: readonly RoleKey[];
};

export type AuthorizationResource = {
  organizationId: string;
  propertyId?: string;
  departmentId?: string;
  ownerUserId?: string;
};

export function hasPermission(subject: AuthorizationSubject, permission: Permission) {
  return subject.roles.some((role) =>
    (rolePermissionMatrix[role] as readonly Permission[]).includes(permission),
  );
}

export function isAuthorized(
  subject: AuthorizationSubject,
  permission: Permission,
  resource?: AuthorizationResource,
) {
  if (!hasPermission(subject, permission)) return false;
  if (!resource) return true;
  if (resource.organizationId !== subject.organizationId) return false;

  const isSystemAdministrator = subject.roles.includes("system_administrator");
  if (
    resource.propertyId &&
    !isSystemAdministrator &&
    !subject.propertyIds.includes(resource.propertyId)
  )
    return false;

  if (permission === "ticket.read.own" && resource.ownerUserId !== subject.userId) return false;
  if (
    permission === "ticket.department.approve" &&
    !isSystemAdministrator &&
    (!resource.departmentId || !subject.departmentIds.includes(resource.departmentId))
  )
    return false;

  return true;
}

export class AuthorizationError extends Error {
  constructor() {
    super("Access denied.");
    this.name = "AuthorizationError";
  }
}

export function requireAuthorization(
  subject: AuthorizationSubject,
  permission: Permission,
  resource?: AuthorizationResource,
) {
  if (!isAuthorized(subject, permission, resource)) throw new AuthorizationError();
}
