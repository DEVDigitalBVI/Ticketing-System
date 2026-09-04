import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const recordedAudits: Array<Record<string, unknown>> = [];

vi.mock("@/server/repositories/audit-event-repository", () => ({
  AuditEventRepository: class AuditEventRepository {
    async record(input: Record<string, unknown>) {
      recordedAudits.push(input);
    }
  },
}));

type UserRecord = {
  id: string;
  organizationId: string;
  displayName: string;
  isActive: boolean;
};

type SupportTeamRecord = {
  id: string;
  organizationId: string;
  propertyId: string;
  departmentId: string | null;
  name: string;
  isActive: boolean;
};

type UserRoleRecord = {
  organizationId: string;
  propertyId: string;
  userId: string;
  roleKey: string;
};

type TicketRecord = {
  id: string;
  organizationId: string;
  propertyId: string;
  requesterUserId: string;
  affectedUserId: string | null;
  departmentId: string | null;
  supportTeamId: string | null;
  assigneeUserId: string | null;
  ticketNumber: string;
  summary: string;
  description: string;
  priority: "P1" | "P2" | "P3" | "P4";
  status:
    | "new"
    | "triage"
    | "assigned"
    | "in_progress"
    | "waiting_for_requester"
    | "waiting_for_vendor"
    | "resolved"
    | "closed"
    | "cancelled";
  source: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
  requester: { id: string; displayName: string };
  affectedUser: { id: string; displayName: string } | null;
  property: { name: string; isActive: boolean };
  serviceLocation: { name: string } | null;
  department: { id: string; name: string } | null;
  category: { name: string; isActive: boolean };
  subcategory: { name: string } | null;
  supportTeam: { id: string; name: string; propertyId: string; isActive: boolean } | null;
  assignee: { id: string; displayName: string; isActive: boolean } | null;
  comments: Array<{
    id: string;
    visibility: string;
    body: string;
    createdAt: Date;
    author: { displayName: string };
  }>;
  activities: Array<{
    id: string;
    activityType: string;
    toStatus: string | null;
    createdAt: Date;
    actor: { displayName: string } | null;
  }>;
  assignments: Array<{
    id: string;
    note: string | null;
    createdAt: Date;
    assignedBy: { displayName: string };
    assignedUser: { displayName: string } | null;
    assignedSupportTeam: { name: string } | null;
  }>;
};

function compareValues(
  left: Date | string | null,
  right: Date | string | null,
  direction: "asc" | "desc",
) {
  const leftValue = left instanceof Date ? left.getTime() : (left ?? "");
  const rightValue = right instanceof Date ? right.getTime() : (right ?? "");
  if (leftValue === rightValue) return 0;
  if (direction === "asc") return leftValue < rightValue ? -1 : 1;
  return leftValue > rightValue ? -1 : 1;
}

function matchesClause(ticket: TicketRecord, clause: Record<string, unknown>): boolean {
  if ("organizationId" in clause && clause.organizationId !== ticket.organizationId) return false;
  if ("id" in clause && clause.id !== ticket.id) return false;

  if ("propertyId" in clause) {
    const propertyClause = clause.propertyId as string | { in?: string[] };
    if (typeof propertyClause === "string" && propertyClause !== ticket.propertyId) return false;
    if (
      typeof propertyClause === "object" &&
      propertyClause?.in &&
      !propertyClause.in.includes(ticket.propertyId)
    ) {
      return false;
    }
  }

  if ("status" in clause) {
    const statusClause = clause.status as { in?: string[]; notIn?: string[] };
    if (statusClause?.in && !statusClause.in.includes(ticket.status)) return false;
    if (statusClause?.notIn && statusClause.notIn.includes(ticket.status)) return false;
  }

  if ("supportTeamId" in clause) {
    const supportClause = clause.supportTeamId as null | { not?: null } | string;
    if (supportClause === null && ticket.supportTeamId !== null) return false;
    if (typeof supportClause === "string" && supportClause !== ticket.supportTeamId) return false;
    if (
      supportClause &&
      typeof supportClause === "object" &&
      "not" in supportClause &&
      ticket.supportTeamId === supportClause.not
    ) {
      return false;
    }
  }

  if ("assigneeUserId" in clause) {
    const assigneeClause = clause.assigneeUserId as null | { not?: string | null } | string;
    if (assigneeClause === null && ticket.assigneeUserId !== null) return false;
    if (typeof assigneeClause === "string" && assigneeClause !== ticket.assigneeUserId)
      return false;
    if (
      assigneeClause &&
      typeof assigneeClause === "object" &&
      "not" in assigneeClause &&
      ticket.assigneeUserId === assigneeClause.not
    ) {
      return false;
    }
  }

  if ("updatedAt" in clause && clause.updatedAt instanceof Date) {
    if (ticket.updatedAt.getTime() !== clause.updatedAt.getTime()) return false;
  }

  if ("OR" in clause) {
    const branches = clause.OR as Array<Record<string, unknown>>;
    if (!branches.some((branch) => matchesClause(ticket, branch))) return false;
  }

  if ("AND" in clause) {
    const branches = clause.AND as Array<Record<string, unknown>>;
    if (!branches.every((branch) => matchesClause(ticket, branch))) return false;
  }

  return true;
}

