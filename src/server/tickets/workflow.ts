import { isAuthorized, type AuthorizationSubject } from "@/modules/auth/authorization";

export const ticketStatuses = [
  "new",
  "triage",
  "assigned",
  "in_progress",
  "waiting_for_requester",
  "waiting_for_vendor",
  "resolved",
  "closed",
  "cancelled",
] as const;

export type TicketStatus = (typeof ticketStatuses)[number];

export const ticketImpactValues = ["low", "medium", "high", "critical"] as const;
export type TicketImpact = (typeof ticketImpactValues)[number];

export const ticketUrgencyValues = ["low", "medium", "high", "critical"] as const;
export type TicketUrgency = (typeof ticketUrgencyValues)[number];

export const ticketPriorityValues = ["P1", "P2", "P3", "P4"] as const;
export type TicketPriority = (typeof ticketPriorityValues)[number];

export const ticketSourceValues = ["portal", "email", "phone", "walk_up", "system"] as const;
export type TicketSource = (typeof ticketSourceValues)[number];

export const ticketCommentVisibilityValues = ["requester", "internal"] as const;
export type TicketCommentVisibility = (typeof ticketCommentVisibilityValues)[number];

export const ticketResolutionCodeValues = [
  "resolved",
  "workaround",
  "vendor_fix",
  "duplicate",
  "no_issue_found",
  "request_fulfilled",
  "cancelled",
] as const;
export type TicketResolutionCode = (typeof ticketResolutionCodeValues)[number];

export const validTicketTransitions: Record<TicketStatus, readonly TicketStatus[]> = {
  new: ["triage", "cancelled"],
  triage: ["assigned", "cancelled"],
  assigned: ["triage", "in_progress", "cancelled"],
  in_progress: ["assigned", "waiting_for_requester", "waiting_for_vendor", "resolved", "cancelled"],
  waiting_for_requester: ["in_progress", "resolved", "cancelled"],
  waiting_for_vendor: ["in_progress", "resolved", "cancelled"],
  resolved: ["closed", "triage", "assigned", "in_progress"],
  closed: ["triage"],
  cancelled: ["triage"],
};

export type TicketAccessResource = {
  organizationId: string;
  propertyId: string;
  requesterUserId: string;
  affectedUserId?: string | null;
  departmentId?: string | null;
};

export function canTransitionStatus(from: TicketStatus, to: TicketStatus) {
  return validTicketTransitions[from].includes(to);
}

export function calculatePriorityPlaceholder(
  impact: TicketImpact,
  urgency: TicketUrgency,
): TicketPriority {
  const score =
    { low: 1, medium: 2, high: 3, critical: 4 }[impact] +
    { low: 1, medium: 2, high: 3, critical: 4 }[urgency];

  if (score >= 7) return "P1";
  if (score >= 5) return "P2";
  if (score >= 3) return "P3";
  return "P4";
}

export function canReadTicket(subject: AuthorizationSubject, ticket: TicketAccessResource) {
  return (
    isAuthorized(subject, "ticket.queue.read", {
      organizationId: ticket.organizationId,
      propertyId: ticket.propertyId,
      departmentId: ticket.departmentId ?? undefined,
    }) ||
    isAuthorized(subject, "ticket.read.own", {
      organizationId: ticket.organizationId,
      propertyId: ticket.propertyId,
      departmentId: ticket.departmentId ?? undefined,
      ownerUserId: ticket.requesterUserId,
    }) ||
    (!!ticket.affectedUserId &&
      isAuthorized(subject, "ticket.read.own", {
        organizationId: ticket.organizationId,
        propertyId: ticket.propertyId,
        departmentId: ticket.departmentId ?? undefined,
        ownerUserId: ticket.affectedUserId,
      }))
  );
}

export function canAddComment(
  subject: AuthorizationSubject,
  ticket: TicketAccessResource,
  visibility: TicketCommentVisibility,
) {
  if (visibility === "internal") {
    return isAuthorized(subject, "ticket.note.internal", {
      organizationId: ticket.organizationId,
      propertyId: ticket.propertyId,
      departmentId: ticket.departmentId ?? undefined,
    });
  }

  return canReadTicket(subject, ticket);
}

export function canAssignTicket(subject: AuthorizationSubject, ticket: TicketAccessResource) {
  return isAuthorized(subject, "ticket.assign", {
    organizationId: ticket.organizationId,
    propertyId: ticket.propertyId,
    departmentId: ticket.departmentId ?? undefined,
  });
}

export function canMutateTicketStatus(subject: AuthorizationSubject, ticket: TicketAccessResource) {
  return isAuthorized(subject, "ticket.transition", {
    organizationId: ticket.organizationId,
    propertyId: ticket.propertyId,
    departmentId: ticket.departmentId ?? undefined,
  });
}
