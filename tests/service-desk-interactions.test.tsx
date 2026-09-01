import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NewTicketForm } from "@/modules/service-desk/components/new-ticket-form";
import { TechnicianWorkspace } from "@/modules/service-desk/components/technician-workspace";
import { TicketFilters } from "@/modules/service-desk/components/ticket-filters";

describe("service desk interactions", () => {
  it("updates the ticket summary count and provides local submission feedback", () => {
    render(<NewTicketForm />);
    const summary = screen.getByRole("textbox", { name: "Short summary" });
    fireEvent.change(summary, { target: { value: "Printer is offline" } });
    expect(screen.getByText("18 / 100")).toBeVisible();

    fireEvent.submit(summary.closest("form")!);
    expect(screen.getByRole("status")).toHaveTextContent("Request ready for review");
  });

  it("keeps empty ticket filters accessible without inventing request data", () => {
    render(<TicketFilters />);
    expect(screen.getByText("No tickets yet")).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: "Completed" }));
    expect(screen.getByText("No tickets yet")).toBeVisible();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search tickets" }), {
      target: { value: "printer" },
    });
    expect(screen.getByText("No tickets yet")).toBeVisible();
  });

  it("renders an honest empty technician workspace", () => {
    render(<TechnicianWorkspace />);
    expect(screen.getByText("No tickets in the queue")).toBeVisible();
    const context = screen.getByRole("complementary", { name: "Selected ticket context" });
    expect(context).toHaveTextContent("No ticket selected");
    expect(screen.getAllByText("Ticket data not connected")).toHaveLength(4);
  });
});