function sortTickets(rows: TicketRecord[], orderBy: Array<Record<string, "asc" | "desc">>) {
  return [...rows].sort((left, right) => {
    for (const entry of orderBy) {
      const [key, direction] = Object.entries(entry)[0] as [keyof TicketRecord, "asc" | "desc"];
      const compared = compareValues(
        left[key] as Date | string | null,
        right[key] as Date | string | null,
        direction,
      );
      if (compared !== 0) return compared;
    }
    return 0;
  });
}

let tickets: TicketRecord[] = [];
let users: UserRecord[] = [];
let supportTeams: SupportTeamRecord[] = [];
let userRoles: UserRoleRecord[] = [];

type TransactionShape = {
  ticket: {
    findFirst: (input: { where: Record<string, unknown> }) => Promise<TicketRecord | null>;
    update: (input: {
      where: { id_organizationId: { id: string; organizationId: string } };
      data: Partial<TicketRecord>;
    }) => Promise<TicketRecord>;
    updateMany: (input: {
      where: Record<string, unknown>;
      data: Partial<TicketRecord>;
    }) => Promise<{ count: number }>;
    create: (input: { data: Record<string, unknown> }) => Promise<TicketRecord>;
  };
  user: {
    findFirst: (input: {
      where: { id: string; organizationId: string; isActive: boolean };
    }) => Promise<UserRecord | null>;
  };
  property: {
    findFirst: (input: {
      where: { id: string; organizationId: string; isActive: boolean };
    }) => Promise<{ id: string; organizationId: string; isActive: boolean } | null>;
  };
  department: {
    findFirst: (input: {
      where: { id: string; organizationId: string; isActive: boolean };
    }) => Promise<{
      id: string;
      organizationId: string;
      propertyId: string;
      isActive: boolean;
    } | null>;
  };
  serviceLocation: {
    findFirst: (input: {
      where: { id: string; organizationId: string; isActive: boolean };
    }) => Promise<{
      id: string;
      organizationId: string;
      propertyId: string;
      isActive: boolean;
    } | null>;
  };
  ticketCategory: {
    findFirst: (input: {
      where: { id: string; organizationId: string; isActive: boolean };
    }) => Promise<{ id: string; organizationId: string; isActive: boolean } | null>;
  };
  ticketSubcategory: {
    findFirst: (input: {
      where: { id: string; organizationId: string; isActive: boolean };
    }) => Promise<{
      id: string;
      organizationId: string;
      categoryId: string;
      isActive: boolean;
    } | null>;
  };
  supportTeam: {
    findFirst: (input: {
      where: { id: string; organizationId: string; isActive: boolean };
    }) => Promise<SupportTeamRecord | null>;
    findMany: (input: {
      where: {
        organizationId: string;
        propertyId: string;
        isActive: boolean;
        OR?: Array<{ departmentId: string | null }>;
      };
    }) => Promise<Array<{ id: string; name: string }>>;
  };
  userRole: {
    count: (input: {
      where: { userId: string; organizationId: string; propertyId: string };
    }) => Promise<number>;
    findMany: (input: {
      where: {
        organizationId: string;
        propertyId: string;
        user: { isActive: boolean };
        role: { key: { in: string[] } };
      };
    }) => Promise<Array<{ user: { id: string; displayName: string }; role: { key: string } }>>;
  };
  ticketActivity: {
    create: (input: {
      data: { ticketId: string; activityType: string; toStatus: string | null };
    }) => Promise<void>;
  };
  ticketComment: { create: (input: { data: Record<string, unknown> }) => Promise<unknown> };
  ticketAssignment: {
    create: (input: {
      data: {
        ticketId: string;
        assignedUserId?: string;
        assignedSupportTeamId?: string;
        note?: string;
      };
    }) => Promise<void>;
  };
  auditEvent: { create: (input: { data: Record<string, unknown> }) => Promise<void> };
};

