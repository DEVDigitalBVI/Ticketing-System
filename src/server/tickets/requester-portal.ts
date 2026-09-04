import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { listTicketAttachments, type TicketAttachmentView } from "@/server/attachments/service";
import type { AccessProfile } from "@/server/auth/access";
import { database } from "@/server/database/client";
import { AuditEventRepository } from "@/server/repositories/audit-event-repository";
import { evaluateSla, parseSlaPolicySnapshot } from "@/server/sla/policy";
import { addTicketComment, TicketServiceError } from "@/server/tickets/service";
import { canReadTicket, type TicketStatus } from "@/server/tickets/workflow";

const completedStatuses = ["closed", "cancelled"] as const satisfies readonly TicketStatus[];
const activeStatuses = [
  "new",
  "triage",
  "assigned",
  "in_progress",
  "waiting_for_requester",
  "waiting_for_vendor",
  "resolved",
] as const satisfies readonly TicketStatus[];
const requesterDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const requesterMonthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });
const requesterDayFormatter = new Intl.DateTimeFormat("en-US", { day: "2-digit" });

export type StaffTicketFilter = "active" | "completed" | "all";

export type StaffTicketListItem = {
  ticketId: string;
  id: string;
  type: string;
  title: string;
  location: string;
  updated: string;
  day: string;
  month: string;
  priority: "high" | "normal";
  status: "Waiting for IT" | "Needs your reply" | "Ready for confirmation" | "Completed";
  state: "active" | "completed";
  canonicalStatus: TicketStatus;
};

type StaffTicketThreadEntry = {
  id: string;
  kind: "activity" | "comment";
  title: string;
  body?: string;
  timestamp: string;
};

export type StaffTicketDetail = {
  ticketId: string;
  ticketNumber: string;
  title: string;
  canonicalStatus: TicketStatus;
  staffStatus: StaffTicketListItem["status"];
  description: string;
  property: string;
  location: string;
  department: string;
  category: string;
  subcategory: string | null;
  impact: string;
  urgency: string;
  priority: string;
  resolutionSummary: string | null;
  closureDetails: string | null;
  canConfirmResolution: boolean;
  serviceExpectation: string;
  attachments: TicketAttachmentView[];
  thread: StaffTicketThreadEntry[];
};

export type RequesterTicketWorkspace = {
  filter: StaffTicketFilter;
  query: string;
  page: number;
  pageSize: number;
  totalPages: number;
  counts: {
    active: number;
    completed: number;
    all: number;
  };
  tickets: StaffTicketListItem[];
  selectedTicket: StaffTicketDetail | null;
};

type PortalSearch = {
  filter?: string;
  q?: string;
  page?: string;
  ticket?: string;
};

type AccessTicketShape = {
  organizationId: string;
  propertyId: string;
  requesterUserId: string;
  affectedUserId?: string | null;
  departmentId?: string | null;
};

function subjectFromAccess(access: AccessProfile) {
  return {
    userId: access.userId,
    organizationId: access.organizationId,
    propertyIds: access.properties.map((property) => property.id),
    departmentIds: access.departmentIds,
    roles: access.roles,
  };
}

function staffStatusFor(status: TicketStatus): StaffTicketListItem["status"] {
  if (status === "waiting_for_requester") return "Needs your reply";
  if (status === "resolved") return "Ready for confirmation";
  if (status === "closed" || status === "cancelled") return "Completed";
  return "Waiting for IT";
}

function ticketStateFor(status: TicketStatus): StaffTicketListItem["state"] {
  return status === "closed" || status === "cancelled" ? "completed" : "active";
}

function formatRelativeDate(value: Date) {
  return requesterDateFormatter.format(value);
}

function dateParts(value: Date) {
  const month = requesterMonthFormatter.format(value);
  const day = requesterDayFormatter.format(value);
  return { day, month };
}

function accessibleTicketWhere(access: AccessProfile) {
  return {
    organizationId: access.organizationId,
    propertyId: { in: access.properties.map((property) => property.id) },
    OR: [{ requesterUserId: access.userId }, { affectedUserId: access.userId }],
  } satisfies Prisma.TicketWhereInput;
}

