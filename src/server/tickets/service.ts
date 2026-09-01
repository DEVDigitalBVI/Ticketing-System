import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { accessCan } from "@/server/auth/authorization";
import type { AccessProfile } from "@/server/auth/access";
import { database } from "@/server/database/client";
import { AuditEventRepository } from "@/server/repositories/audit-event-repository";
import { TicketRepository } from "@/server/repositories/ticket-repository";
import {
  calculatePriorityPlaceholder,
  canAddComment,
  canAssignTicket,
  canMutateTicketStatus,
  canReadTicket,
  canTransitionStatus,
  ticketCommentVisibilityValues,
  ticketImpactValues,
  ticketResolutionCodeValues,
  ticketSourceValues,
  ticketStatuses,
  ticketUrgencyValues,
  type TicketCommentVisibility,
  type TicketStatus,
} from "@/server/tickets/workflow";
import { z } from "zod";

const uuidSchema = z.string().uuid();
const optionalUuidSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().uuid().optional(),
);
const nonBlankTextSchema = z.string().trim().min(2).max(10_000);

const createTicketSchema = z.object({
  summary: z.string().trim().min(3).max(180),
  description: nonBlankTextSchema,
  affectedUserId: optionalUuidSchema,
  propertyId: uuidSchema,
  serviceLocationId: optionalUuidSchema,
  departmentId: optionalUuidSchema,
  categoryId: uuidSchema,
  subcategoryId: optionalUuidSchema,
  impact: z.enum(ticketImpactValues),
  urgency: z.enum(ticketUrgencyValues),
  supportTeamId: optionalUuidSchema,
  assigneeUserId: optionalUuidSchema,
  source: z.enum(ticketSourceValues).default("portal"),
});

const assignTicketSchema = z.object({
  ticketId: uuidSchema,
  assignedUserId: optionalUuidSchema,
  assignedSupportTeamId: optionalUuidSchema,
  note: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(2).max(1000).optional(),
  ),
});

const commentSchema = z.object({
  ticketId: uuidSchema,
  visibility: z.enum(ticketCommentVisibilityValues),
  body: nonBlankTextSchema.max(4000),
});

const transitionSchema = z.object({
  ticketId: uuidSchema,
  toStatus: z.enum(ticketStatuses),
  resolutionCode: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.enum(ticketResolutionCodeValues).optional(),
  ),
  resolutionSummary: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(2).max(2000).optional(),
  ),
  closureDetails: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(2).max(2000).optional(),
  ),
});

export class TicketServiceError extends Error {
  constructor(
    readonly code:
      | "denied"
      | "invalid"
      | "not_found"
      | "transition_invalid"
      | "assignment_required"
      | "resolution_required",
    readonly ticketId?: string,
  ) {
    super(code);
    this.name = "TicketServiceError";
  }
}

function subjectFromAccess(access: AccessProfile) {
  return {
    userId: access.userId,
    organizationId: access.organizationId,
    propertyIds: access.properties.map((property) => property.id),
    departmentIds: access.departmentIds,
    roles: access.roles,
  };
}

function parseOrThrow<T>(result: z.ZodSafeParseResult<T>, ticketId?: string) {
  if (!result.success) throw new TicketServiceError("invalid", ticketId);
  return result.data;
}

function toJsonObject(data: Record<string, string | number | boolean | null | undefined>) {
  const entries = Object.entries(data).filter(
    (entry): entry is [string, string | number | boolean | null] => entry[1] !== undefined,
  );
  return Object.fromEntries(entries) as Prisma.InputJsonObject;
}

function assertReadable(
  access: AccessProfile,
  ticket: {
    organizationId: string;
    propertyId: string;
    requesterUserId: string;
    departmentId?: string | null;
  },
) {
  if (!canReadTicket(subjectFromAccess(access), ticket)) throw new TicketServiceError("denied");
}