vi.mock("@/server/database/client", () => {
  const ticketModel = {
    count: vi.fn(
      async ({ where }: { where: Record<string, unknown> }) =>
        tickets.filter((ticket) => matchesClause(ticket, where)).length,
    ),
    findMany: vi.fn(
      async ({
        where,
        orderBy = [],
        skip = 0,
        take = 10,
      }: {
        where: Record<string, unknown>;
        orderBy?: Array<Record<string, "asc" | "desc">>;
        skip?: number;
        take?: number;
      }) =>
        sortTickets(
          tickets.filter((ticket) => matchesClause(ticket, where)),
          orderBy,
        ).slice(skip, skip + take),
    ),
    findFirst: vi.fn(
      async ({ where }: { where: Record<string, unknown> }) =>
        tickets.find((ticket) => matchesClause(ticket, where)) ?? null,
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id_organizationId: { id: string; organizationId: string } };
        data: Partial<TicketRecord>;
      }) => {
        const ticket = tickets.find(
          (entry) =>
            entry.id === where.id_organizationId.id &&
            entry.organizationId === where.id_organizationId.organizationId,
        );
        if (!ticket) throw new Error("missing ticket");
        Object.assign(ticket, data, { updatedAt: new Date("2026-09-01T13:00:00.000Z") });
        if (data.assigneeUserId !== undefined) {
          const user = users.find((entry) => entry.id === data.assigneeUserId) ?? null;
          ticket.assignee = user
            ? { id: user.id, displayName: user.displayName, isActive: user.isActive }
            : null;
        }
        if (data.supportTeamId !== undefined) {
          const team = supportTeams.find((entry) => entry.id === data.supportTeamId) ?? null;
          ticket.supportTeam = team
            ? {
                id: team.id,
                name: team.name,
                propertyId: team.propertyId,
                isActive: team.isActive,
              }
            : null;
        }
        return ticket;
      },
    ),
    updateMany: vi.fn(
      async ({ where, data }: { where: Record<string, unknown>; data: Partial<TicketRecord> }) => {
        const ticket = tickets.find((entry) => matchesClause(entry, where));
        if (!ticket) return { count: 0 };
        Object.assign(ticket, data, { updatedAt: new Date("2026-09-01T13:00:00.000Z") });
        if (data.assigneeUserId !== undefined) {
          const user = users.find((entry) => entry.id === data.assigneeUserId) ?? null;
          ticket.assignee = user
            ? { id: user.id, displayName: user.displayName, isActive: user.isActive }
            : null;
        }
        if (data.supportTeamId !== undefined) {
          const team = supportTeams.find((entry) => entry.id === data.supportTeamId) ?? null;
          ticket.supportTeam = team
            ? {
                id: team.id,
                name: team.name,
                propertyId: team.propertyId,
                isActive: team.isActive,
              }
            : null;
        }
        return { count: 1 };
      },
    ),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data as TicketRecord),
  };

  const supportTeamModel = {
    findMany: vi.fn(
      async ({
        where,
      }: {
        where: {
          organizationId: string;
          propertyId: string;
          isActive: boolean;
          OR?: Array<{ departmentId: string | null }>;
        };
      }) =>
        supportTeams
          .filter(
            (team) =>
              team.organizationId === where.organizationId &&
              team.propertyId === where.propertyId &&
              team.isActive === where.isActive &&
              (!where.OR || where.OR.some((branch) => branch.departmentId === team.departmentId)),
          )
          .map((team) => ({ id: team.id, name: team.name })),
    ),
    findFirst: vi.fn(
      async ({ where }: { where: { id: string; organizationId: string; isActive: boolean } }) =>
        supportTeams.find(
          (team) =>
            team.id === where.id &&
            team.organizationId === where.organizationId &&
            team.isActive === where.isActive,
        ) ?? null,
    ),
  };

  const userModel = {
    findFirst: vi.fn(
      async ({ where }: { where: { id: string; organizationId: string; isActive: boolean } }) =>
        users.find(
          (user) =>
            user.id === where.id &&
            user.organizationId === where.organizationId &&
            user.isActive === where.isActive,
        ) ?? null,
    ),
  };

  const userRoleModel = {
    count: vi.fn(
      async ({
        where,
      }: {
        where: { userId: string; organizationId: string; propertyId: string };
      }) =>
        userRoles.filter(
          (row) =>
            row.userId === where.userId &&
            row.organizationId === where.organizationId &&
            row.propertyId === where.propertyId,
        ).length,
    ),
    findMany: vi.fn(
      async ({
        where,
      }: {
        where: {
          organizationId: string;
          propertyId: string;
          user: { isActive: boolean };
          role: { key: { in: string[] } };
        };
      }) =>
        userRoles
          .filter(
            (row) =>
              row.organizationId === where.organizationId &&
              row.propertyId === where.propertyId &&
              where.role.key.in.includes(row.roleKey) &&
              users.some(
                (user) =>
                  user.id === row.userId &&
                  user.organizationId === row.organizationId &&
                  user.isActive === where.user.isActive,
              ),
          )
          .map((row) => {
            const user = users.find((entry) => entry.id === row.userId)!;
            return {
              user: { id: user.id, displayName: user.displayName },
              role: { key: row.roleKey },
            };
          }),
    ),
  };

  const propertyModel = {
    findFirst: vi.fn(
      async ({ where }: { where: { id: string; organizationId: string; isActive: boolean } }) =>
        where.id === "property-1" && where.organizationId === "org-1" && where.isActive
          ? { id: "property-1", organizationId: "org-1", isActive: true }
          : null,
    ),
  };

  const departmentModel = {
    findFirst: vi.fn(
      async ({ where }: { where: { id: string; organizationId: string; isActive: boolean } }) => {
        const ticket = tickets.find((entry) => entry.department?.id === where.id);
        return ticket && where.isActive
          ? {
              id: where.id,
              organizationId: where.organizationId,
              propertyId: ticket.propertyId,
              isActive: true,
            }
          : null;
      },
    ),
  };

  const categoryModel = {
    findFirst: vi.fn(
      async ({ where }: { where: { id: string; organizationId: string; isActive: boolean } }) =>
        where.isActive
          ? { id: where.id, organizationId: where.organizationId, isActive: true }
          : null,
    ),
  };

  const subcategoryModel = {
    findFirst: vi.fn(
      async ({ where }: { where: { id: string; organizationId: string; isActive: boolean } }) =>
        where.isActive
          ? {
              id: where.id,
              organizationId: where.organizationId,
              categoryId: "category-1",
              isActive: true,
            }
          : null,
    ),
  };

  const serviceLocationModel = {
    findFirst: vi.fn(
      async ({ where }: { where: { id: string; organizationId: string; isActive: boolean } }) =>
        where.isActive
          ? {
              id: where.id,
              organizationId: where.organizationId,
              propertyId: "property-1",
              isActive: true,
            }
          : null,
    ),
  };

  const ticketActivityModel = {
    create: vi.fn(
      async ({
        data,
      }: {
        data: { ticketId: string; activityType: string; toStatus: string | null };
      }) => {
        const ticket = tickets.find((entry) => entry.id === data.ticketId);
        if (!ticket) return;
        ticket.activities.push({
          id: `activity-${ticket.activities.length + 1}`,
          activityType: data.activityType,
          toStatus: data.toStatus,
          createdAt: new Date("2026-09-01T13:00:00.000Z"),
          actor: { displayName: "Technician A" },
        });
      },
    ),
  };

  const ticketCommentModel = {
    create: vi.fn(async () => ({ id: "comment-1" })),
  };

  const ticketAssignmentModel = {
    create: vi.fn(
      async ({
        data,
      }: {
        data: {
          ticketId: string;
          assignedUserId?: string;
          assignedSupportTeamId?: string;
          note?: string;
        };
      }) => {
        const ticket = tickets.find((entry) => entry.id === data.ticketId);
        if (!ticket) return;
        const assignedUser = users.find((entry) => entry.id === data.assignedUserId);
        const assignedSupportTeam = supportTeams.find(
          (entry) => entry.id === data.assignedSupportTeamId,
        );
        ticket.assignments.push({
          id: `assignment-${ticket.assignments.length + 1}`,
          note: data.note ?? null,
          createdAt: new Date("2026-09-01T13:00:00.000Z"),
          assignedBy: { displayName: "Technician A" },
          assignedUser: assignedUser ? { displayName: assignedUser.displayName } : null,
          assignedSupportTeam: assignedSupportTeam ? { name: assignedSupportTeam.name } : null,
        });
      },
    ),
  };

  const auditEventModel = {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      recordedAudits.push(data);
    }),
  };

  const database = {
    attachmentMetadata: {
      findMany: vi.fn(async () => []),
    },
    ticket: ticketModel,
    supportTeam: supportTeamModel,
    user: userModel,
    userRole: userRoleModel,
    property: propertyModel,
    department: departmentModel,
    ticketCategory: categoryModel,
    ticketSubcategory: subcategoryModel,
    serviceLocation: serviceLocationModel,
    ticketActivity: ticketActivityModel,
    ticketComment: ticketCommentModel,
    ticketAssignment: ticketAssignmentModel,
    auditEvent: auditEventModel,
    $transaction: vi.fn(async (callback: (transaction: TransactionShape) => Promise<unknown>) =>
      callback({
        ticket: ticketModel,
        user: userModel,
        property: propertyModel,
        department: departmentModel,
        serviceLocation: serviceLocationModel,
        ticketCategory: categoryModel,
        ticketSubcategory: subcategoryModel,
        supportTeam: supportTeamModel,
        userRole: userRoleModel,
        ticketActivity: ticketActivityModel,
        ticketComment: ticketCommentModel,
        ticketAssignment: ticketAssignmentModel,
        auditEvent: auditEventModel,
      }),
    ),
  };

  return { database };
});

