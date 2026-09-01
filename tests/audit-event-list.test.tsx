import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuditEventList } from "@/modules/admin/components/audit-event-list";

describe("administrator audit view", () => {
  it("renders safe audit fields without exposing provider payloads", () => {
    render(
      <AuditEventList
        events={[
          {
            id: "36fcc041-5996-44f6-9b3b-bc47ce39d01b",
            actor: "System Administrator",
            action: "user.created",
            targetType: "user",
            targetId: "2fc5ee2d-9831-41b7-adde-1cf91423462a",
            result: "success",
            correlationId: "3232c12a-5b94-46b4-b01e-5ae6afea55b6",
            context: { role: "requester" },
            occurredAt: "2026-08-31T18:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByRole("table", { name: /audit events/i })).toBeVisible();
    expect(screen.getByText("user created")).toBeVisible();
    expect(screen.getByText("System Administrator")).toBeVisible();
    expect(screen.getByText("success")).toBeVisible();
    expect(screen.queryByText(/password|token|payload/i)).not.toBeInTheDocument();
  });

  it("renders the approved empty state", () => {
    render(<AuditEventList events={[]} />);
    expect(screen.getByText("No audit events available")).toBeVisible();
  });
});