async function assertActiveLinkedRecords(
  repository: TicketRepository,
  organizationId: string,
  input: z.infer<typeof createTicketSchema>,
) {
  const [property, category] = await Promise.all([
    repository.findProperty(input.propertyId, organizationId),
    repository.findCategory(input.categoryId, organizationId),
  ]);

  if (!property || !category) throw new TicketServiceError("invalid");

  if (input.affectedUserId) {
    const affectedUser = await repository.findUser(input.affectedUserId, organizationId);
    if (!affectedUser) throw new TicketServiceError("invalid");
  }

  if (input.serviceLocationId) {
    const serviceLocation = await repository.findServiceLocation(
      input.serviceLocationId,
      organizationId,
    );
    if (!serviceLocation || serviceLocation.propertyId !== input.propertyId)
      throw new TicketServiceError("invalid");
  }

  if (input.departmentId) {
    const department = await repository.findDepartment(input.departmentId, organizationId);
    if (!department || department.propertyId !== input.propertyId)
      throw new TicketServiceError("invalid");
  }

  if (input.subcategoryId) {
    const subcategory = await repository.findSubcategory(input.subcategoryId, organizationId);
    if (!subcategory || subcategory.categoryId !== input.categoryId)
      throw new TicketServiceError("invalid");
  }

  if (input.supportTeamId) {
    const supportTeam = await repository.findSupportTeam(input.supportTeamId, organizationId);
    if (!supportTeam || supportTeam.propertyId !== input.propertyId)
      throw new TicketServiceError("invalid");
  }

  if (input.assigneeUserId) {
    const assignee = await repository.findUser(input.assigneeUserId, organizationId);
    if (!assignee) throw new TicketServiceError("invalid");
    if (
      !(await repository.userHasPropertyRole(
        input.assigneeUserId,
        organizationId,
        input.propertyId,
      ))
    )
      throw new TicketServiceError("invalid");
  }
}

function transitionActivityVisible(status: TicketStatus) {
  return ["waiting_for_requester", "resolved", "closed", "cancelled"].includes(status);
}

function transitionUpdate(
  fromStatus: TicketStatus,
  toStatus: TicketStatus,
  input: z.infer<typeof transitionSchema>,
  current: {
    supportTeamId: string | null;
    assigneeUserId: string | null;
  },
) {
  if (!canTransitionStatus(fromStatus, toStatus)) {
    throw new TicketServiceError("transition_invalid", input.ticketId);
  }

  if (
    ["assigned", "in_progress", "waiting_for_requester", "waiting_for_vendor"].includes(toStatus) &&
    !current.supportTeamId &&
    !current.assigneeUserId
  ) {
    throw new TicketServiceError("assignment_required", input.ticketId);
  }

  const now = new Date();
  const update: Prisma.TicketUncheckedUpdateInput = {
    status: toStatus,
    closedAt: null,
    cancelledAt: null,
  };

  if (toStatus === "triage") {
    update.triagedAt = now;
    update.resolvedAt = null;
    update.resolutionCode = null;
    update.resolutionSummary = null;
    update.closureDetails = null;
  }

  if (toStatus === "assigned") {
    update.assignedAt = now;
    update.resolvedAt = null;
    update.resolutionCode = null;
    update.resolutionSummary = null;
    update.closureDetails = null;
  }

  if (toStatus === "in_progress") {
    update.startedAt = now;
    update.resolvedAt = null;
    update.resolutionCode = null;
    update.resolutionSummary = null;
    update.closureDetails = null;
  }

  if (toStatus === "resolved") {
    if (!input.resolutionCode || !input.resolutionSummary) {
      throw new TicketServiceError("resolution_required", input.ticketId);
    }
    update.resolvedAt = now;
    update.resolutionCode = input.resolutionCode;
    update.resolutionSummary = input.resolutionSummary;
    update.closureDetails = null;
  }

  if (toStatus === "closed") {
    if (fromStatus !== "resolved" || !input.closureDetails) {
      throw new TicketServiceError("transition_invalid", input.ticketId);
    }
    update.closedAt = now;
    update.closureDetails = input.closureDetails;
  }

  if (toStatus === "cancelled") {
    if (!input.closureDetails) throw new TicketServiceError("transition_invalid", input.ticketId);
    update.cancelledAt = now;
    update.closureDetails = input.closureDetails;
    update.resolutionCode = "cancelled";
    update.resolutionSummary = input.closureDetails;
    update.resolvedAt = null;
  }

  return {
    now,
    update,
  };
}

async function recordAudit(
  auditRepository: AuditEventRepository,
  access: AccessProfile,
  propertyId: string,
  correlationId: string,
  action: string,
  entityId: string,
  metadata: Prisma.InputJsonObject,
) {
  await auditRepository.record({
    organizationId: access.organizationId,
    propertyId,
    actorUserId: access.userId,
    action,
    entityType: "ticket",
    entityId,
    result: "success",
    correlationId,
    metadata,
  });
}

