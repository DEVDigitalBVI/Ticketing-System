import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const accessProfile = {
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

vi.mock("@/server/auth/authorization", () => ({
  requireCurrentAccess: vi.fn(async () => accessProfile),
}));

vi.mock("@/server/database/errors", () => ({
  isDatabaseUnavailableError: vi.fn(
    (error: unknown) => error instanceof Error && error.message === "DB_DOWN",
  ),
}));

vi.mock("@/server/tickets/intake", () => ({
  listNewTicketFormOptions: vi.fn(async () => {
    throw new Error("DB_DOWN");
  }),
}));

vi.mock("@/server/tickets/requester-portal", () => ({
  listRequesterTicketWorkspace: vi.fn(async () => {
    throw new Error("DB_DOWN");
  }),
}));

vi.mock("@/server/tickets/technician-queue", () => ({
  listTechnicianWorkspace: vi.fn(async () => {
    throw new Error("DB_DOWN");
  }),
  TechnicianWorkspace: undefined,
}));

vi.mock("@/server/configuration/service", () => ({
  listConfigurationCatalog: vi.fn(async () => {
    throw new Error("DB_DOWN");
  }),
}));

vi.mock("@/server/audit/events", () => ({
  listAuditEvents: vi.fn(async () => {
    throw new Error("DB_DOWN");
  }),
}));

import NewTicketPage from "@/app/(service-desk)/new-ticket/page";
import MyTicketsPage from "@/app/(service-desk)/my-tickets/page";
import TechnicianPage from "@/app/(service-desk)/technician/page";
import ConfigurationPage from "@/app/admin/configuration/page";
import AuditPage from "@/app/admin/audit/page";

describe("page resilience during local database outages", () => {
  it("renders a controlled fallback on report an issue", async () => {
    render(await NewTicketPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Ticket submission is temporarily unavailable")).toBeVisible();
  });

  it("renders a controlled fallback on my tickets", async () => {
    render(await MyTicketsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Ticket data is temporarily unavailable")).toBeVisible();
  });

  it("renders a controlled fallback on technician workspace", async () => {
    render(await TechnicianPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByText("Queue data will appear here after ticket access is connected."),
    ).toBeVisible();
  });

  it("renders a controlled fallback on configuration", async () => {
    render(await ConfigurationPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Configuration could not be loaded")).toBeVisible();
  });

  it("renders a controlled fallback on audit trail", async () => {
    render(await AuditPage());

    expect(screen.getByText("Audit data is temporarily unavailable")).toBeVisible();
  });
});
