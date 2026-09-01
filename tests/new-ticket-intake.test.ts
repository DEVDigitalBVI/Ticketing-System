import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/database/client", () => ({
  database: {},
}));

import type { AccessProfile } from "@/server/auth/access";
import { parseTicketSubmissionCookie, submitNewTicketRequest } from "@/server/tickets/intake";
import { TicketServiceError } from "@/server/tickets/service";

const requesterAccess: AccessProfile = {
  userId: "3ab44059-7981-4439-9e8b-a057eb1bba27",
  authUserId: "ee57e3d5-a1fd-4d8f-bd72-587d01be7464",
  email: "requester@example.invalid",
  displayName: "Requester",
  organizationId: "18b8d97e-9622-4ca7-b344-6230ad863e84",
  organizationName: "Peter Island Resort and Spa",
  properties: [{ id: "e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f", name: "Peter Island Resort and Spa" }],
  departmentIds: ["56b9da6f-ab84-48d1-8b88-c0dd55092b76"],
  roles: ["requester"],
  assuranceLevel: "aal1",
  mustChangePassword: false,
};

function createFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  const values = {
    summary: "Front desk printer stops after each page",
    details: "Printing guest folios fails after the first page and needs a restart.",
    propertyId: "e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f",
    serviceLocationId: "940549de-fdde-45e8-8138-f53f7737532c",
    departmentId: "56b9da6f-ab84-48d1-8b88-c0dd55092b76",
    categoryId: "8d59eaf4-47d0-4202-8f8c-61dd71cfb5ab",
    subcategoryId: "f8f0f8a6-4d6f-47d8-a1f6-c10b788eed37",
    impact: "high",
    urgency: "medium",
    ...overrides,
  };

  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

describe("new ticket intake", () => {
  it("creates a real ticket payload and returns a dedup cookie", async () => {
    const createTicketFn = vi.fn().mockResolvedValue({
      id: "0d6487a0-0b74-42e3-9ad0-47d357fd1741",
      ticketNumber: "PIR-001234",
    });

    const result = await submitNewTicketRequest(
      requesterAccess,
      createFormData(),
      "68b29177-c516-4af4-b72e-b072689fa1c8",
      undefined,
      { createTicketFn },
    );

    expect(result.kind).toBe("created");
    expect(result.ticketNumber).toBe("PIR-001234");
    expect(createTicketFn).toHaveBeenCalledWith(
      requesterAccess,
      expect.objectContaining({
        summary: "Front desk printer stops after each page",
        description: "Printing guest folios fails after the first page and needs a restart.",
        propertyId: "e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f",
        serviceLocationId: "940549de-fdde-45e8-8138-f53f7737532c",
        departmentId: "56b9da6f-ab84-48d1-8b88-c0dd55092b76",
        categoryId: "8d59eaf4-47d0-4202-8f8c-61dd71cfb5ab",
        subcategoryId: "f8f0f8a6-4d6f-47d8-a1f6-c10b788eed37",
        impact: "high",
        urgency: "medium",
        source: "portal",
      }),
      "68b29177-c516-4af4-b72e-b072689fa1c8",
    );

    expect(parseTicketSubmissionCookie(result.cookieValue)).toMatchObject({
      ticketId: "0d6487a0-0b74-42e3-9ad0-47d357fd1741",
      ticketNumber: "PIR-001234",
    });
  });

  it("rejects oversized or unsafe text before calling the ticket service", async () => {
    const createTicketFn = vi.fn();

    await expect(
      submitNewTicketRequest(
        requesterAccess,
        createFormData({ summary: "x".repeat(101), details: "Unsafe <script>" }),
        crypto.randomUUID(),
        undefined,
        { createTicketFn },
      ),
    ).rejects.toBeInstanceOf(TicketServiceError);

    expect(createTicketFn).not.toHaveBeenCalled();
  });

  it("rejects a tampered affected user outside the requester's authority", async () => {
    await expect(
      submitNewTicketRequest(
        requesterAccess,
        createFormData({ affectedUserId: "a279b968-e989-4bda-b7d3-c0a117f7c948" }),
        crypto.randomUUID(),
      ),
    ).rejects.toMatchObject({ code: "denied" });
  });

  it("treats an immediate identical resubmission as the same request", async () => {
    const now = new Date("2026-09-01T16:00:00.000Z");
    const createTicketFn = vi.fn().mockResolvedValue({
      id: "0d6487a0-0b74-42e3-9ad0-47d357fd1741",
      ticketNumber: "PIR-001234",
    });
    const first = await submitNewTicketRequest(
      requesterAccess,
      createFormData(),
      crypto.randomUUID(),
      undefined,
      { createTicketFn, now: () => now },
    );

    const secondCreateTicketFn = vi.fn();
    const getTicketForAccessFn = vi.fn().mockResolvedValue({
      id: "0d6487a0-0b74-42e3-9ad0-47d357fd1741",
      ticketNumber: "PIR-001234",
    });

    const second = await submitNewTicketRequest(
      requesterAccess,
      createFormData(),
      crypto.randomUUID(),
      first.cookieValue,
      {
        createTicketFn: secondCreateTicketFn,
        getTicketForAccessFn,
        now: () => new Date("2026-09-01T16:02:00.000Z"),
      },
    );

    expect(second.kind).toBe("duplicate");
    expect(second.ticketNumber).toBe("PIR-001234");
    expect(secondCreateTicketFn).not.toHaveBeenCalled();
    expect(getTicketForAccessFn).toHaveBeenCalledOnce();
  });
});
