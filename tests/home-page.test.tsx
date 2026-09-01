import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import HomePage from "@/app/(service-desk)/page";
import { ServiceDeskShell } from "@/modules/service-desk/components/service-desk-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

describe("staff overview", () => {
  it("renders the approved staff hierarchy and working client-side routes", () => {
    render(
      <ServiceDeskShell
        access={{
          userId: "d02ac995-a572-46ab-94a8-e9010a1d1398",
          authUserId: "3e01703f-9fef-42eb-b976-38e4679894b1",
          email: "staff@peterisland.net",
          displayName: "Resort Staff",
          organizationId: "18b8d97e-9622-4ca7-b344-6230ad863e84",
          organizationName: "Peter Island Resort and Spa",
          properties: [
            { id: "ab9c2f07-e909-4f9d-9092-49ad4e06df1f", name: "Peter Island Resort and Spa" },
          ],
          roles: ["staff"],
          assuranceLevel: "aal1",
          mustChangePassword: false,
        }}
      >
        <HomePage />
      </ServiceDeskShell>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "How can IT help keep your day moving?" }),
    ).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Report an issue" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Report an issue" })[0]).toHaveAttribute(
      "href",
      "/new-ticket",
    );
    expect(screen.getByRole("link", { name: "My tickets" })).toHaveAttribute("href", "/my-tickets");
    expect(screen.getByText("Active requests")).toBeVisible();
    expect(screen.getByText("No ticket data available")).toBeVisible();
    expect(screen.getByLabelText("Service monitoring is not connected")).toBeVisible();
    expect(screen.getByText("Resort Staff")).toBeVisible();
  });
});
