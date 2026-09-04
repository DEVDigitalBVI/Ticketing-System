import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ServiceDeskShell } from "@/modules/service-desk/components/service-desk-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/configuration" }));

describe("administrator navigation", () => {
  it("shows the configuration console for system administrators", () => {
    render(
      <ServiceDeskShell
        access={{
          userId: "d02ac995-a572-46ab-94a8-e9010a1d1398",
          authUserId: "3e01703f-9fef-42eb-b976-38e4679894b1",
          email: "admin@peterisland.net",
          displayName: "System Administrator",
          organizationId: "18b8d97e-9622-4ca7-b344-6230ad863e84",
          organizationName: "Peter Island Resort and Spa",
          properties: [
            { id: "e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f", name: "Peter Island Resort and Spa" },
          ],
          departmentIds: [],
          roles: ["system_administrator"],
          assuranceLevel: "aal2",
          mustChangePassword: false,
        }}
      >
        <div>Configuration content</div>
      </ServiceDeskShell>,
    );

    expect(screen.getByRole("link", { name: "Configuration" })).toHaveAttribute(
      "href",
      "/admin/configuration",
    );
    expect(screen.getByRole("link", { name: "Background jobs" })).toHaveAttribute(
      "href",
      "/admin/jobs",
    );
  });

  it("hides administration links from non-admin users", () => {
    render(
      <ServiceDeskShell
        access={{
          userId: "d02ac995-a572-46ab-94a8-e9010a1d1398",
          authUserId: "3e01703f-9fef-42eb-b976-38e4679894b1",
          email: "requester@peterisland.net",
          displayName: "Requester",
          organizationId: "18b8d97e-9622-4ca7-b344-6230ad863e84",
          organizationName: "Peter Island Resort and Spa",
          properties: [
            { id: "e5e40e2f-f7ab-4b65-83d9-6c6bd668ab9f", name: "Peter Island Resort and Spa" },
          ],
          departmentIds: [],
          roles: ["requester"],
          assuranceLevel: "aal1",
          mustChangePassword: false,
        }}
      >
        <div>Requester content</div>
      </ServiceDeskShell>,
    );

    expect(screen.queryByRole("link", { name: "User administration" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Configuration" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Audit trail" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Background jobs" })).not.toBeInTheDocument();
  });
});
