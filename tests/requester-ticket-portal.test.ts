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

type TicketRecord = {
  id: string;
  organizationId: string;
  propertyId: string;
  requesterUserId: string;
  affectedUserId: string | null;
  departmentId: string | null;
  ticketNumber: string;
  summary: string;
  description: string;
  impact: string;
  urgency: string;
  priority: string;
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
  resolutionSummary: string | null;
  closureDetails: string | null;
  createdAt: Date;
  updatedAt: Date;
  property: { name: string };
  serviceLocation: { name: string } | null;
  department: { name: string } | null;
  category: { name: string };
  subcategory: { name: string } | null;
  comments: Array<{
    id: string;
    authorUserId: string | null;
    body: string;
    visibility: string;
    createdAt: Date;
  }>;
  activities: Array<{
    id: string;
    createdAt: Date;
    activityType: string;
    toStatus: string | null;
    requesterVisible: boolean;
  }>;
};

type TransactionShape = {
  ticket: {
    update: (input: {
      where: { id_organizationId: { id: string; organizationId: string } };
      data: { status: TicketRecord["status"]; closedAt: Date; closureDetails: string };
    }) => Promise<TicketRecord>;
  };
  ticketActivity: {
    create: (input: {
      data: {
        ticketId: string;
        activityType: string;
        toStatus: string | null;
        requesterVisible: boolean;
      };
    }) => Promise<void>;
  };
};