export async function createTicket(
  access: AccessProfile,
  rawInput: unknown,
  correlationId: string,
) {
  const input = parseOrThrow(createTicketSchema.safeParse(rawInput));
  if (
    !accessCan(access, "ticket.submit", {
      organizationId: access.organizationId,
      propertyId: input.propertyId,
      departmentId: input.departmentId ?? undefined,
    })
  ) {
    throw new TicketServiceError("denied");
  }

  if (
    (input.supportTeamId || input.assigneeUserId) &&
    !canAssignTicket(subjectFromAccess(access), {
      organizationId: access.organizationId,
      propertyId: input.propertyId,
      requesterUserId: access.userId,
      departmentId: input.departmentId,
    })
  ) {
    throw new TicketServiceError("denied");
  }

  return database.$transaction(async (transaction) => {
    const repository = new TicketRepository(transaction);
    const auditRepository = new AuditEventRepository(transaction);

    await assertActiveLinkedRecords(repository, access.organizationId, input);

    const ticket = await repository.createTicket({
      organizationId: access.organizationId,
      ticketNumber: "",
      summary: input.summary,
      description: input.description,
      requesterUserId: access.userId,
      affectedUserId: input.affectedUserId,
      propertyId: input.propertyId,
      serviceLocationId: input.serviceLocationId,
      departmentId: input.departmentId,
      categoryId: input.categoryId,
      subcategoryId: input.subcategoryId,
      impact: input.impact,
      urgency: input.urgency,
      priority: calculatePriorityPlaceholder(input.impact, input.urgency),
      supportTeamId: input.supportTeamId,
      assigneeUserId: input.assigneeUserId,
      source: input.source,
      status: input.supportTeamId || input.assigneeUserId ? "assigned" : "new",
      assignedAt: input.supportTeamId || input.assigneeUserId ? new Date() : undefined,
    });

    await repository.createActivity({
      organizationId: access.organizationId,
      ticketId: ticket.id,
      actorUserId: access.userId,
      activityType: "ticket_created",
      toStatus: ticket.status,
      requesterVisible: true,
      metadata: toJsonObject({
        ticketNumber: ticket.ticketNumber,
        source: ticket.source,
        priority: ticket.priority,
      }),
    });

    if (ticket.supportTeamId || ticket.assigneeUserId) {
      await repository.createAssignment({
        organizationId: access.organizationId,
        ticketId: ticket.id,
        assignedByUserId: access.userId,
        assignedSupportTeamId: ticket.supportTeamId,
        assignedUserId: ticket.assigneeUserId,
        note: "Initial assignment during ticket creation.",
      });
    }

    await recordAudit(
      auditRepository,
      access,
      ticket.propertyId,
      correlationId,
      "ticket.created",
      ticket.id,
      toJsonObject({
        ticketNumber: ticket.ticketNumber,
        status: ticket.status,
        priority: ticket.priority,
      }),
    );

    return ticket;
  });
}

export async function assignTicket(
  access: AccessProfile,
  rawInput: unknown,
  correlationId: string,
) {
  const input = parseOrThrow(assignTicketSchema.safeParse(rawInput));
  if (!input.assignedUserId && !input.assignedSupportTeamId) {
    throw new TicketServiceError("invalid", input.ticketId);
  }

  return database.$transaction(async (transaction) => {
    const repository = new TicketRepository(transaction);
    const auditRepository = new AuditEventRepository(transaction);
    const ticket = await repository.findTicket(input.ticketId, access.organizationId);
    if (!ticket) throw new TicketServiceError("not_found", input.ticketId);
    if (
      !canAssignTicket(subjectFromAccess(access), {
        organizationId: ticket.organizationId,
        propertyId: ticket.propertyId,
        requesterUserId: ticket.requesterUserId,
        departmentId: ticket.departmentId,
      })
    ) {
      throw new TicketServiceError("denied", input.ticketId);
    }

    if (input.assignedSupportTeamId) {
      const supportTeam = await repository.findSupportTeam(
        input.assignedSupportTeamId,
        access.organizationId,
      );
      if (!supportTeam || supportTeam.propertyId !== ticket.propertyId)
        throw new TicketServiceError("invalid", input.ticketId);
    }

    if (input.assignedUserId) {
      const user = await repository.findUser(input.assignedUserId, access.organizationId);
      if (!user) throw new TicketServiceError("invalid", input.ticketId);
      if (
        !(await repository.userHasPropertyRole(
          input.assignedUserId,
          access.organizationId,
          ticket.propertyId,
        ))
      )
        throw new TicketServiceError("invalid", input.ticketId);
    }

    const status =
      ticket.status === "new" || ticket.status === "triage" ? "assigned" : ticket.status;

    const updated = await repository.updateTicket(ticket.id, access.organizationId, {
      supportTeamId: input.assignedSupportTeamId,
      assigneeUserId: input.assignedUserId,
      status,
      assignedAt: new Date(),
    });

    await repository.createAssignment({
      organizationId: access.organizationId,
      ticketId: ticket.id,
      assignedByUserId: access.userId,
      assignedSupportTeamId: input.assignedSupportTeamId,
      assignedUserId: input.assignedUserId,
      note: input.note,
    });

    await repository.createActivity({
      organizationId: access.organizationId,
      ticketId: ticket.id,
      actorUserId: access.userId,
      activityType: "assignment_recorded",
      fromStatus: ticket.status,
      toStatus: status,
      requesterVisible: false,
      metadata: toJsonObject({
        assignedUserId: input.assignedUserId,
        assignedSupportTeamId: input.assignedSupportTeamId,
      }),
    });

    await recordAudit(
      auditRepository,
      access,
      ticket.propertyId,
      correlationId,
      "ticket.assigned",
      ticket.id,
      toJsonObject({
        assignedUserId: input.assignedUserId,
        assignedSupportTeamId: input.assignedSupportTeamId,
        status,
      }),
    );

    return updated;
  });
}