import type { AccessProfile } from "@/server/auth/access";
import {
  listTechnicianWorkspace,
  getTechnicianTicketDetail,
} from "@/server/tickets/technician-queue";
import { assignTicket } from "@/server/tickets/service";

const ids = {
  techA: "11111111-1111-4111-8111-111111111111",
  techB: "22222222-2222-4222-8222-222222222222",
  manager: "33333333-3333-4333-8333-333333333333",
  requester: "44444444-4444-4444-8444-444444444444",
  otherPropertyTech: "55555555-5555-4555-8555-555555555555",
  teamFrontOffice: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  teamShared: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  teamEvents: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
  teamOtherProperty: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
  ticketUnassigned: "90000000-0000-4000-8000-000000000001",
  ticketMyWork: "90000000-0000-4000-8000-000000000002",
  ticketTeamWork: "90000000-0000-4000-8000-000000000003",
  ticketWaiting: "90000000-0000-4000-8000-000000000004",
  ticketResolved: "90000000-0000-4000-8000-000000000005",
  ticketOtherProperty: "90000000-0000-4000-8000-000000000006",
} as const;

const technicianAccess: AccessProfile = {
  userId: ids.techA,
  authUserId: "auth-tech-a",
  email: "tech-a@example.invalid",
  displayName: "Technician A",
  organizationId: "org-1",
  organizationName: "Peter Island Resort and Spa",
  properties: [{ id: "property-1", name: "Peter Island Resort and Spa" }],
  departmentIds: ["department-1"],
  roles: ["technician"],
  assuranceLevel: "aal2",
  mustChangePassword: false,
};

