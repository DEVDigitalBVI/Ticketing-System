import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { accessCan } from "@/server/auth/authorization";
import type { AccessProfile } from "@/server/auth/access";
import { database } from "@/server/database/client";
import type { TicketStatus } from "@/server/tickets/workflow";

export type TechnicianQueueFilter =
  "unassigned" | "my_work" | "team_work" | "waiting" | "at_risk" | "breached" | "recently_resolved";

export type TechnicianQueueListItem = {
  ticketId: string;
  ticketNumber: string;
  subject: string;
  requester: string;
  location: string;
  category: string;
  priority: "P1" | "P2" | "P3" | "P4";
  status: string;
  canonicalStatus: TicketStatus;
  assignee: string;
  assigneeInitials: string;
  age: string;
  serviceIndicator: string;
};

export type TechnicianHistoryEntry = {
  id: string;
  kind: "activity" | "comment" | "assignment";
  title: string;
  body?: string;
  timestamp: string;
};

export type TechnicianQueueDetail = {
  ticketId: string;
  ticketNumber: string;
  updatedAtToken: string;
  subject: string;
  description: string;
  requester: string;
  affectedUser: string | null;
  property: string;
  location: string;
  department: string;
  category: string;
  subcategory: string | null;
  priority: "P1" | "P2" | "P3" | "P4";
  status: string;
  canonicalStatus: TicketStatus;
  assignee: string;
  supportTeam: string;
  impact: string;
  urgency: string;
  age: string;
  source: string;
  resolutionCode: string | null;
  resolutionSummary: string | null;
  closureDetails: string | null;
  serviceIndicator: string;
  history: TechnicianHistoryEntry[];
  assignmentOptions: {
    supportTeams: Array<{ id: string; name: string }>;
    technicians: Array<{ id: string; name: string }>;
  };
};

export type TechnicianWorkspaceData = {
  filter: TechnicianQueueFilter;
  page: number;
  pageSize: number;
  totalPages: number;
  counts: Record<TechnicianQueueFilter, number>;
  metrics: {
    unassigned: number;
    myWork: number;
    waiting: number;
    recentlyResolved: number;
  };
  tickets: TechnicianQueueListItem[];
  selectedTicket: TechnicianQueueDetail | null;
};

type QueueSearch = {
  filter?: string;
  page?: string;
  ticket?: string;
};

const actionableQueueStatuses = [
  "new",
  "triage",
  "assigned",
  "in_progress",
] as const satisfies readonly TicketStatus[];
const unassignedStatuses = ["new", "triage"] as const satisfies readonly TicketStatus[];
const waitingStatuses = [
  "waiting_for_requester",
  "waiting_for_vendor",
] as const satisfies readonly TicketStatus[];
const recentlyResolvedStatuses = ["resolved", "closed"] as const satisfies readonly TicketStatus[];
const ticketDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function parseSearch(search: QueueSearch) {
  const filterValues: TechnicianQueueFilter[] = [
    "unassigned",
    "my_work",
    "team_work",
    "waiting",
    "at_risk",
    "breached",
    "recently_resolved",
  ];
  const filter = filterValues.includes(search.filter as TechnicianQueueFilter)
    ? (search.filter as TechnicianQueueFilter)
    : "unassigned";
  const pageValue = Number.parseInt(search.page ?? "1", 10);
  const page = Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1;
  const ticketId =
    typeof search.ticket === "string" && /^[0-9a-f-]{36}$/i.test(search.ticket)
      ? search.ticket
      : undefined;

  return { filter, page, ticketId } as const;
}

function initialsFor(name: string | null) {
  if (!name) return "—";
  const parts = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "");
  return parts.join("") || "—";
}

function formatDate(value: Date) {
  return ticketDateFormatter.format(value);
}

