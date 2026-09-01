import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  finalize: vi.fn((response: Response) => response),
  createSupabaseRouteClient: vi.fn(),
  readCurrentAccess: vi.fn(),
  accessCan: vi.fn(),
  submitNewTicketRequest: vi.fn(),
}));

vi.mock("@/lib/supabase/route", () => ({
  createSupabaseRouteClient: mocks.createSupabaseRouteClient,
}));

vi.mock("@/server/auth/access", () => ({
  readCurrentAccess: mocks.readCurrentAccess,
}));

vi.mock("@/server/auth/authorization", () => ({
  accessCan: mocks.accessCan,
}));

vi.mock("@/server/audit/correlation", () => ({
  requestCorrelationId: () => "c7b3f56f-4a66-4f5d-ad1c-fd9090eb8b3d",
}));

vi.mock("@/server/tickets/intake", () => ({
  submitNewTicketRequest: mocks.submitNewTicketRequest,
  ticketSubmissionCookieName: "ticket_intake_last_submission",
}));

vi.mock("@/server/tickets/service", () => ({
  TicketServiceError: class TicketServiceError extends Error {
    code: string;

    constructor(code: string) {
      super(code);
      this.code = code;
      this.name = "TicketServiceError";
    }
  },
}));

import { POST } from "@/app/auth/new-ticket/route";
import { TicketServiceError } from "@/server/tickets/service";

const access = {
  userId: "3ab44059-7981-4439-9e8b-a057eb1bba27",
  authUserId: "ee57e3d5-a1fd-4d8f-bd72-587d01be7464",
  email: "requester@example.invalid",
  displayName: "Requester",
  organizationId: "18b8d97e-9622-4ca7-b344-6230ad863e84",
  organizationName: "Peter Island Resort and Spa",
  properties: [{ id: "e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f", name: "Peter Island Resort and Spa" }],
  departmentIds: [],
  roles: ["requester"],
  assuranceLevel: "aal1" as const,
  mustChangePassword: false,
};

function buildRequest() {
  const body = new FormData();
  body.set("summary", "Front desk printer stops after each page");
  body.set("details", "Printing guest folios fails after the first page and needs a restart.");
  body.set("propertyId", "e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f");
  body.set("categoryId", "8d59eaf4-47d0-4202-8f8c-61dd71cfb5ab");
  body.set("impact", "high");
  body.set("urgency", "medium");

  return new NextRequest("http://localhost:3000/auth/new-ticket", {
    method: "POST",
    headers: { origin: "http://localhost:3000" },
    body,
  });
}

describe("new ticket route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseRouteClient.mockReturnValue({ supabase: {}, finalize: mocks.finalize });
    mocks.readCurrentAccess.mockResolvedValue(access);
    mocks.accessCan.mockReturnValue(true);
  });

  it("returns 403 when the signed-in user is not allowed to submit tickets", async () => {
    mocks.accessCan.mockReturnValue(false);

    const response = await POST(buildRequest());

    expect(response.status).toBe(403);
    expect(mocks.submitNewTicketRequest).not.toHaveBeenCalled();
  });

  it("redirects back with the real ticket number and sets the dedup cookie", async () => {
    mocks.submitNewTicketRequest.mockResolvedValue({
      kind: "created",
      ticketId: "0d6487a0-0b74-42e3-9ad0-47d357fd1741",
      ticketNumber: "PIR-001234",
      cookieValue: "encoded-cookie",
    });

    const response = await POST(buildRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/new-ticket?status=created&ticket=PIR-001234",
    );
    expect(response.cookies.get("ticket_intake_last_submission")?.value).toBe("encoded-cookie");
  });

  it("maps validation failures to the approved form error state", async () => {
    mocks.submitNewTicketRequest.mockRejectedValue(new TicketServiceError("invalid"));

    const response = await POST(buildRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/new-ticket?status=invalid",
    );
  });
});