export async function addTicketComment(
  access: AccessProfile,
  rawInput: unknown,
  correlationId: string,
) {
  const input = parseOrThrow(commentSchema.safeParse(rawInput));

  return database.$transaction(async (transaction) => {
    const repository = new TicketRepository(transaction);
    const auditRepository = new AuditEventRepository(transaction);
    const ticket = await repository.findTicket(input.ticketId, access.organizationId);
    if (!ticket) throw new TicketServiceError("not_found", input.ticketId);

    const subject = subjectFromAccess(access);
    if (
      !canAddComment(
        subject,
        {
          organizationId: ticket.organizationId,
          propertyId: ticket.propertyId,
          requesterUserId: ticket.requesterUserId,
          departmentId: ticket.departmentId,
        },
        input.visibility,
      )
    ) {
      throw new TicketServiceError("denied", input.ticketId);
    }

    const comment = await repository.createComment({
      organizationId: access.organizationId,
      ticketId: ticket.id,
      authorUserId: access.userId,
      visibility: input.visibility,
      body: input.body,
    });

    await repository.createActivity({
      organizationId: access.organizationId,
      ticketId: ticket.id,
      actorUserId: access.userId,
      activityType: input.visibility === "internal" ? "internal_note_added" : "comment_added",
      requesterVisible: input.visibility === "requester",
      metadata: toJsonObject({
        commentId: comment.id,
        visibility: input.visibility,
      }),
    });

    await recordAudit(
      auditRepository,
      access,
      ticket.propertyId,
      correlationId,
      input.visibility === "internal" ? "ticket.note_added" : "ticket.comment_added",
      ticket.id,
      toJsonObject({
        commentId: comment.id,
        visibility: input.visibility,
      }),
    );

    return comment;
  });
}

export async function transitionTicket(
  access: AccessProfile,
  rawInput: unknown,
  correlationId: string,
) {
  const input = parseOrThrow(transitionSchema.safeParse(rawInput));

  return database.$transaction(async (transaction) => {
    const repository = new TicketRepository(transaction);
    const auditRepository = new AuditEventRepository(transaction);
    const ticket = await repository.findTicket(input.ticketId, access.organizationId);
    if (!ticket) throw new TicketServiceError("not_found", input.ticketId);

    if (
      !canMutateTicketStatus(subjectFromAccess(access), {
        organizationId: ticket.organizationId,
        propertyId: ticket.propertyId,
        requesterUserId: ticket.requesterUserId,
        departmentId: ticket.departmentId,
      })
    ) {
      throw new TicketServiceError("denied", input.ticketId);
    }

    const { update } = transitionUpdate(ticket.status as TicketStatus, input.toStatus, input, {
      supportTeamId: ticket.supportTeamId,
      assigneeUserId: ticket.assigneeUserId,
    });

    const updated = await repository.updateTicket(ticket.id, access.organizationId, update);

    await repository.createActivity({
      organizationId: access.organizationId,
      ticketId: ticket.id,
      actorUserId: access.userId,
      activityType: "status_changed",
      fromStatus: ticket.status,
      toStatus: input.toStatus,
      requesterVisible: transitionActivityVisible(input.toStatus),
      metadata: toJsonObject({
        resolutionCode: input.resolutionCode,
        hasClosureDetails: input.closureDetails ? true : undefined,
      }),
    });

    await recordAudit(
      auditRepository,
      access,
      ticket.propertyId,
      correlationId,
      "ticket.transitioned",
      ticket.id,
      toJsonObject({
        fromStatus: ticket.status,
        toStatus: input.toStatus,
        resolutionCode: input.resolutionCode,
      }),
    );

    return updated;
  });
}

export async function getTicketForAccess(access: AccessProfile, ticketId: string) {
  const repository = new TicketRepository(database);
  const ticket = await repository.findTicket(ticketId, access.organizationId);
  if (!ticket) return null;
  assertReadable(access, {
    organizationId: ticket.organizationId,
    propertyId: ticket.propertyId,
    requesterUserId: ticket.requesterUserId,
    departmentId: ticket.departmentId,
  });
  return ticket;
}

export function isRequesterVisibleComment(visibility: TicketCommentVisibility) {
  return visibility === "requester";
}
