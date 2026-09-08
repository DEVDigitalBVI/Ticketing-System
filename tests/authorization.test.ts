import { describe, expect, it } from "vitest";

import {
  isAuthorized,
  permissions,
  requireAuthorization,
  roleKeys,
  rolePermissionMatrix,
  type AuthorizationSubject,
  type Permission,
  type RoleKey,
} from "@/modules/auth/authorization";

const ids = {
  user: "user-1",
  otherUser: "user-2",
  organization: "org-1",
  otherOrganization: "org-2",
  property: "property-1",
  otherProperty: "property-2",
  department: "department-1",
  otherDepartment: "department-2",
};

function subject(role: RoleKey): AuthorizationSubject {
  return {
    userId: ids.user,
    organizationId: ids.organization,
    propertyIds: [ids.property],
    departmentIds: [ids.department],
    roles: [role],
    roleAssignments: [{ propertyId: ids.property, role: role }],
  };
}

describe("role-permission matrix", () => {
  it.each(roleKeys)("proves every explicit allow and deny for %s", (role) => {
    for (const permission of permissions) {
      const expected = (rolePermissionMatrix[role] as readonly Permission[]).includes(permission);
      expect(isAuthorized(subject(role), permission), `${role}: ${permission}`).toBe(expected);
    }
  });

  it.each(roleKeys)("denies %s across organisation boundaries", (role) => {
    const allowed = (rolePermissionMatrix[role] as readonly Permission[])[0];
    expect(isAuthorized(subject(role), allowed, { organizationId: ids.otherOrganization })).toBe(
      false,
    );
  });

  it("limits requester ticket reads to the actor's own ticket", () => {
    expect(
      isAuthorized(subject("requester"), "ticket.read.own", {
        organizationId: ids.organization,
        propertyId: ids.property,
        ownerUserId: ids.user,
      }),
    ).toBe(true);
    expect(
      isAuthorized(subject("requester"), "ticket.read.own", {
        organizationId: ids.organization,
        propertyId: ids.property,
        ownerUserId: ids.otherUser,
      }),
    ).toBe(false);
  });

  it.each([
    "requester",
    "technician",
    "it_manager",
    "report_viewer",
    "department_approver",
  ] as const)("denies %s outside assigned properties", (role) => {
    const permission = (rolePermissionMatrix[role] as readonly Permission[])[0];
    expect(
      isAuthorized(subject(role), permission, {
        organizationId: ids.organization,
        propertyId: ids.otherProperty,
        ownerUserId: ids.user,
      }),
    ).toBe(false);
  });

  it("limits department approval to an assigned department", () => {
    expect(
      isAuthorized(subject("department_approver"), "ticket.department.approve", {
        organizationId: ids.organization,
        propertyId: ids.property,
        departmentId: ids.department,
      }),
    ).toBe(true);
    expect(
      isAuthorized(subject("department_approver"), "ticket.department.approve", {
        organizationId: ids.organization,
        propertyId: ids.property,
        departmentId: ids.otherDepartment,
      }),
    ).toBe(false);
  });

  it("allows a system administrator throughout its own organisation but never across tenants", () => {
    expect(
      isAuthorized(subject("system_administrator"), "configuration.manage", {
        organizationId: ids.organization,
        propertyId: ids.otherProperty,
      }),
    ).toBe(true);
    expect(
      isAuthorized(subject("system_administrator"), "configuration.manage", {
        organizationId: ids.otherOrganization,
      }),
    ).toBe(false);
  });

  it("throws a generic authorization error without leaking policy details", () => {
    expect(() => requireAuthorization(subject("requester"), "user.manage")).toThrow(
      "Access denied.",
    );
  });

  it("limits operational replay to system administrators", () => {
    expect(isAuthorized(subject("system_administrator"), "job.replay")).toBe(true);
    expect(isAuthorized(subject("it_manager"), "job.replay")).toBe(false);
    expect(isAuthorized(subject("report_viewer"), "job.replay")).toBe(false);
  });
});

describe("property-specific roles", () => {
  const mixed: AuthorizationSubject = {
    ...subject("technician"),
    propertyIds: [ids.property, ids.otherProperty],
    roles: ["technician", "requester"],
    roleAssignments: [
      { propertyId: ids.property, role: "technician" },
      { propertyId: ids.otherProperty, role: "requester" },
    ],
  };
  it.each([
    "ticket.queue.read",
    "ticket.assign",
    "ticket.note.internal",
    "ticket.transition",
    "asset.read",
  ] as const)("keeps %s confined to its role's property", (permission) => {
    expect(
      isAuthorized(mixed, permission, {
        organizationId: ids.organization,
        propertyId: ids.property,
      }),
    ).toBe(true);
    expect(
      isAuthorized(mixed, permission, {
        organizationId: ids.organization,
        propertyId: ids.otherProperty,
      }),
    ).toBe(false);
  });
  it("preserves requester submission at the second property", () => {
    expect(
      isAuthorized(mixed, "ticket.submit", {
        organizationId: ids.organization,
        propertyId: ids.otherProperty,
      }),
    ).toBe(true);
  });
});
