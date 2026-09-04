import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@/server/database/factory";
import {
  addTicketComment,
  assignTicket,
  createTicket,
  getTicketForAccess,
  transitionTicket,
} from "@/server/tickets/service";
import type { AccessProfile } from "@/server/auth/access";

const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) throw new Error("TEST_DATABASE_URL is required for database tests.");

const client = createDatabaseClient(connectionString);

const ids = {
  organization: "18b8d97e-9622-4ca7-b344-6230ad863e84",
  property: "ab9c2f07-e909-4f9d-9092-49ad4e06df1f",
  serviceLocation: "940549de-fdde-45e8-8138-f53f7737532c",
  department: "56b9da6f-ab84-48d1-8b88-c0dd55092b76",
  category: "8d59eaf4-47d0-4202-8f8c-61dd71cfb5ab",
  subcategory: "f8f0f8a6-4d6f-47d8-a1f6-c10b788eed37",
  supportTeam: "8d1a7cc7-fcf9-4535-b0bc-fbaad0327b73",
  requesterRoleKey: "requester",
  technicianRoleKey: "technician",
  adminRoleKey: "system_administrator",
  requesterUser: "9dce0d71-7c88-4351-bc43-b80d1f0edacf",
  affectedUser: "a279b968-e989-4bda-b7d3-c0a117f7c948",
  technicianUser: "78de96f4-076e-4101-8d2d-c27619af0b5c",
  adminUser: "993cecd5-6d34-4527-9186-81303fa14dc8",
};

function accessFor(userId: string, role: AccessProfile["roles"][number]): AccessProfile {
  return {
    userId,
    authUserId: crypto.randomUUID(),
    email: `${userId}@example.invalid`,
    displayName: role,
    organizationId: ids.organization,
    organizationName: "Peter Island Resort and Spa",
    properties: [{ id: ids.property, name: "Peter Island Resort and Spa" }],
    departmentIds: [ids.department],
    roles: [role],
    assuranceLevel: "aal2",
    mustChangePassword: false,
  };
}

const requesterAccess = accessFor(ids.requesterUser, "requester");
const technicianAccess = accessFor(ids.technicianUser, "technician");
const adminAccess = accessFor(ids.adminUser, "system_administrator");

beforeAll(async () => {
  await client.$connect();

  await client.user.createMany({
    data: [
      {
        id: ids.requesterUser,
        organizationId: ids.organization,
        email: "requester-ticket@example.invalid",
        displayName: "Requester Ticket User",
        mustChangePassword: false,
      },
      {
        id: ids.affectedUser,
        organizationId: ids.organization,
        email: "affected-ticket@example.invalid",
        displayName: "Affected Ticket User",
        mustChangePassword: false,
      },
      {
        id: ids.technicianUser,
        organizationId: ids.organization,
        email: "technician-ticket@example.invalid",
        displayName: "Technician Ticket User",
        mustChangePassword: false,
      },
      {
        id: ids.adminUser,
        organizationId: ids.organization,
        email: "admin-ticket@example.invalid",
        displayName: "Admin Ticket User",
        mustChangePassword: false,
      },
    ],
    skipDuplicates: true,
  });

  const roles = await client.role.findMany({
    where: {
      organizationId: ids.organization,
      key: { in: [ids.requesterRoleKey, ids.technicianRoleKey, ids.adminRoleKey] },
    },
  });
  const roleByKey = new Map(roles.map((role) => [role.key, role.id]));

  await client.userRole.createMany({
    data: [
      {
        organizationId: ids.organization,
        userId: ids.requesterUser,
        roleId: roleByKey.get(ids.requesterRoleKey)!,
        propertyId: ids.property,
      },
      {
        organizationId: ids.organization,
        userId: ids.technicianUser,
        roleId: roleByKey.get(ids.technicianRoleKey)!,
        propertyId: ids.property,
      },
      {
        organizationId: ids.organization,
        userId: ids.adminUser,
        roleId: roleByKey.get(ids.adminRoleKey)!,
        propertyId: ids.property,
      },
    ],
    skipDuplicates: true,
  });
});

afterAll(async () => {
  await client.$disconnect();
});

