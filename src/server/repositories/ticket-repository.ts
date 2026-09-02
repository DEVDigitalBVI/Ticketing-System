import type { Prisma } from "@/generated/prisma/client";
import type { DatabaseClient } from "@/server/database/types";

export class TicketRepository {
  constructor(private readonly client: DatabaseClient) {}

  findUser(id: string, organizationId: string) {
    return this.client.user.findFirst({ where: { id, organizationId, isActive: true } });
  }

  findProperty(id: string, organizationId: string) {
    return this.client.property.findFirst({ where: { id, organizationId, isActive: true } });
  }

  findServiceLocation(id: string, organizationId: string) {
    return this.client.serviceLocation.findFirst({
      where: { id, organizationId, isActive: true },
    });
  }

  findDepartment(id: string, organizationId: string) {
    return this.client.department.findFirst({
      where: { id, organizationId, isActive: true },
    });
  }

  findCategory(id: string, organizationId: string) {
    return this.client.ticketCategory.findFirst({
      where: { id, organizationId, isActive: true },
    });
  }

  findSubcategory(id: string, organizationId: string) {
    return this.client.ticketSubcategory.findFirst({
      where: { id, organizationId, isActive: true },
    });
  }

  findSupportTeam(id: string, organizationId: string) {
    return this.client.supportTeam.findFirst({
      where: { id, organizationId, isActive: true },
    });
  }

  userHasPropertyRole(userId: string, organizationId: string, propertyId: string) {
    return this.client.userRole.count({
      where: { userId, organizationId, propertyId },
    });
  }

  findTicket(id: string, organizationId: string) {
    return this.client.ticket.findFirst({
      where: { id, organizationId },
      include: {
        requester: { select: { id: true, displayName: true } },
        affectedUser: { select: { id: true, displayName: true } },
        property: { select: { id: true, name: true, isActive: true } },
        serviceLocation: { select: { id: true, name: true, propertyId: true, isActive: true } },
        department: { select: { id: true, name: true, propertyId: true, isActive: true } },
        category: { select: { id: true, name: true, isActive: true } },
        subcategory: {
          select: { id: true, name: true, categoryId: true, isActive: true },
        },
        supportTeam: { select: { id: true, name: true, propertyId: true, isActive: true } },
        assignee: { select: { id: true, displayName: true, isActive: true } },
      },
    });
  }

  findActiveSlaPolicyForProperty(propertyId: string, organizationId: string) {
    return this.client.ticketSlaPolicy.findFirst({
      where: {
        organizationId,
        propertyId,
        isActive: true,
      },
      orderBy: { version: "desc" },
    });
  }

  createTicket(data: Prisma.TicketUncheckedCreateInput) {
    return this.client.ticket.create({ data });
  }

  updateTicket(id: string, organizationId: string, data: Prisma.TicketUncheckedUpdateInput) {
    return this.client.ticket.update({
      where: { id_organizationId: { id, organizationId } },
      data,
    });
  }

  async updateTicketIfCurrent(
    id: string,
    organizationId: string,
    expectedUpdatedAt: Date,
    data: Prisma.TicketUncheckedUpdateInput,
  ) {
    const result = await this.client.ticket.updateMany({
      where: { id, organizationId, updatedAt: expectedUpdatedAt },
      data,
    });
    if (result.count !== 1) return null;
    return this.findTicket(id, organizationId);
  }

  createActivity(data: Prisma.TicketActivityUncheckedCreateInput) {
    return this.client.ticketActivity.create({ data });
  }

  createComment(data: Prisma.TicketCommentUncheckedCreateInput) {
    return this.client.ticketComment.create({ data });
  }

  createAssignment(data: Prisma.TicketAssignmentUncheckedCreateInput) {
    return this.client.ticketAssignment.create({ data });
  }

  listAssignments(ticketId: string, organizationId: string) {
    return this.client.ticketAssignment.findMany({
      where: { ticketId, organizationId },
      orderBy: [{ createdAt: "asc" }],
    });
  }

  listComments(ticketId: string, organizationId: string) {
    return this.client.ticketComment.findMany({
      where: { ticketId, organizationId },
      orderBy: [{ createdAt: "asc" }],
    });
  }

  listActivities(ticketId: string, organizationId: string) {
    return this.client.ticketActivity.findMany({
      where: { ticketId, organizationId },
      orderBy: [{ createdAt: "asc" }],
    });
  }
}
