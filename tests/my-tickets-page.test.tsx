import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/server/auth/authorization", () => ({
  requireCurrentAccess: vi.fn(async () => ({
    userId: "user-a",
    authUserId: "auth-a",
    email: "a@example.invalid",
    displayName: "Requester A",
    organizationId: "org-1",
    organizationName: "Peter Island Resort and Spa",
    properties: [{ id: "property-1", name: "Peter Island Resort and Spa" }],
    departmentIds: ["department-1"],
    roles: ["requester"],
    assuranceLevel: "aal1",
    mustChangePassword: false,
  })),
}));

vi.mock("@/server/tickets/requester-portal", () => ({
  listRequesterTicketWorkspace: vi.fn(async () => ({
    filter: "active",
    query: "",
    page: 1,
    pageSize: 10,
    totalPages: 1,
    counts: { active: 1, completed: 0, all: 1 },
    tickets: [
      {
        ticketId: "ticket-a1",
        id: "PIR-001001",
        type: "Printers",
        title: "Front desk printer offline",
        location: "Front Office",
        updated: "Sep 1, 2026",
        day: "01",
        month: "Sep",
        priority: "high",
        status: "Needs your reply",
        state: "active",
        canonicalStatus: "waiting_for_requester",
      },
    ],
    selectedTicket: {
      ticketId: "ticket-a1",
      ticketNumber: "PIR-001001",
      title: "Front desk printer offline",
      canonicalStatus: "waiting_for_requester",
      staffStatus: "Needs your reply",
      description: "Printer stops after each page.",
      property: "Peter Island Resort and Spa",
      location: "Front Office",
      department: "Front Office",
      category: "Printers",
      subcategory: "Paper jam",
      impact: "high",
      urgency: "medium",
      priority: "P2",
      resolutionSummary: null,
      closureDetails: null,
      canConfirmResolution: false,
      thread: [
        { id: "event-1", kind: "activity", title: "Request submitted", timestamp: "Sep 1, 2026" },
        {
          id: "event-2",
          kind: "comment",
          title: "Your reply",
          body: "The light is blinking red.",
          timestamp: "Sep 1, 2026",
        },
      ],
    },
  })),
}));

import MyTicketsPage from "@/app/(service-desk)/my-tickets/page";

describe("my tickets page", () => {
  it("renders authorized ticket data and the staff detail panel without internal content", async () => {
    render(
      await MyTicketsPage({
        searchParams: Promise.resolve({ ticket: "ticket-a1" }),
      }),
    );

    expect(screen.getByRole("heading", { name: "My tickets" })).toBeVisible();
    expect(screen.getByText("Front desk printer offline")).toBeVisible();
    expect(screen.getByText("Reply to IT")).toBeVisible();
    expect(screen.getByText("Internal status: waiting for requester")).toBeVisible();
    expect(screen.queryByText("Replace the formatter board.")).not.toBeInTheDocument();
  });
});