const requesterAccess: AccessProfile = {
  ...technicianAccess,
  userId: ids.requester,
  authUserId: "auth-requester-1",
  email: "requester@example.invalid",
  displayName: "Requester",
  roles: ["requester"],
};

const technicianBAccess: AccessProfile = {
  ...technicianAccess,
  userId: ids.techB,
  authUserId: "auth-tech-b",
  email: "tech-b@example.invalid",
  displayName: "Technician B",
};

beforeEach(() => {
  recordedAudits.length = 0;

  users = [
    { id: ids.techA, organizationId: "org-1", displayName: "Technician A", isActive: true },
    { id: ids.techB, organizationId: "org-1", displayName: "Technician B", isActive: true },
    { id: ids.manager, organizationId: "org-1", displayName: "IT Manager", isActive: true },
    { id: ids.requester, organizationId: "org-1", displayName: "Requester One", isActive: true },
    {
      id: ids.otherPropertyTech,
      organizationId: "org-1",
      displayName: "Other Property Tech",
      isActive: true,
    },
  ];

  supportTeams = [
    {
      id: ids.teamFrontOffice,
      organizationId: "org-1",
      propertyId: "property-1",
      departmentId: "department-1",
      name: "Front Office Support",
      isActive: true,
    },
    {
      id: ids.teamShared,
      organizationId: "org-1",
      propertyId: "property-1",
      departmentId: null,
      name: "Shared Services",
      isActive: true,
    },
    {
      id: ids.teamEvents,
      organizationId: "org-1",
      propertyId: "property-1",
      departmentId: "department-2",
      name: "Events Support",
      isActive: true,
    },
    {
      id: ids.teamOtherProperty,
      organizationId: "org-1",
      propertyId: "property-2",
      departmentId: null,
      name: "Other Property Support",
      isActive: true,
    },
  ];

  userRoles = [
    { organizationId: "org-1", propertyId: "property-1", userId: ids.techA, roleKey: "technician" },
    { organizationId: "org-1", propertyId: "property-1", userId: ids.techB, roleKey: "technician" },
    {
      organizationId: "org-1",
      propertyId: "property-1",
      userId: ids.manager,
      roleKey: "it_manager",
    },
    {
      organizationId: "org-1",
      propertyId: "property-1",
      userId: ids.requester,
      roleKey: "requester",
    },
    {
      organizationId: "org-1",
      propertyId: "property-2",
      userId: ids.otherPropertyTech,
      roleKey: "technician",
    },
  ];

  tickets = [
    {
      id: ids.ticketUnassigned,
      organizationId: "org-1",
      propertyId: "property-1",
      requesterUserId: ids.requester,
      affectedUserId: null,
      departmentId: "department-1",
      supportTeamId: null,
      assigneeUserId: null,
      ticketNumber: "PIR-001010",
      summary: "Front desk printer offline",
      description: "Printer stops after each page.",
      priority: "P1",
      status: "new",
      source: "portal",
      createdAt: new Date("2026-09-01T08:00:00.000Z"),
      updatedAt: new Date("2026-09-01T08:10:00.000Z"),
      resolvedAt: null,
      closedAt: null,
      requester: { id: ids.requester, displayName: "Requester One" },
      affectedUser: null,
      property: { name: "Peter Island Resort and Spa", isActive: true },
      serviceLocation: { name: "Front Office" },
      department: { id: "department-1", name: "Front Office" },
      category: { name: "Printers", isActive: true },
      subcategory: { name: "Paper jam" },
      supportTeam: null,
      assignee: null,
      comments: [],
      activities: [
        {
          id: "activity-created-1",
          activityType: "ticket_created",
          toStatus: "new",
          createdAt: new Date("2026-09-01T08:00:00.000Z"),
          actor: { displayName: "Requester One" },
        },
      ],
      assignments: [],
    },
    {
      id: ids.ticketMyWork,
      organizationId: "org-1",
      propertyId: "property-1",
      requesterUserId: ids.requester,
      affectedUserId: null,
      departmentId: "department-1",
      supportTeamId: ids.teamFrontOffice,
      assigneeUserId: ids.techA,
      ticketNumber: "PIR-001011",
      summary: "Guest Wi-Fi unstable",
      description: "Guest loses access every few minutes.",
      priority: "P2",
      status: "in_progress",
      source: "phone",
      createdAt: new Date("2026-09-01T07:00:00.000Z"),
      updatedAt: new Date("2026-09-01T09:00:00.000Z"),
      resolvedAt: null,
      closedAt: null,
      requester: { id: ids.requester, displayName: "Requester One" },
      affectedUser: null,
      property: { name: "Peter Island Resort and Spa", isActive: true },
      serviceLocation: { name: "Villa 101" },
      department: { id: "department-1", name: "Front Office" },
      category: { name: "Network and Wi-Fi", isActive: true },
      subcategory: { name: "Guest Wi-Fi" },
      supportTeam: {
        id: ids.teamFrontOffice,
        name: "Front Office Support",
        propertyId: "property-1",
        isActive: true,
      },
      assignee: { id: ids.techA, displayName: "Technician A", isActive: true },
      comments: [],
      activities: [],
      assignments: [],
    },
    {
      id: ids.ticketTeamWork,
      organizationId: "org-1",
      propertyId: "property-1",
      requesterUserId: ids.requester,
      affectedUserId: null,
      departmentId: "department-1",
      supportTeamId: ids.teamFrontOffice,
      assigneeUserId: ids.techB,
      ticketNumber: "PIR-001012",
      summary: "Ballroom display offline",
      description: "Conference display will not wake up.",
      priority: "P2",
      status: "assigned",
      source: "walk_up",
      createdAt: new Date("2026-09-01T06:00:00.000Z"),
      updatedAt: new Date("2026-09-01T06:30:00.000Z"),
      resolvedAt: null,
      closedAt: null,
      requester: { id: ids.requester, displayName: "Requester One" },
      affectedUser: null,
      property: { name: "Peter Island Resort and Spa", isActive: true },
      serviceLocation: { name: "Ballroom" },
      department: { id: "department-1", name: "Front Office" },
      category: { name: "Audio Visual", isActive: true },
      subcategory: { name: "Displays" },
      supportTeam: {
        id: ids.teamFrontOffice,
        name: "Front Office Support",
        propertyId: "property-1",
        isActive: true,
      },
      assignee: { id: ids.techB, displayName: "Technician B", isActive: true },
      comments: [],
      activities: [],
      assignments: [],
    },
    {
      id: ids.ticketWaiting,
      organizationId: "org-1",
      propertyId: "property-1",
      requesterUserId: ids.requester,
      affectedUserId: null,
      departmentId: "department-1",
      supportTeamId: ids.teamFrontOffice,
      assigneeUserId: ids.techB,
      ticketNumber: "PIR-001013",
      summary: "POS needs vendor callback",
      description: "Card terminal firmware error.",
      priority: "P3",
      status: "waiting_for_vendor",
      source: "phone",
      createdAt: new Date("2026-09-01T05:00:00.000Z"),
      updatedAt: new Date("2026-09-01T10:00:00.000Z"),
      resolvedAt: null,
      closedAt: null,
      requester: { id: ids.requester, displayName: "Requester One" },
      affectedUser: null,
      property: { name: "Peter Island Resort and Spa", isActive: true },
      serviceLocation: { name: "Retail" },
      department: { id: "department-1", name: "Front Office" },
      category: { name: "Point of Sale", isActive: true },
      subcategory: { name: "Card reader" },
      supportTeam: {
        id: ids.teamFrontOffice,
        name: "Front Office Support",
        propertyId: "property-1",
        isActive: true,
      },
      assignee: { id: ids.techB, displayName: "Technician B", isActive: true },
      comments: [],
      activities: [],
      assignments: [],
    },
    {
      id: ids.ticketResolved,
      organizationId: "org-1",
      propertyId: "property-1",
      requesterUserId: ids.requester,
      affectedUserId: null,
      departmentId: "department-1",
      supportTeamId: ids.teamFrontOffice,
      assigneeUserId: ids.techA,
      ticketNumber: "PIR-001014",
      summary: "Account reset completed",
      description: "Password reset delivered.",
      priority: "P3",
      status: "resolved",
      source: "portal",
      createdAt: new Date("2026-08-31T05:00:00.000Z"),
      updatedAt: new Date("2026-09-01T11:00:00.000Z"),
      resolvedAt: new Date("2026-09-01T11:00:00.000Z"),
      closedAt: null,
      requester: { id: ids.requester, displayName: "Requester One" },
      affectedUser: null,
      property: { name: "Peter Island Resort and Spa", isActive: true },
      serviceLocation: { name: "Reservations" },
      department: { id: "department-1", name: "Front Office" },
      category: { name: "Accounts and Access", isActive: true },
      subcategory: { name: "Password reset" },
      supportTeam: {
        id: ids.teamFrontOffice,
        name: "Front Office Support",
        propertyId: "property-1",
        isActive: true,
      },
      assignee: { id: ids.techA, displayName: "Technician A", isActive: true },
      comments: [
        {
          id: "comment-1",
          visibility: "internal",
          body: "Reset through the admin console.",
          createdAt: new Date("2026-09-01T11:05:00.000Z"),
          author: { displayName: "Technician A" },
        },
      ],
      activities: [
        {
          id: "activity-2",
          activityType: "status_changed",
          toStatus: "resolved",
          createdAt: new Date("2026-09-01T11:00:00.000Z"),
          actor: { displayName: "Technician A" },
        },
      ],
      assignments: [
        {
          id: "assignment-1",
          note: "Assigned during morning shift.",
          createdAt: new Date("2026-09-01T09:30:00.000Z"),
          assignedBy: { displayName: "IT Manager" },
          assignedUser: { displayName: "Technician A" },
          assignedSupportTeam: { name: "Front Office Support" },
        },
      ],
    },
    {
      id: ids.ticketOtherProperty,
      organizationId: "org-1",
      propertyId: "property-2",
      requesterUserId: ids.requester,
      affectedUserId: null,
      departmentId: "department-2",
      supportTeamId: null,
      assigneeUserId: null,
      ticketNumber: "PIR-001015",
      summary: "Hidden property ticket",
      description: "Should not appear.",
      priority: "P1",
      status: "new",
      source: "portal",
      createdAt: new Date("2026-09-01T04:00:00.000Z"),
      updatedAt: new Date("2026-09-01T04:10:00.000Z"),
      resolvedAt: null,
      closedAt: null,
      requester: { id: ids.requester, displayName: "Requester One" },
      affectedUser: null,
      property: { name: "Other Property", isActive: true },
      serviceLocation: { name: "Other" },
      department: { id: "department-2", name: "Other" },
      category: { name: "Printers", isActive: true },
      subcategory: null,
      supportTeam: null,
      assignee: null,
      comments: [],
      activities: [],
      assignments: [],
    },
  ];
});