function filteredWhere(access: AccessProfile, filter: StaffTicketFilter, query: string) {
  const normalizedQuery = query.trim();

  return {
    AND: [
      accessibleTicketWhere(access),
      filter === "active"
        ? { status: { in: [...activeStatuses] } }
        : filter === "completed"
          ? { status: { in: [...completedStatuses] } }
          : {},
      normalizedQuery
        ? {
            OR: [
              { ticketNumber: { contains: normalizedQuery, mode: "insensitive" } },
              { summary: { contains: normalizedQuery, mode: "insensitive" } },
              { description: { contains: normalizedQuery, mode: "insensitive" } },
              { resolutionSummary: { contains: normalizedQuery, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  } satisfies Prisma.TicketWhereInput;
}

function parseSearch(search: PortalSearch) {
  const filter =
    search.filter === "completed" || search.filter === "all" ? search.filter : "active";
  const query = typeof search.q === "string" ? search.q.trim().slice(0, 100) : "";
  const pageValue = Number.parseInt(search.page ?? "1", 10);
  const page = Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1;
  const ticketId =
    typeof search.ticket === "string" && /^[0-9a-f-]{36}$/i.test(search.ticket)
      ? search.ticket
      : undefined;

  return { filter, query, page, ticketId } as const;
}

function mapThreadEntry(
  access: AccessProfile,
  entry:
    | {
        id: string;
        createdAt: Date;
        activityType: string;
        toStatus: string | null;
      }
    | {
        id: string;
        createdAt: Date;
        authorUserId: string | null;
        body: string;
        visibility: string;
      },
) {
  if ("body" in entry) {
    return {
      id: entry.id,
      kind: "comment" as const,
      title: entry.authorUserId === access.userId ? "Your reply" : "IT reply",
      body: entry.body,
      timestamp: formatRelativeDate(entry.createdAt),
    };
  }

  const title =
    entry.activityType === "ticket_created"
      ? "Request submitted"
      : entry.toStatus === "resolved"
        ? "IT marked this request resolved"
        : entry.toStatus === "closed"
          ? "Resolution confirmed"
          : entry.toStatus === "cancelled"
            ? "Request cancelled"
            : entry.toStatus === "waiting_for_requester"
              ? "IT needs more information from you"
              : "Status updated";

  return {
    id: entry.id,
    kind: "activity" as const,
    title,
    timestamp: formatRelativeDate(entry.createdAt),
  };
}

function assertPortalReadable(access: AccessProfile, ticket: AccessTicketShape) {
  if (!canReadTicket(subjectFromAccess(access), ticket)) {
    throw new TicketServiceError("denied");
  }
}

export async function listRequesterTicketWorkspace(
  access: AccessProfile,
  search: PortalSearch,
): Promise<RequesterTicketWorkspace> {
  const { filter, query, page, ticketId } = parseSearch(search);
  const pageSize = 10;
  const where = filteredWhere(access, filter, query);

  const [activeCount, completedCount, allCount] = await Promise.all([
    database.ticket.count({ where: filteredWhere(access, "active", query) }),
    database.ticket.count({ where: filteredWhere(access, "completed", query) }),
    database.ticket.count({ where: filteredWhere(access, "all", query) }),
  ]);

  const totalForFilter =
    filter === "active" ? activeCount : filter === "completed" ? completedCount : allCount;
  const totalPages = Math.max(1, Math.ceil(totalForFilter / pageSize));
  const normalizedPage = Math.min(page, totalPages);

  const tickets = await database.ticket.findMany({
    where,
    include: {
      serviceLocation: { select: { name: true } },
      category: { select: { name: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    skip: (normalizedPage - 1) * pageSize,
    take: pageSize,
  });

  const selectedTicket = ticketId
    ? await getRequesterTicketDetail(access, ticketId).catch(() => null)
    : null;

  return {
    filter,
    query,
    page: normalizedPage,
    pageSize,
    totalPages,
    counts: {
      active: activeCount,
      completed: completedCount,
      all: allCount,
    },
    tickets: tickets.map((ticket) => {
      const created = dateParts(ticket.createdAt);
      return {
        ticketId: ticket.id,
        id: ticket.ticketNumber,
        type: ticket.category.name,
        title: ticket.summary,
        location: ticket.serviceLocation?.name ?? "Location not specified",
        updated: formatRelativeDate(ticket.updatedAt),
        day: created.day,
        month: created.month,
        priority: ticket.priority === "P1" || ticket.priority === "P2" ? "high" : "normal",
        status: staffStatusFor(ticket.status as TicketStatus),
        state: ticketStateFor(ticket.status as TicketStatus),
        canonicalStatus: ticket.status as TicketStatus,
      };
    }),
    selectedTicket,
  };
}

export async function getRequesterTicketDetail(access: AccessProfile, ticketId: string) {
  const now = new Date();
  const ticket = await database.ticket.findFirst({
    where: {
      ...accessibleTicketWhere(access),
      id: ticketId,
    },
    include: {
      property: { select: { name: true } },
      serviceLocation: { select: { name: true } },
      department: { select: { name: true } },
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
      comments: {
        where: { visibility: "requester" },
        orderBy: [{ createdAt: "asc" }],
        select: { id: true, body: true, visibility: true, createdAt: true, authorUserId: true },
      },
      activities: {
        where: { requesterVisible: true },
        orderBy: [{ createdAt: "asc" }],
        select: { id: true, createdAt: true, activityType: true, toStatus: true },
      },
    },
  });

  if (!ticket) return null;

  const slaPolicy = parseSlaPolicySnapshot(ticket.slaPolicySnapshot);
  const sla = evaluateSla({
    now,
    status: ticket.status as TicketStatus,
    policy: slaPolicy,
    responseDueAt: ticket.slaResponseDueAt,
    respondedAt: ticket.slaRespondedAt,
    resolutionDueAt: ticket.slaResolutionDueAt,
    resolvedAt: ticket.resolvedAt,
  });
  const expectationDate =
    sla.nextDeadline && slaPolicy
      ? new Intl.DateTimeFormat("en-US", {
          timeZone: slaPolicy.timezone,
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        }).format(sla.nextDeadline)
      : null;
  const serviceExpectation =
    sla.overall === "paused"
      ? "The service clock is paused while IT waits for the requested information or vendor action."
      : expectationDate
        ? `The next service target is ${expectationDate}. Support hours and approved holidays are included.`
        : sla.overall === "met"
          ? "The applicable response and resolution targets have been completed."
          : "No active service target applies to this ticket.";

  assertPortalReadable(access, {
    organizationId: ticket.organizationId,
    propertyId: ticket.propertyId,
    requesterUserId: ticket.requesterUserId,
    affectedUserId: ticket.affectedUserId,
    departmentId: ticket.departmentId,
  });

  const attachments = await listTicketAttachments(access, ticket.id);

  const thread = [...ticket.activities, ...ticket.comments]
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
    .map((entry) => mapThreadEntry(access, entry));

  return {
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    title: ticket.summary,
    canonicalStatus: ticket.status as TicketStatus,
    staffStatus: staffStatusFor(ticket.status as TicketStatus),
    description: ticket.description,
    property: ticket.property.name,
    location: ticket.serviceLocation?.name ?? "Location not specified",
    department: ticket.department?.name ?? "Department not specified",
    category: ticket.category.name,
    subcategory: ticket.subcategory?.name ?? null,
    impact: ticket.impact,
    urgency: ticket.urgency,
    priority: ticket.priority,
    resolutionSummary: ticket.resolutionSummary,
    closureDetails: ticket.closureDetails,
    canConfirmResolution: ticket.status === "resolved",
    serviceExpectation,
    attachments,
    thread,
  } satisfies StaffTicketDetail;
}

export async function addRequesterVisibleReply(
  access: AccessProfile,
  ticketId: string,
  body: string,
  correlationId: string,
) {
  return addTicketComment(
    access,
    {
      ticketId,
      visibility: "requester",
      body,
    },
    correlationId,
  );
}

export async function confirmRequesterTicketResolution(
  access: AccessProfile,
  ticketId: string,
  correlationId: string,
) {
  const ticket = await database.ticket.findFirst({
    where: {
      ...accessibleTicketWhere(access),
      id: ticketId,
    },
    select: {
      id: true,
      organizationId: true,
      propertyId: true,
      requesterUserId: true,
      affectedUserId: true,
      departmentId: true,
      ticketNumber: true,
      status: true,
      resolutionCode: true,
      resolutionSummary: true,
    },
  });

  if (!ticket) throw new TicketServiceError("not_found");
  assertPortalReadable(access, ticket);
  if (ticket.status !== "resolved") throw new TicketServiceError("transition_invalid");

  return database.$transaction(async (transaction) => {
    const now = new Date();
    const updated = await transaction.ticket.update({
      where: { id_organizationId: { id: ticket.id, organizationId: ticket.organizationId } },
      data: {
        status: "closed",
        closedAt: now,
        closureDetails: "Resolution confirmed by requester.",
      },
    });

    await transaction.ticketActivity.create({
      data: {
        organizationId: ticket.organizationId,
        ticketId: ticket.id,
        actorUserId: access.userId,
        activityType: "status_changed",
        fromStatus: "resolved",
        toStatus: "closed",
        requesterVisible: true,
        metadata: {
          confirmation: "requester_confirmed_resolution",
        },
      },
    });

    const auditRepository = new AuditEventRepository(transaction);
    await auditRepository.record({
      organizationId: ticket.organizationId,
      propertyId: ticket.propertyId,
      actorUserId: access.userId,
      action: "ticket.resolution_confirmed",
      entityType: "ticket",
      entityId: ticket.id,
      result: "success",
      correlationId,
      metadata: {
        ticketNumber: ticket.ticketNumber,
      },
    });

    return updated;
  });
}