function matchesClause(ticket: TicketRecord, clause: Record<string, unknown>): boolean {
  if ("organizationId" in clause && clause.organizationId !== ticket.organizationId) return false;
  if ("id" in clause && clause.id !== ticket.id) return false;

  if ("propertyId" in clause) {
    const propertyClause = clause.propertyId as { in?: string[] } | string;
    if (typeof propertyClause === "string" && propertyClause !== ticket.propertyId) return false;
    if (
      typeof propertyClause === "object" &&
      propertyClause?.in &&
      !propertyClause.in.includes(ticket.propertyId)
    )
      return false;
  }

  if ("requesterUserId" in clause && clause.requesterUserId !== ticket.requesterUserId)
    return false;
  if ("affectedUserId" in clause && clause.affectedUserId !== ticket.affectedUserId) return false;

  if ("status" in clause) {
    const statusClause = clause.status as { in?: string[] };
    if (statusClause?.in && !statusClause.in.includes(ticket.status)) return false;
  }

  if ("ticketNumber" in clause) {
    const value = String((clause.ticketNumber as { contains: string }).contains).toLowerCase();
    if (!ticket.ticketNumber.toLowerCase().includes(value)) return false;
  }

  if ("summary" in clause) {
    const value = String((clause.summary as { contains: string }).contains).toLowerCase();
    if (!ticket.summary.toLowerCase().includes(value)) return false;
  }

  if ("description" in clause) {
    const value = String((clause.description as { contains: string }).contains).toLowerCase();
    if (!ticket.description.toLowerCase().includes(value)) return false;
  }

  if ("resolutionSummary" in clause) {
    const value = String((clause.resolutionSummary as { contains: string }).contains).toLowerCase();
    if (!(ticket.resolutionSummary ?? "").toLowerCase().includes(value)) return false;
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

let tickets: TicketRecord[] = [];

vi.mock("@/server/database/client", () => ({
  database: {
    ticket: {
      count: vi.fn(
        async ({ where }: { where: Record<string, unknown> }) =>
          tickets.filter((ticket) => matchesClause(ticket, where)).length,
      ),
      findMany: vi.fn(
        async ({
          where,
          skip = 0,
          take = 10,
        }: {
          where: Record<string, unknown>;
          skip?: number;
          take?: number;
        }) =>
          tickets
            .filter((ticket) => matchesClause(ticket, where))
            .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
            .slice(skip, skip + take),
      ),
      findFirst: vi.fn(
        async ({
          where,
          include,
          select,
        }: {
          where: Record<string, unknown>;
          include?: {
            comments?: { where?: { visibility?: string } };
            activities?: { where?: { requesterVisible?: boolean } };
          };
          select?: Record<string, boolean>;
        }) => {
          const ticket = tickets.find((entry) => matchesClause(entry, where)) ?? null;
          if (!ticket) return null;

          if (select) {
            return Object.fromEntries(
              Object.entries(select)
                .filter(([, enabled]) => enabled)
                .map(([key]) => [key, ticket[key as keyof TicketRecord]]),
            );
          }

          return {
            ...ticket,
            comments: include?.comments?.where?.visibility
              ? ticket.comments.filter(
                  (comment) => comment.visibility === include.comments?.where?.visibility,
                )
              : ticket.comments,
            activities:
              typeof include?.activities?.where?.requesterVisible === "boolean"
                ? ticket.activities.filter(
                    (activity) =>
                      activity.requesterVisible === include.activities?.where?.requesterVisible,
                  )
                : ticket.activities,
          };
        },
      ),
    },
    $transaction: vi.fn(async (callback: (transaction: TransactionShape) => Promise<unknown>) =>
      callback({
        ticket: {
          update: async ({
            where,
            data,
          }: {
            where: { id_organizationId: { id: string; organizationId: string } };
            data: { status: TicketRecord["status"]; closedAt: Date; closureDetails: string };
          }) => {
            const ticket = tickets.find(
              (entry) =>
                entry.id === where.id_organizationId.id &&
                entry.organizationId === where.id_organizationId.organizationId,
            );
            if (!ticket) throw new Error("missing ticket");
            ticket.status = data.status;
            ticket.updatedAt = data.closedAt;
            ticket.closureDetails = data.closureDetails;
            return ticket;
          },
        },
        ticketActivity: {
          create: async ({
            data,
          }: {
            data: {
              ticketId: string;
              activityType: string;
              toStatus: string | null;
              requesterVisible: boolean;
            };
          }) => {
            const ticket = tickets.find((entry) => entry.id === data.ticketId);
            ticket?.activities.push({
              id: `activity-${ticket?.activities.length ?? 0}`,
              createdAt: new Date(),
              activityType: data.activityType,
              toStatus: data.toStatus,
              requesterVisible: data.requesterVisible,
            });
          },
        },
      }),
    ),
  },
}));

vi.mock("@/server/tickets/service", async () => {
  const actual = await vi.importActual<typeof import("@/server/tickets/service")>(
    "@/server/tickets/service",
  );
  return {
    ...actual,
    addTicketComment: vi.fn(async (_access, input) => ({
      id: "comment-added",
      ticketId: input.ticketId,
      body: input.body,
      visibility: input.visibility,
    })),
  };
});

import {
  addRequesterVisibleReply,
  confirmRequesterTicketResolution,
  getRequesterTicketDetail,
  listRequesterTicketWorkspace,
} from "@/server/tickets/requester-portal";
import type { AccessProfile } from "@/server/auth/access";
import { addTicketComment, TicketServiceError } from "@/server/tickets/service";

const requesterA: AccessProfile = {
  userId: "user-a",
  authUserId: "auth-a",
  email: "a@example.invalid",
  displayName: "Requester A",
  organizationId: "org-1",
  organizationName: "Peter Island Resort and Spa",
  properties: [{ id: "property-1", name: "Peter Island Resort and Spa" }],
  departmentIds: ["department-1"],
  roles: ["requester"],
  assuranceLevel: "aal1" as const,
  mustChangePassword: false,
};

const requesterB: AccessProfile = {
  ...requesterA,
  userId: "user-b",
  authUserId: "auth-b",
  email: "b@example.invalid",
  displayName: "Requester B",
};

beforeEach(() => {
  recordedAudits.length = 0;
  tickets = [
    {
      id: "ticket-a1",
      organizationId: "org-1",
      propertyId: "property-1",
      requesterUserId: "user-a",
      affectedUserId: null,
      departmentId: "department-1",
      ticketNumber: "PIR-001001",
      summary: "Front desk printer offline",
      description: "Printer stops after each page.",
      impact: "high",
      urgency: "medium",
      priority: "P2",
      status: "waiting_for_requester",
      resolutionSummary: null,
      closureDetails: null,
      createdAt: new Date("2026-09-01T10:00:00.000Z"),
      updatedAt: new Date("2026-09-01T11:00:00.000Z"),
      property: { name: "Peter Island Resort and Spa" },
      serviceLocation: { name: "Front Office" },
      department: { name: "Front Office" },
      category: { name: "Printers" },
      subcategory: { name: "Paper jam" },
      comments: [
        {
          id: "public-comment",
          authorUserId: "tech-1",
          body: "Please confirm whether the light is blinking.",
          visibility: "requester",
          createdAt: new Date("2026-09-01T10:30:00.000Z"),
        },
        {
          id: "internal-comment",
          authorUserId: "tech-1",
          body: "Replace the formatter board.",
          visibility: "internal",
          createdAt: new Date("2026-09-01T10:35:00.000Z"),
        },
      ],
      activities: [
        {
          id: "created-a1",
          createdAt: new Date("2026-09-01T10:00:00.000Z"),
          activityType: "ticket_created",
          toStatus: "new",
          requesterVisible: true,
        },
        {
          id: "assign-a1",
          createdAt: new Date("2026-09-01T10:10:00.000Z"),
          activityType: "assignment_recorded",
          toStatus: "assigned",
          requesterVisible: false,
        },
        {
          id: "wait-a1",
          createdAt: new Date("2026-09-01T11:00:00.000Z"),
          activityType: "status_changed",
          toStatus: "waiting_for_requester",
          requesterVisible: true,
        },
      ],
    },
    {
      id: "ticket-a2",
      organizationId: "org-1",
      propertyId: "property-1",
      requesterUserId: "user-b",
      affectedUserId: "user-a",
      departmentId: "department-1",
      ticketNumber: "PIR-001002",
      summary: "Conference display unavailable",
      description: "Display does not wake up.",
      impact: "medium",
      urgency: "medium",
      priority: "P3",
      status: "resolved",
      resolutionSummary: "Replaced the HDMI adapter.",
      closureDetails: null,
      createdAt: new Date("2026-09-01T09:00:00.000Z"),
      updatedAt: new Date("2026-09-01T12:00:00.000Z"),
      property: { name: "Peter Island Resort and Spa" },
      serviceLocation: { name: "Ballroom" },
      department: { name: "Events" },
      category: { name: "Audio Visual" },
      subcategory: { name: "Displays" },
      comments: [],
      activities: [
        {
          id: "created-a2",
          createdAt: new Date("2026-09-01T09:00:00.000Z"),
          activityType: "ticket_created",
          toStatus: "new",
          requesterVisible: true,
        },
        {
          id: "resolved-a2",
          createdAt: new Date("2026-09-01T12:00:00.000Z"),
          activityType: "status_changed",
          toStatus: "resolved",
          requesterVisible: true,
        },
      ],
    },
    {
      id: "ticket-b1",
      organizationId: "org-1",
      propertyId: "property-1",
      requesterUserId: "user-b",
      affectedUserId: null,
      departmentId: "department-1",
      ticketNumber: "PIR-001003",
      summary: "Reservations laptop locked out",
      description: "Cannot sign in.",
      impact: "high",
      urgency: "high",
      priority: "P1",
      status: "closed",
      resolutionSummary: "Password reset completed.",
      closureDetails: "Requester confirmed service is restored.",
      createdAt: new Date("2026-08-30T09:00:00.000Z"),
      updatedAt: new Date("2026-08-30T11:00:00.000Z"),
      property: { name: "Peter Island Resort and Spa" },
      serviceLocation: { name: "Reservations" },
      department: { name: "Reservations" },
      category: { name: "Accounts and Access" },
      subcategory: { name: "Password reset" },
      comments: [],
      activities: [],
    },
  ];
});

describe("requester ticket portal", () => {
  it("shows only the requester's own or affected-user tickets with correct filters and pagination", async () => {
    for (let index = 4; index <= 14; index += 1) {
      tickets.push({
        ...tickets[0],
        id: `ticket-extra-${index}`,
        ticketNumber: `PIR-0010${index}`,
        summary: `Extra ticket ${index}`,
        status: "new",
        updatedAt: new Date(`2026-09-01T0${(index % 9) + 1}:00:00.000Z`),
        comments: [],
        activities: [],
      });
    }

    const active = await listRequesterTicketWorkspace(requesterA, { filter: "active", page: "1" });
    expect(active.counts.active).toBe(13);
    expect(active.counts.completed).toBe(0);
    expect(active.counts.all).toBe(13);
    expect(active.tickets).toHaveLength(10);
    expect(active.tickets.every((ticket) => ticket.id !== "PIR-001003")).toBe(true);

    const completed = await listRequesterTicketWorkspace(requesterA, { filter: "completed" });
    expect(completed.tickets).toHaveLength(0);

    const secondPage = await listRequesterTicketWorkspace(requesterA, {
      filter: "active",
      page: "2",
    });
    expect(secondPage.page).toBe(2);
    expect(secondPage.tickets).toHaveLength(3);
  });

  it("supports search without exposing another requester's ticket", async () => {
    const search = await listRequesterTicketWorkspace(requesterA, {
      filter: "all",
      q: "Reservations",
    });

    expect(search.counts.all).toBe(0);
    expect(search.tickets).toHaveLength(0);
  });

  it("keeps requester workspaces isolated across two staff accounts", async () => {
    const requesterAView = await listRequesterTicketWorkspace(requesterA, { filter: "all" });
    const requesterBView = await listRequesterTicketWorkspace(requesterB, { filter: "all" });

    expect(requesterAView.tickets.map((ticket) => ticket.id)).toEqual(["PIR-001002", "PIR-001001"]);
    expect(requesterBView.tickets.map((ticket) => ticket.id)).toEqual(["PIR-001002", "PIR-001003"]);
  });

  it("returns detail with only requester-visible comments and public activity", async () => {
    const detail = await getRequesterTicketDetail(requesterA, "ticket-a1");

    expect(detail?.thread.map((entry) => entry.title)).toEqual([
      "Request submitted",
      "IT reply",
      "IT needs more information from you",
    ]);
    expect(detail?.thread.some((entry) => entry.body?.includes("formatter board"))).toBe(false);
  });

  it("does not return another requester's ticket through a direct id lookup", async () => {
    const detail = await getRequesterTicketDetail(requesterA, "ticket-b1");
    expect(detail).toBeNull();
  });

  it("delegates requester-visible replies through the existing comment service", async () => {
    await addRequesterVisibleReply(
      requesterA,
      "ticket-a1",
      "The light is blinking red now.",
      "corr-1",
    );

    expect(addTicketComment).toHaveBeenCalledWith(
      requesterA,
      expect.objectContaining({
        ticketId: "ticket-a1",
        visibility: "requester",
        body: "The light is blinking red now.",
      }),
      "corr-1",
    );
  });

  it("allows a requester to confirm a resolved ticket they can access", async () => {
    const updated = await confirmRequesterTicketResolution(requesterA, "ticket-a2", "corr-2");

    expect(updated.status).toBe("closed");
    expect(tickets.find((ticket) => ticket.id === "ticket-a2")?.status).toBe("closed");
    expect(recordedAudits).toHaveLength(1);
  });

  it("rejects confirmation for another requester's ticket", async () => {
    await expect(
      confirmRequesterTicketResolution(requesterA, "ticket-b1", "corr-3"),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects confirmation unless the ticket is resolved", async () => {
    await expect(
      confirmRequesterTicketResolution(requesterA, "ticket-a1", "corr-4"),
    ).rejects.toBeInstanceOf(TicketServiceError);
  });
});