describe("Step 8 ticket domain", () => {
  it("creates tickets with a human-readable number and scoped links", async () => {
    const ticket = await createTicket(
      requesterAccess,
      {
        summary: "Guest laptop cannot connect",
        description: "A guest in Villa 101 cannot join the resort Wi-Fi after check-in.",
        affectedUserId: ids.affectedUser,
        propertyId: ids.property,
        serviceLocationId: ids.serviceLocation,
        departmentId: ids.department,
        categoryId: ids.category,
        subcategoryId: ids.subcategory,
        impact: "high",
        urgency: "high",
        source: "portal",
      },
      crypto.randomUUID(),
    );

    expect(ticket.ticketNumber).toMatch(/^PIR-\d{6,}$/);
    expect(ticket.priority).toBe("P1");
    expect(ticket.status).toBe("new");
  });

  it("rejects invalid direct constraint writes for status, assignment targets, and comment visibility", async () => {
    await expect(
      client.$executeRaw`
        insert into service_desk.tickets (
          organization_id, ticket_number, summary, description, requester_user_id, property_id,
          category_id, impact, urgency, priority, source, status
        ) values (
          ${ids.organization}::uuid, 'PIR-999999', 'Bad Ticket', 'Bad Ticket Description',
          ${ids.requesterUser}::uuid, ${ids.property}::uuid, ${ids.category}::uuid,
          'high', 'high', 'P1', 'portal', 'not_a_status'
        )
      `,
    ).rejects.toBeTruthy();

    const ticket = await client.ticket.findFirstOrThrow({
      where: { requesterUserId: ids.requesterUser },
      orderBy: { createdAt: "asc" },
    });

    await expect(
      client.$executeRaw`
        insert into service_desk.ticket_assignments (
          organization_id, ticket_id, assigned_by_user_id
        ) values (
          ${ids.organization}::uuid, ${ticket.id}::uuid, ${ids.adminUser}::uuid
        )
      `,
    ).rejects.toBeTruthy();

    await expect(
      client.$executeRaw`
        insert into service_desk.ticket_comments (
          organization_id, ticket_id, author_user_id, visibility, body
        ) values (
          ${ids.organization}::uuid, ${ticket.id}::uuid, ${ids.requesterUser}::uuid,
          'private_only', 'Bad visibility'
        )
      `,
    ).rejects.toBeTruthy();
  });

  it("enforces requester-visible versus internal comment permissions", async () => {
    const ticket = await client.ticket.findFirstOrThrow({
      where: { requesterUserId: ids.requesterUser },
      orderBy: { createdAt: "asc" },
    });

    await addTicketComment(
      requesterAccess,
      {
        ticketId: ticket.id,
        visibility: "requester",
        body: "The guest confirmed the issue continues after reboot.",
      },
      crypto.randomUUID(),
    );

    await expect(
      addTicketComment(
        requesterAccess,
        {
          ticketId: ticket.id,
          visibility: "internal",
          body: "This internal note should be rejected.",
        },
        crypto.randomUUID(),
      ),
    ).rejects.toMatchObject({ code: "denied" });

    await addTicketComment(
      technicianAccess,
      {
        ticketId: ticket.id,
        visibility: "internal",
        body: "Captured router logs and started client isolation checks.",
      },
      crypto.randomUUID(),
    );

    const comments = await client.ticketComment.findMany({
      where: { ticketId: ticket.id, organizationId: ids.organization },
      orderBy: { createdAt: "asc" },
    });

    expect(comments.map((comment) => comment.visibility)).toEqual(["requester", "internal"]);
  });

  it("records append-only assignment history and auto-advances a new ticket to assigned", async () => {
    const ticket = await createTicket(
      requesterAccess,
      {
        summary: "Front desk POS offline",
        description: "The terminal at arrivals is not processing card payments.",
        propertyId: ids.property,
        serviceLocationId: ids.serviceLocation,
        departmentId: ids.department,
        categoryId: ids.category,
        subcategoryId: ids.subcategory,
        impact: "high",
        urgency: "medium",
        source: "phone",
      },
      crypto.randomUUID(),
    );

    await assignTicket(
      technicianAccess,
      {
        ticketId: ticket.id,
        assignedSupportTeamId: ids.supportTeam,
        note: "Routing to core operations.",
      },
      crypto.randomUUID(),
    );

    await assignTicket(
      adminAccess,
      {
        ticketId: ticket.id,
        assignedUserId: ids.technicianUser,
        assignedSupportTeamId: ids.supportTeam,
        note: "Assigning the on-duty technician.",
      },
      crypto.randomUUID(),
    );

    const refreshed = await client.ticket.findUniqueOrThrow({
      where: { id_organizationId: { id: ticket.id, organizationId: ids.organization } },
    });
    const history = await client.ticketAssignment.findMany({
      where: { ticketId: ticket.id, organizationId: ids.organization },
      orderBy: { createdAt: "asc" },
    });

    expect(refreshed.status).toBe("assigned");
    expect(refreshed.assigneeUserId).toBe(ids.technicianUser);
    expect(history).toHaveLength(2);
    expect(history[0]?.assignedSupportTeamId).toBe(ids.supportTeam);
    expect(history[1]?.assignedUserId).toBe(ids.technicianUser);
  });

  it("supports create, triage, assign, progress, wait, resolve, reopen, and close while rejecting invalid transitions", async () => {
    const ticket = await createTicket(
      requesterAccess,
      {
        summary: "Conference display unavailable",
        description: "The ballroom display does not wake up before a guest presentation.",
        propertyId: ids.property,
        serviceLocationId: ids.serviceLocation,
        departmentId: ids.department,
        categoryId: "85d2eb57-2995-4831-9c71-840685618f98",
        subcategoryId: "c43455ef-c878-4450-b35b-61975c3c6eb7",
        impact: "medium",
        urgency: "medium",
        source: "walk_up",
      },
      crypto.randomUUID(),
    );

    await expect(
      transitionTicket(
        requesterAccess,
        {
          ticketId: ticket.id,
          toStatus: "resolved",
          resolutionCode: "resolved",
          resolutionSummary: "No.",
        },
        crypto.randomUUID(),
      ),
    ).rejects.toMatchObject({ code: "denied" });

    await transitionTicket(
      technicianAccess,
      { ticketId: ticket.id, toStatus: "triage" },
      crypto.randomUUID(),
    );

    await assignTicket(
      technicianAccess,
      {
        ticketId: ticket.id,
        assignedUserId: ids.technicianUser,
        assignedSupportTeamId: ids.supportTeam,
      },
      crypto.randomUUID(),
    );

    await transitionTicket(
      technicianAccess,
      { ticketId: ticket.id, toStatus: "in_progress" },
      crypto.randomUUID(),
    );
    await transitionTicket(
      technicianAccess,
      { ticketId: ticket.id, toStatus: "waiting_for_requester" },
      crypto.randomUUID(),
    );
    await transitionTicket(
      technicianAccess,
      { ticketId: ticket.id, toStatus: "in_progress" },
      crypto.randomUUID(),
    );
    await transitionTicket(
      technicianAccess,
      { ticketId: ticket.id, toStatus: "waiting_for_vendor" },
      crypto.randomUUID(),
    );
    await transitionTicket(
      technicianAccess,
      { ticketId: ticket.id, toStatus: "in_progress" },
      crypto.randomUUID(),
    );

    await expect(
      transitionTicket(
        technicianAccess,
        {
          ticketId: ticket.id,
          toStatus: "closed",
          closureDetails: "Skipping resolution is invalid.",
        },
        crypto.randomUUID(),
      ),
    ).rejects.toMatchObject({ code: "transition_invalid" });

    await transitionTicket(
      technicianAccess,
      {
        ticketId: ticket.id,
        toStatus: "resolved",
        resolutionCode: "resolved",
        resolutionSummary: "Replaced the faulty HDMI adapter and validated the display.",
      },
      crypto.randomUUID(),
    );

    await transitionTicket(
      technicianAccess,
      { ticketId: ticket.id, toStatus: "triage" },
      crypto.randomUUID(),
    );
    await transitionTicket(
      technicianAccess,
      { ticketId: ticket.id, toStatus: "assigned" },
      crypto.randomUUID(),
    );
    await transitionTicket(
      technicianAccess,
      { ticketId: ticket.id, toStatus: "in_progress" },
      crypto.randomUUID(),
    );
    await transitionTicket(
      technicianAccess,
      {
        ticketId: ticket.id,
        toStatus: "resolved",
        resolutionCode: "resolved",
        resolutionSummary: "Confirmed the replacement cable path is stable.",
      },
      crypto.randomUUID(),
    );
    await transitionTicket(
      technicianAccess,
      {
        ticketId: ticket.id,
        toStatus: "closed",
        closureDetails: "Requester confirmed service is restored.",
      },
      crypto.randomUUID(),
    );

    const refreshed = await client.ticket.findUniqueOrThrow({
      where: { id_organizationId: { id: ticket.id, organizationId: ids.organization } },
    });
    const activities = await client.ticketActivity.findMany({
      where: { ticketId: ticket.id, organizationId: ids.organization },
      orderBy: { createdAt: "asc" },
    });

    expect(refreshed.status).toBe("closed");
    expect(refreshed.resolutionCode).toBe("resolved");
    expect(refreshed.closedAt).not.toBeNull();
    expect(
      activities.some(
        (activity) => activity.fromStatus === "resolved" && activity.toStatus === "triage",
      ),
    ).toBe(true);
    expect(
      activities
        .filter((activity) => activity.activityType === "status_changed")
        .map((activity) => activity.toStatus),
    ).toEqual([
      "triage",
      "in_progress",
      "waiting_for_requester",
      "in_progress",
      "waiting_for_vendor",
      "in_progress",
      "resolved",
      "triage",
      "assigned",
      "in_progress",
      "resolved",
      "closed",
    ]);
  });

  it("uses optimistic concurrency checks for stale comments and transitions", async () => {
    const ticket = await createTicket(
      requesterAccess,
      {
        summary: "Poolside kiosk intermittently drops connections",
        description:
          "The public kiosk in front of the pool intermittently drops requests and loses session state.",
        propertyId: ids.property,
        serviceLocationId: ids.serviceLocation,
        departmentId: ids.department,
        categoryId: ids.category,
        subcategoryId: ids.subcategory,
        impact: "high",
        urgency: "high",
        source: "phone",
      },
      crypto.randomUUID(),
    );

    const staleUpdatedAt = ticket.updatedAt.toISOString();

    await assignTicket(
      technicianAccess,
      {
        ticketId: ticket.id,
        assignedUserId: ids.technicianUser,
        assignedSupportTeamId: ids.supportTeam,
      },
      crypto.randomUUID(),
    );

    await expect(
      addTicketComment(
        technicianAccess,
        {
          ticketId: ticket.id,
          visibility: "internal",
          body: "Attempted a reset of session state.",
          expectedUpdatedAt: staleUpdatedAt,
        },
        crypto.randomUUID(),
      ),
    ).rejects.toMatchObject({ code: "conflict" });

    await expect(
      transitionTicket(
        technicianAccess,
        {
          ticketId: ticket.id,
          toStatus: "triage",
          expectedUpdatedAt: staleUpdatedAt,
        },
        crypto.randomUUID(),
      ),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("requires both resolution code and meaningful summary before resolving", async () => {
    const ticket = await createTicket(
      requesterAccess,
      {
        summary: "Rooftop Wi-Fi SSID missing from kiosk",
        description:
          "Guest portal login fails intermittently; kiosk returns unauthorized after retry.",
        propertyId: ids.property,
        serviceLocationId: ids.serviceLocation,
        departmentId: ids.department,
        categoryId: "85d2eb57-2995-4831-9c71-840685618f98",
        subcategoryId: "c43455ef-c878-4450-b35b-61975c3c6eb7",
        impact: "medium",
        urgency: "medium",
        source: "walk_up",
      },
      crypto.randomUUID(),
    );

    await transitionTicket(
      technicianAccess,
      { ticketId: ticket.id, toStatus: "triage" },
      crypto.randomUUID(),
    );

    await assignTicket(
      technicianAccess,
      {
        ticketId: ticket.id,
        assignedUserId: ids.technicianUser,
        assignedSupportTeamId: ids.supportTeam,
      },
      crypto.randomUUID(),
    );

    await transitionTicket(
      technicianAccess,
      { ticketId: ticket.id, toStatus: "in_progress" },
      crypto.randomUUID(),
    );

    await expect(
      transitionTicket(
        technicianAccess,
        {
          ticketId: ticket.id,
          toStatus: "resolved",
          resolutionCode: "resolved",
        },
        crypto.randomUUID(),
      ),
    ).rejects.toMatchObject({ code: "resolution_required" });

    await expect(
      transitionTicket(
        technicianAccess,
        {
          ticketId: ticket.id,
          toStatus: "resolved",
          resolutionSummary: "Configured captive portal and restarted services.",
        },
        crypto.randomUUID(),
      ),
    ).rejects.toMatchObject({ code: "resolution_required" });

    const resolved = await transitionTicket(
      technicianAccess,
      {
        ticketId: ticket.id,
        toStatus: "resolved",
        resolutionCode: "resolved",
        resolutionSummary: "Reissued the captive portal profile and service restored.",
      },
      crypto.randomUUID(),
    );

    expect(resolved.status).toBe("resolved");
    expect(resolved.resolutionCode).toBe("resolved");
    expect(resolved.resolutionSummary).toBe(
      "Reissued the captive portal profile and service restored.",
    );
  });

  it("supports reopening closed tickets and clears closure metadata", async () => {
    const ticket = await createTicket(
      requesterAccess,
      {
        summary: "Spa thermostat stuck on high temperature",
        description:
          "The thermostat on the spa floor remains above threshold despite expected schedule.",
        propertyId: ids.property,
        serviceLocationId: ids.serviceLocation,
        departmentId: ids.department,
        categoryId: ids.category,
        subcategoryId: ids.subcategory,
        impact: "medium",
        urgency: "high",
        source: "system",
      },
      crypto.randomUUID(),
    );

    await transitionTicket(
      technicianAccess,
      { ticketId: ticket.id, toStatus: "triage" },
      crypto.randomUUID(),
    );
    await assignTicket(
      technicianAccess,
      {
        ticketId: ticket.id,
        assignedUserId: ids.technicianUser,
        assignedSupportTeamId: ids.supportTeam,
      },
      crypto.randomUUID(),
    );
    await transitionTicket(
      technicianAccess,
      { ticketId: ticket.id, toStatus: "in_progress" },
      crypto.randomUUID(),
    );
    await transitionTicket(
      technicianAccess,
      {
        ticketId: ticket.id,
        toStatus: "resolved",
        resolutionCode: "vendor_fix",
        resolutionSummary: "Updated room controller firmware and restarted thermostat service.",
      },
      crypto.randomUUID(),
    );
    const closed = await transitionTicket(
      technicianAccess,
      {
        ticketId: ticket.id,
        toStatus: "closed",
        closureDetails: "Requester confirmed temperature is stable.",
      },
      crypto.randomUUID(),
    );

    expect(closed.status).toBe("closed");
    expect(closed.closedAt).toBeTruthy();
    expect(closed.closureDetails).toBe("Requester confirmed temperature is stable.");

    const reopened = await transitionTicket(
      technicianAccess,
      { ticketId: ticket.id, toStatus: "triage" },
      crypto.randomUUID(),
    );

    expect(reopened.status).toBe("triage");
    expect(reopened.closedAt).toBeNull();
    expect(reopened.resolutionSummary).toBeNull();
    expect(reopened.resolutionCode).toBeNull();
    expect(reopened.closureDetails).toBeNull();
  });

  it("prevents requester users from closing tickets without queue permissions", async () => {
    const ticket = await createTicket(
      requesterAccess,
      {
        summary: "Lobby display reports low brightness",
        description: "Lobby monitor looks dim after recent firmware update.",
        propertyId: ids.property,
        serviceLocationId: ids.serviceLocation,
        departmentId: ids.department,
        categoryId: ids.category,
        subcategoryId: ids.subcategory,
        impact: "low",
        urgency: "low",
        source: "portal",
      },
      crypto.randomUUID(),
    );

    await transitionTicket(
      technicianAccess,
      { ticketId: ticket.id, toStatus: "triage" },
      crypto.randomUUID(),
    );
    await assignTicket(
      technicianAccess,
      {
        ticketId: ticket.id,
        assignedUserId: ids.technicianUser,
        assignedSupportTeamId: ids.supportTeam,
      },
      crypto.randomUUID(),
    );
    await transitionTicket(
      technicianAccess,
      { ticketId: ticket.id, toStatus: "in_progress" },
      crypto.randomUUID(),
    );
    await transitionTicket(
      technicianAccess,
      {
        ticketId: ticket.id,
        toStatus: "resolved",
        resolutionCode: "resolved",
        resolutionSummary: "Display contrast adjusted and firmware corrected.",
      },
      crypto.randomUUID(),
    );

    await expect(
      transitionTicket(
        requesterAccess,
        {
          ticketId: ticket.id,
          toStatus: "closed",
          closureDetails: "I would like to close this.",
        },
        crypto.randomUUID(),
      ),
    ).rejects.toMatchObject({ code: "denied" });
  });

  it("keeps append-only ticket history immutable", async () => {
    const comment = await client.ticketComment.findFirstOrThrow({
      where: { organizationId: ids.organization },
      orderBy: { createdAt: "asc" },
    });
    const assignment = await client.ticketAssignment.findFirstOrThrow({
      where: { organizationId: ids.organization },
      orderBy: { createdAt: "asc" },
    });
    const activity = await client.ticketActivity.findFirstOrThrow({
      where: { organizationId: ids.organization },
      orderBy: { createdAt: "asc" },
    });

    await expect(
      client.$executeRaw`update service_desk.ticket_comments set body = 'changed' where id = ${comment.id}::uuid`,
    ).rejects.toBeTruthy();
    await expect(
      client.$executeRaw`delete from service_desk.ticket_assignments where id = ${assignment.id}::uuid`,
    ).rejects.toBeTruthy();
    await expect(
      client.$executeRaw`update service_desk.ticket_activities set activity_type = 'changed' where id = ${activity.id}::uuid`,
    ).rejects.toBeTruthy();
  });

  it("writes activity and audit trail entries for state-changing ticket actions", async () => {
    const ticket = await createTicket(
      requesterAccess,
      {
        summary: "Elevator button panel is unresponsive",
        description: "All calls from the control panel are delayed by several minutes.",
        propertyId: ids.property,
        serviceLocationId: ids.serviceLocation,
        departmentId: ids.department,
        categoryId: ids.category,
        subcategoryId: ids.subcategory,
        impact: "high",
        urgency: "high",
        source: "walk_up",
      },
      crypto.randomUUID(),
    );

    await addTicketComment(
      requesterAccess,
      {
        ticketId: ticket.id,
        visibility: "requester",
        body: "No elevator panel tests have worked since shift change.",
      },
      crypto.randomUUID(),
    );

    await addTicketComment(
      technicianAccess,
      {
        ticketId: ticket.id,
        visibility: "internal",
        body: "Escalated to facilities and requesting hardware check.",
      },
      crypto.randomUUID(),
    );

    await transitionTicket(
      technicianAccess,
      { ticketId: ticket.id, toStatus: "triage" },
      crypto.randomUUID(),
    );
    await assignTicket(
      technicianAccess,
      {
        ticketId: ticket.id,
        assignedUserId: ids.technicianUser,
        assignedSupportTeamId: ids.supportTeam,
      },
      crypto.randomUUID(),
    );
    await transitionTicket(
      technicianAccess,
      {
        ticketId: ticket.id,
        toStatus: "in_progress",
      },
      crypto.randomUUID(),
    );
    const resolved = await transitionTicket(
      technicianAccess,
      {
        ticketId: ticket.id,
        toStatus: "resolved",
        resolutionCode: "vendor_fix",
        resolutionSummary: "Hardware inspection scheduled, and panel controls restored.",
      },
      crypto.randomUUID(),
    );

    const activityTypes = (
      await client.ticketActivity.findMany({
        where: { ticketId: ticket.id, organizationId: ids.organization },
        orderBy: { createdAt: "asc" },
      })
    ).map((activity) => activity.activityType);

    const auditActions = (
      await client.auditEvent.findMany({
        where: { entityId: ticket.id, organizationId: ids.organization },
        orderBy: { createdAt: "asc" },
      })
    ).map((event) => event.action);

    expect(resolved.status).toBe("resolved");
    expect(activityTypes).toContain("status_changed");
    expect(activityTypes).toContain("comment_added");
    expect(activityTypes).toContain("internal_note_added");
    expect(auditActions).toContain("ticket.comment_added");
    expect(auditActions).toContain("ticket.note_added");
    expect(auditActions).toContain("ticket.transitioned");
    expect(auditActions).toContain("ticket.assigned");
  });

  it("limits direct read access to the requester or queue staff through the service guard", async () => {
    const ticket = await client.ticket.findFirstOrThrow({
      where: { requesterUserId: ids.requesterUser },
      orderBy: { createdAt: "asc" },
    });

    const requesterView = await getTicketForAccess(requesterAccess, ticket.id);
    expect(requesterView?.id).toBe(ticket.id);

    await expect(
      getTicketForAccess(accessFor(ids.affectedUser, "requester"), ticket.id),
    ).rejects.toMatchObject({
      code: "denied",
    });
  });
});