function formatAge(value: Date) {
  const minutes = Math.max(1, Math.floor((Date.now() - value.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function staffStatusFor(status: TicketStatus) {
  switch (status) {
    case "new":
      return "New";
    case "triage":
      return "Triage";
    case "assigned":
      return "Assigned";
    case "in_progress":
      return "In progress";
    case "waiting_for_requester":
      return "Waiting for requester";
    case "waiting_for_vendor":
      return "Waiting for vendor";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
    case "cancelled":
      return "Cancelled";
  }
}

function serviceIndicatorFor(status: TicketStatus) {
  switch (status) {
    case "waiting_for_requester":
      return "Waiting on requester";
    case "waiting_for_vendor":
      return "Waiting on vendor";
    case "resolved":
      return "Ready for confirmation";
    case "closed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Technician action";
  }
}

function baseWhere(access: AccessProfile) {
  return {
    organizationId: access.organizationId,
    propertyId: { in: access.properties.map((property) => property.id) },
  } satisfies Prisma.TicketWhereInput;
}

function filterWhere(access: AccessProfile, filter: TechnicianQueueFilter) {
  const base = baseWhere(access);

  switch (filter) {
    case "unassigned":
      return {
        AND: [
          base,
          { status: { in: [...unassignedStatuses] } },
          { supportTeamId: null },
          { assigneeUserId: null },
        ],
      } satisfies Prisma.TicketWhereInput;
    case "my_work":
      return {
        AND: [
          base,
          { status: { in: [...actionableQueueStatuses] } },
          { assigneeUserId: access.userId },
        ],
      } satisfies Prisma.TicketWhereInput;
    case "team_work":
      return {
        AND: [
          base,
          { status: { in: [...actionableQueueStatuses] } },
          {
            OR: [{ supportTeamId: { not: null } }, { assigneeUserId: { not: null } }],
          },
          { assigneeUserId: { not: access.userId } },
        ],
      } satisfies Prisma.TicketWhereInput;
    case "waiting":
      return {
        AND: [base, { status: { in: [...waitingStatuses] } }],
      } satisfies Prisma.TicketWhereInput;
    case "at_risk":
    case "breached":
      return {
        AND: [base, { id: { equals: "__no_sla_placeholder__" } }],
      } satisfies Prisma.TicketWhereInput;
    case "recently_resolved":
      return {
        AND: [base, { status: { in: [...recentlyResolvedStatuses] } }],
      } satisfies Prisma.TicketWhereInput;
  }
}

function orderByFor(filter: TechnicianQueueFilter): Prisma.TicketOrderByWithRelationInput[] {
  switch (filter) {
    case "recently_resolved":
      return [{ resolvedAt: "desc" }, { closedAt: "desc" }, { updatedAt: "desc" }];
    case "waiting":
      return [{ updatedAt: "asc" }, { createdAt: "asc" }];
    default:
      return [{ priority: "asc" }, { createdAt: "asc" }, { updatedAt: "asc" }];
  }
}

function historyTitleForActivity(
  activityType: string,
  toStatus: string | null,
  actorName: string | null,
) {
  if (activityType === "ticket_created") return "Ticket created";
  if (activityType === "assignment_recorded")
    return actorName ? `Assignment updated by ${actorName}` : "Assignment updated";
  if (activityType === "internal_note_added") return "Internal note added";
  if (activityType === "comment_added")
    return actorName ? `Requester-visible reply from ${actorName}` : "Requester-visible reply";
  if (toStatus) return `Status changed to ${staffStatusFor(toStatus as TicketStatus)}`;
  return "Ticket updated";
}

function mapCommentTitle(authorName: string, visibility: string) {
  return visibility === "internal"
    ? `Internal note from ${authorName}`
    : `Public reply from ${authorName}`;
}

async function loadAssignableTechnicians(access: AccessProfile, propertyId: string) {
  const roleRows = await database.userRole.findMany({
    where: {
      organizationId: access.organizationId,
      propertyId,
      user: { isActive: true },
      role: { key: { in: ["technician", "it_manager", "system_administrator"] } },
    },
    include: {
      user: { select: { id: true, displayName: true } },
    },
    orderBy: [{ user: { displayName: "asc" } }],
  });

  const uniqueUsers = new Map<string, string>();
  for (const row of roleRows) {
    uniqueUsers.set(row.user.id, row.user.displayName);
  }

  return [...uniqueUsers.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function loadAssignableSupportTeams(
  access: AccessProfile,
  propertyId: string,
  departmentId?: string | null,
) {
  const rows = await database.supportTeam.findMany({
    where: {
      organizationId: access.organizationId,
      propertyId,
      isActive: true,
      OR: departmentId ? [{ departmentId }, { departmentId: null }] : undefined,
    },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true },
  });

  return rows;
}

export async function listTechnicianWorkspace(
  access: AccessProfile,
  search: QueueSearch,
): Promise<TechnicianWorkspaceData> {
  if (!accessCan(access, "ticket.queue.read")) {
    throw new Error("Access denied.");
  }

  const { filter, page, ticketId } = parseSearch(search);
  const pageSize = 10;
  const [unassigned, myWork, teamWork, waiting, atRisk, breached, recentlyResolved] =
    await Promise.all([
      database.ticket.count({ where: filterWhere(access, "unassigned") }),
      database.ticket.count({ where: filterWhere(access, "my_work") }),
      database.ticket.count({ where: filterWhere(access, "team_work") }),
      database.ticket.count({ where: filterWhere(access, "waiting") }),
      database.ticket.count({ where: filterWhere(access, "at_risk") }),
      database.ticket.count({ where: filterWhere(access, "breached") }),
      database.ticket.count({ where: filterWhere(access, "recently_resolved") }),
    ]);
  const counts = {
    unassigned,
    my_work: myWork,
    team_work: teamWork,
    waiting,
    at_risk: atRisk,
    breached,
    recently_resolved: recentlyResolved,
  } satisfies Record<TechnicianQueueFilter, number>;

  const totalPages = Math.max(1, Math.ceil(counts[filter] / pageSize));
  const normalizedPage = Math.min(page, totalPages);

  const tickets = await database.ticket.findMany({
    where: filterWhere(access, filter),
    select: {
      id: true,
      ticketNumber: true,
      summary: true,
      createdAt: true,
      status: true,
      priority: true,
      requester: { select: { displayName: true } },
      serviceLocation: { select: { name: true } },
      category: { select: { name: true } },
      assignee: { select: { displayName: true } },
    },
    orderBy: orderByFor(filter),
    skip: (normalizedPage - 1) * pageSize,
    take: pageSize,
  });

  const selectedTicket = ticketId
    ? await getTechnicianTicketDetail(access, ticketId).catch(() => null)
    : null;

  return {
    filter,
    page: normalizedPage,
    pageSize,
    totalPages,
    counts,
    metrics: {
      unassigned: counts.unassigned,
      myWork: counts.my_work,
      waiting: counts.waiting,
      recentlyResolved: counts.recently_resolved,
    },
    tickets: tickets.map((ticket) => ({
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.summary,
      requester: ticket.requester.displayName,
      location: ticket.serviceLocation?.name ?? "Location not specified",
      category: ticket.category.name,
      priority: ticket.priority as TechnicianQueueListItem["priority"],
      status: staffStatusFor(ticket.status as TicketStatus),
      canonicalStatus: ticket.status as TicketStatus,
      assignee: ticket.assignee?.displayName ?? "Unassigned",
      assigneeInitials: initialsFor(ticket.assignee?.displayName ?? null),
      age: formatAge(ticket.createdAt),
      serviceIndicator: serviceIndicatorFor(ticket.status as TicketStatus),
    })),
    selectedTicket,
  };
}

export async function getTechnicianTicketDetail(access: AccessProfile, ticketId: string) {
  const ticket = await database.ticket.findFirst({
    where: {
      ...baseWhere(access),
      id: ticketId,
    },
    include: {
      requester: { select: { displayName: true } },
      affectedUser: { select: { displayName: true } },
      property: { select: { name: true } },
      serviceLocation: { select: { name: true } },
      department: { select: { name: true, id: true } },
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
      supportTeam: { select: { name: true } },
      assignee: { select: { displayName: true } },
      activities: {
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          activityType: true,
          toStatus: true,
          createdAt: true,
          actor: { select: { displayName: true } },
        },
      },
      comments: {
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          visibility: true,
          body: true,
          createdAt: true,
          author: { select: { displayName: true } },
        },
      },
      assignments: {
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          note: true,
          createdAt: true,
          assignedBy: { select: { displayName: true } },
          assignedUser: { select: { displayName: true } },
          assignedSupportTeam: { select: { name: true } },
        },
      },
    },
  });

  if (!ticket) return null;

  const [supportTeams, technicians] = await Promise.all([
    loadAssignableSupportTeams(access, ticket.propertyId, ticket.departmentId),
    loadAssignableTechnicians(access, ticket.propertyId),
  ]);

  const history = [
    ...ticket.activities.map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      value: {
        id: entry.id,
        kind: "activity" as const,
        title: historyTitleForActivity(
          entry.activityType,
          entry.toStatus,
          entry.actor?.displayName ?? null,
        ),
        timestamp: formatDate(entry.createdAt),
      },
    })),
    ...ticket.comments.map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      value: {
        id: entry.id,
        kind: "comment" as const,
        title: mapCommentTitle(entry.author.displayName, entry.visibility),
        body: entry.body,
        timestamp: formatDate(entry.createdAt),
      },
    })),
    ...ticket.assignments.map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      value: {
        id: entry.id,
        kind: "assignment" as const,
        title: entry.assignedUser?.displayName
          ? `Assigned to ${entry.assignedUser.displayName}`
          : entry.assignedSupportTeam?.name
            ? `Assigned to ${entry.assignedSupportTeam.name}`
            : "Assignment recorded",
        body: entry.note ?? undefined,
        timestamp: formatDate(entry.createdAt),
      },
    })),
  ]
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
    .map((entry) => entry.value);

  return {
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    updatedAtToken: ticket.updatedAt.toISOString(),
    subject: ticket.summary,
    description: ticket.description,
    requester: ticket.requester.displayName,
    affectedUser: ticket.affectedUser?.displayName ?? null,
    property: ticket.property.name,
    location: ticket.serviceLocation?.name ?? "Location not specified",
    department: ticket.department?.name ?? "Department not specified",
    category: ticket.category.name,
    subcategory: ticket.subcategory?.name ?? null,
    priority: ticket.priority as TechnicianQueueDetail["priority"],
    impact: ticket.impact,
    urgency: ticket.urgency,
    status: staffStatusFor(ticket.status as TicketStatus),
    canonicalStatus: ticket.status as TicketStatus,
    assignee: ticket.assignee?.displayName ?? "Unassigned",
    supportTeam: ticket.supportTeam?.name ?? "Unassigned",
    age: formatAge(ticket.createdAt),
    source: ticket.source.replaceAll("_", " "),
    resolutionCode: ticket.resolutionCode ?? null,
    resolutionSummary: ticket.resolutionSummary ?? null,
    closureDetails: ticket.closureDetails ?? null,
    serviceIndicator: serviceIndicatorFor(ticket.status as TicketStatus),
    history,
    assignmentOptions: { supportTeams, technicians },
  } satisfies TechnicianQueueDetail;
}