describe("technician queue", () => {
  it("lists only in-scope tickets and paginates the unassigned queue", async () => {
    for (let index = 16; index <= 25; index += 1) {
      tickets.push({
        ...tickets[0],
        id: `ticket-extra-${index}`,
        ticketNumber: `PIR-0010${index}`,
        summary: `Extra queue ticket ${index}`,
        createdAt: new Date(`2026-09-01T${String(index - 15).padStart(2, "0")}:00:00.000Z`),
        updatedAt: new Date(`2026-09-01T${String(index - 15).padStart(2, "0")}:10:00.000Z`),
        activities: [],
        assignments: [],
      });
    }

    const workspace = await listTechnicianWorkspace(technicianAccess, {
      filter: "unassigned",
      page: "1",
    });

    expect(workspace.counts.unassigned).toBe(11);
    expect(workspace.tickets).toHaveLength(10);
    expect(workspace.tickets.every((ticket) => ticket.ticketNumber !== "PIR-001015")).toBe(true);

    const secondPage = await listTechnicianWorkspace(technicianAccess, {
      filter: "unassigned",
      page: "2",
    });
    expect(secondPage.page).toBe(2);
    expect(secondPage.tickets).toHaveLength(1);
  });

  it("separates my work, team work, waiting, and recently resolved views", async () => {
    const myWork = await listTechnicianWorkspace(technicianAccess, { filter: "my_work" });
    const teamWork = await listTechnicianWorkspace(technicianAccess, { filter: "team_work" });
    const waiting = await listTechnicianWorkspace(technicianAccess, { filter: "waiting" });
    const resolved = await listTechnicianWorkspace(technicianAccess, {
      filter: "recently_resolved",
    });

    expect(myWork.tickets.map((ticket) => ticket.ticketNumber)).toEqual(["PIR-001011"]);
    expect(teamWork.tickets.map((ticket) => ticket.ticketNumber)).toEqual(["PIR-001012"]);
    expect(waiting.tickets.map((ticket) => ticket.ticketNumber)).toEqual(["PIR-001013"]);
    expect(resolved.tickets.map((ticket) => ticket.ticketNumber)).toEqual(["PIR-001014"]);
  });

  it("loads detail with assignment options limited to valid queue members and teams", async () => {
    const detail = await getTechnicianTicketDetail(technicianAccess, ids.ticketResolved);

    expect(detail?.assignmentOptions.technicians.map((entry) => entry.name)).toEqual([
      "IT Manager",
      "Technician A",
      "Technician B",
    ]);
    expect(detail?.assignmentOptions.supportTeams.map((entry) => entry.name)).toEqual([
      "Front Office Support",
      "Shared Services",
    ]);
    expect(
      detail?.history.some(
        (entry) => "body" in entry && entry.body?.includes("Reset through the admin console."),
      ),
    ).toBe(true);
  });

  it("rejects queue access for users without ticket.queue.read", async () => {
    await expect(
      listTechnicianWorkspace(requesterAccess, { filter: "unassigned" }),
    ).rejects.toThrow("Access denied.");
  });

  it("assigns and reassigns tickets with audit and append-only history", async () => {
    const initialUpdatedAt = tickets
      .find((ticket) => ticket.id === ids.ticketUnassigned)!
      .updatedAt.toISOString();

    const assigned = await assignTicket(
      technicianAccess,
      {
        ticketId: ids.ticketUnassigned,
        assignedSupportTeamId: ids.teamFrontOffice,
        assignedUserId: ids.techA,
        expectedUpdatedAt: initialUpdatedAt,
        note: "Claiming the front desk issue.",
      },
      "corr-assign-1",
    );

    expect(assigned.assigneeUserId).toBe(ids.techA);
    expect(assigned.supportTeamId).toBe(ids.teamFrontOffice);
    expect(assigned.status).toBe("assigned");
    expect(tickets.find((ticket) => ticket.id === ids.ticketUnassigned)?.assignments).toHaveLength(
      1,
    );
    expect(recordedAudits).toHaveLength(1);

    const reassigned = await assignTicket(
      technicianAccess,
      {
        ticketId: ids.ticketTeamWork,
        assignedSupportTeamId: ids.teamFrontOffice,
        assignedUserId: ids.techA,
        expectedUpdatedAt: tickets
          .find((ticket) => ticket.id === ids.ticketTeamWork)!
          .updatedAt.toISOString(),
        note: "Taking over after handoff.",
      },
      "corr-assign-2",
    );

    expect(reassigned.assigneeUserId).toBe(ids.techA);
    expect(tickets.find((ticket) => ticket.id === ids.ticketTeamWork)?.assignments).toHaveLength(1);
  });

  it("rejects unauthorized assignment updates", async () => {
    await expect(
      assignTicket(
        requesterAccess,
        {
          ticketId: ids.ticketUnassigned,
          assignedUserId: ids.techA,
          expectedUpdatedAt: tickets
            .find((ticket) => ticket.id === ids.ticketUnassigned)!
            .updatedAt.toISOString(),
        },
        "corr-assign-3",
      ),
    ).rejects.toMatchObject({ code: "denied" });
  });

  it("rejects conflicting concurrent assignment updates", async () => {
    const expectedUpdatedAt = tickets
      .find((ticket) => ticket.id === ids.ticketUnassigned)!
      .updatedAt.toISOString();

    await assignTicket(
      technicianAccess,
      {
        ticketId: ids.ticketUnassigned,
        assignedUserId: ids.techA,
        expectedUpdatedAt,
      },
      "corr-assign-4",
    );

    await expect(
      assignTicket(
        technicianBAccess,
        {
          ticketId: ids.ticketUnassigned,
          assignedUserId: ids.techB,
          expectedUpdatedAt,
        },
        "corr-assign-5",
      ),
    ).rejects.toMatchObject({ code: "conflict" });
  });
});
