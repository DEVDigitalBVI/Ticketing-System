import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  finalize: vi.fn((response: Response) => response),
  createSupabaseRouteClient: vi.fn(),
  readCurrentAccess: vi.fn(),
  requestCorrelationId: () => "c7b3f56f-4a66-4f5d-ad1c-fd9090eb8b3d",
  addTicketComment: vi.fn(),
  assignTicket: vi.fn(),
  transitionTicket: vi.fn(),
  TicketServiceError: class TicketServiceError extends Error {
    constructor(public code: string) {
      super(code);
      this.name = "TicketServiceError";
    }
  },
}));

vi.mock("@/lib/supabase/route", () => ({
  createSupabaseRouteClient: mocks.createSupabaseRouteClient,
}));

vi.mock("@/server/auth/access", () => ({
  readCurrentAccess: mocks.readCurrentAccess,
}));

vi.mock("@/server/audit/correlation", () => ({
  requestCorrelationId: () => mocks.requestCorrelationId(),
}));

vi.mock("@/server/tickets/service", () => ({
  TicketServiceError: mocks.TicketServiceError,
  addTicketComment: mocks.addTicketComment,
  assignTicket: mocks.assignTicket,
  transitionTicket: mocks.transitionTicket,
}));

import { POST } from "@/app/auth/technician-ticket/route";
import { TicketServiceError } from "@/server/tickets/service";

const access = {
  userId: "3ab44059-7981-4439-9e8b-a057eb1bba27",
  authUserId: "ee57e3d5-a1fd-4d8f-bd72-587d01be7464",
  email: "technician@example.invalid",
  displayName: "Technician One",
  organizationId: "18b8d97e-9622-4ca7-b344-6230ad863e84",
  organizationName: "Peter Island Resort and Spa",
  properties: [{ id: "e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f", name: "Peter Island Resort and Spa" }],
  departmentIds: [],
  roles: ["technician"],
  assuranceLevel: "aal2" as const,
  mustChangePassword: false,
};

function buildRequest(form: FormData) {
  return new NextRequest("http://localhost:3000/auth/technician-ticket", {
    method: "POST",
    headers: { origin: "http://localhost:3000" },
    body: form,
  });
}

describe("technician ticket route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseRouteClient.mockReturnValue({
      supabase: {},
      finalize: mocks.finalize,
    });
    mocks.readCurrentAccess.mockResolvedValue(access);
  });

  it("adds a public reply and returns the commented state", async () => {
    mocks.addTicketComment.mockResolvedValue({});

    const form = new FormData();
    form.set("intent", "comment");
    form.set("ticketId", "d2dc3b89-9e11-42c7-b7a2-0f4e6e98b901");
    form.set("visibility", "requester");
    form.set("body", "Guest confirmed printer recovery attempt.");
    form.set("expectedUpdatedAt", "2026-09-01T13:00:00.000Z");
    form.set("filter", "my_work");
    form.set("page", "2");

    const response = await POST(buildRequest(form));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/technician?filter=my_work&page=2&ticket=d2dc3b89-9e11-42c7-b7a2-0f4e6e98b901&status=commented",
    );
    expect(mocks.addTicketComment).toHaveBeenCalledWith(
      access,
      {
        ticketId: "d2dc3b89-9e11-42c7-b7a2-0f4e6e98b901",
        visibility: "requester",
        body: "Guest confirmed printer recovery attempt.",
        expectedUpdatedAt: "2026-09-01T13:00:00.000Z",
      },
      "c7b3f56f-4a66-4f5d-ad1c-fd9090eb8b3d",
    );
  });

  it("adds an internal note and returns the noted state", async () => {
    mocks.addTicketComment.mockResolvedValue({});

    const form = new FormData();
    form.set("intent", "comment");
    form.set("ticketId", "d2dc3b89-9e11-42c7-b7a2-0f4e6e98b901");
    form.set("visibility", "internal");
    form.set("body", "Technician verified driver reset was needed.");
    form.set("expectedUpdatedAt", "2026-09-01T13:00:00.000Z");

    const response = await POST(buildRequest(form));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/technician?ticket=d2dc3b89-9e11-42c7-b7a2-0f4e6e98b901&status=noted",
    );
    expect(mocks.addTicketComment).toHaveBeenCalledWith(
      access,
      {
        ticketId: "d2dc3b89-9e11-42c7-b7a2-0f4e6e98b901",
        visibility: "internal",
        body: "Technician verified driver reset was needed.",
        expectedUpdatedAt: "2026-09-01T13:00:00.000Z",
      },
      "c7b3f56f-4a66-4f5d-ad1c-fd9090eb8b3d",
    );
  });

  it("applies a status transition and returns transitioned state", async () => {
    mocks.transitionTicket.mockResolvedValue({});

    const form = new FormData();
    form.set("intent", "transition");
    form.set("ticketId", "d2dc3b89-9e11-42c7-b7a2-0f4e6e98b901");
    form.set("toStatus", "resolved");
    form.set("expectedUpdatedAt", "2026-09-01T13:00:00.000Z");
    form.set("resolutionCode", "resolved");
    form.set("resolutionSummary", "Driver firmware updated and validated.");
    form.set("closureDetails", "");
    form.set("filter", "my_work");

    const response = await POST(buildRequest(form));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/technician?filter=my_work&ticket=d2dc3b89-9e11-42c7-b7a2-0f4e6e98b901&status=transitioned",
    );
    expect(mocks.transitionTicket).toHaveBeenCalledWith(
      access,
      {
        ticketId: "d2dc3b89-9e11-42c7-b7a2-0f4e6e98b901",
        expectedUpdatedAt: "2026-09-01T13:00:00.000Z",
        toStatus: "resolved",
        resolutionCode: "resolved",
        resolutionSummary: "Driver firmware updated and validated.",
        closureDetails: undefined,
      },
      "c7b3f56f-4a66-4f5d-ad1c-fd9090eb8b3d",
    );
  });

  it("maps stale-edit conflicts to the conflict status", async () => {
    mocks.transitionTicket.mockRejectedValue(new TicketServiceError("conflict"));

    const form = new FormData();
    form.set("intent", "transition");
    form.set("ticketId", "d2dc3b89-9e11-42c7-b7a2-0f4e6e98b901");
    form.set("toStatus", "in_progress");
    form.set("expectedUpdatedAt", "2026-09-01T12:55:00.000Z");

    const response = await POST(buildRequest(form));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/technician?ticket=d2dc3b89-9e11-42c7-b7a2-0f4e6e98b901&status=conflict",
    );
  });

  it("handles denied transitions as failed", async () => {
    mocks.transitionTicket.mockRejectedValue(new TicketServiceError("denied"));

    const form = new FormData();
    form.set("intent", "transition");
    form.set("ticketId", "d2dc3b89-9e11-42c7-b7a2-0f4e6e98b901");
    form.set("toStatus", "closed");
    form.set("expectedUpdatedAt", "2026-09-01T13:00:00.000Z");
    form.set("closureDetails", "Requester confirmed completion.");

    const response = await POST(buildRequest(form));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/technician?ticket=d2dc3b89-9e11-42c7-b7a2-0f4e6e98b901&status=failed",
    );
  });

  it("maps form validation errors to failed state", async () => {
    const form = new FormData();
    form.set("intent", "transition");
    form.set("ticketId", "not-a-uuid");

    const response = await POST(buildRequest(form));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/technician?ticket=not-a-uuid&status=failed",
    );
  });
});
