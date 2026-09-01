import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import HomePage from "@/app/(service-desk)/page";
import { ServiceDeskShell } from "@/modules/service-desk/components/service-desk-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

describe("staff overview", () => {
  it("renders the approved staff hierarchy and working client-side routes", () => {
    render(
      <ServiceDeskShell>
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
    expect(screen.getAllByLabelText("Profile unavailable")).toHaveLength(2);
  });
});
