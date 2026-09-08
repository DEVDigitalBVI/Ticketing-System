import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({
  ticket: { findFirst: vi.fn(), update: vi.fn() },
  user: { findFirst: vi.fn() },
  userRole: { count: vi.fn() },
  ticketComment: { create: vi.fn() },
  ticketActivity: { create: vi.fn() },
  ticketAssignment: { create: vi.fn() },
  auditEvent: { create: vi.fn() },
}));
vi.mock("@/server/database/client", () => ({
  database: { ...db, $transaction: async (callback: (tx: typeof db) => unknown) => callback(db) },
}));
import { addTicketComment, assignTicket } from "@/server/tickets/service";
import type { AccessProfile } from "@/server/auth/access";
const ticketId = "11111111-1111-4111-8111-111111111111";
const propertyId = "22222222-2222-4222-8222-222222222222";
const assigneeId = "33333333-3333-4333-8333-333333333333";
const access: AccessProfile = {
  userId: "affected",
  authUserId: "auth",
  email: "a@example.invalid",
  displayName: "Affected user",
  organizationId: "org",
  organizationName: "Resort",
  properties: [{ id: propertyId, name: "Resort" }],
  roles: ["requester"],
  roleAssignments: [{ propertyId, role: "requester" }],
  departmentIds: [],
  assuranceLevel: "aal1",
  mustChangePassword: false,
};
beforeEach(() => {
  vi.resetAllMocks();
  db.ticket.findFirst.mockResolvedValue({
    id: ticketId,
    organizationId: "org",
    propertyId,
    requesterUserId: "requester",
    affectedUserId: "affected",
    departmentId: null,
    status: "new",
    updatedAt: new Date(),
  });
  db.ticket.update.mockResolvedValue({ id: ticketId });
  db.ticketComment.create.mockResolvedValue({ id: "comment" });
  db.user.findFirst.mockResolvedValue({ id: assigneeId });
});
it("lets the affected requester post a public reply through the actual comment service", async () => {
  await addTicketComment(
    access,
    { ticketId, visibility: "requester", body: "Here is the information" },
    "correlation",
  );
  expect(db.ticketComment.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ authorUserId: "affected", visibility: "requester" }),
    }),
  );
});
it("still denies internal notes and unrelated users", async () => {
  await expect(
    addTicketComment(
      access,
      { ticketId, visibility: "internal", body: "Private note" },
      "correlation",
    ),
  ).rejects.toMatchObject({ code: "denied" });
  await expect(
    addTicketComment(
      { ...access, userId: "unrelated" },
      { ticketId, visibility: "requester", body: "Public reply" },
      "correlation",
    ),
  ).rejects.toMatchObject({ code: "denied" });
  expect(db.ticketComment.create).not.toHaveBeenCalled();
});
it.each(["requester", "report_viewer", "technician", "it_manager", "system_administrator"])(
  "validates the assignee's %s role in the target property",
  async (targetRole) => {
    db.userRole.count.mockImplementation(async ({ where }) =>
      where.propertyId === propertyId && where.role.key.in.includes(targetRole) ? 1 : 0,
    );
    const actor: AccessProfile = {
      ...access,
      roles: ["technician"],
      roleAssignments: [{ propertyId, role: "technician" }],
    };
    const operation = assignTicket(actor, { ticketId, assignedUserId: assigneeId }, "correlation");
    if (["requester", "report_viewer"].includes(targetRole)) {
      await expect(operation).rejects.toMatchObject({ code: "invalid" });
      expect(db.ticket.update).not.toHaveBeenCalled();
    } else {
      await expect(operation).resolves.toEqual({ id: ticketId });
      expect(db.ticketAssignment.create).toHaveBeenCalled();
    }
  },
);
