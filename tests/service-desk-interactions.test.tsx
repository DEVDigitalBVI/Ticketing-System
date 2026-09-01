import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NewTicketForm } from "@/modules/service-desk/components/new-ticket-form";
import { TechnicianWorkspace } from "@/modules/service-desk/components/technician-workspace";
import { TicketFilters } from "@/modules/service-desk/components/ticket-filters";
import type { NewTicketFormOptions } from "@/server/tickets/intake";
import type { RequesterTicketWorkspace } from "@/server/tickets/requester-portal";

const options: NewTicketFormOptions = {
  properties: [{ id: "property-1", name: "Peter Island Resort and Spa" }],
  serviceLocations: [{ id: "location-1", propertyId: "property-1", name: "Front Office" }],
  departments: [{ id: "department-1", propertyId: "property-1", name: "Front Office" }],
  categories: [{ id: "category-1", name: "Printers" }],
  subcategories: [{ id: "subcategory-1", categoryId: "category-1", name: "Paper jam" }],
};

const workspace: RequesterTicketWorkspace = {
  filter: "active",
  query: "",
  page: 1,
  pageSize: 10,
  totalPages: 1,
  counts: { active: 0, completed: 0, all: 0 },
  tickets: [],
  selectedTicket: null,
};

describe("service desk interactions", () => {
  it("updates the ticket summary count and posts to the ticket submission route", () => {
    render(<NewTicketForm options={options} search={{}} />);
    const summary = screen.getByRole("textbox", { name: "Short summary" });
    fireEvent.change(summary, { target: { value: "Printer is offline" } });
    expect(screen.getByText("18 / 100")).toBeVisible();
    expect(summary.closest("form")).toHaveAttribute("action", "/auth/new-ticket");
    expect(screen.getByRole("combobox", { name: "Category" })).toHaveTextContent("Printers");
  });

  it("shows the real ticket number in the success treatment after submission", () => {
    render(
      <NewTicketForm options={options} search={{ status: "created", ticket: "PIR-001234" }} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Request received: PIR-001234");
    expect(screen.getByRole("status")).toHaveTextContent(
      "IT will review it next. You can follow updates from My tickets.",
    );
  });

  it("keeps empty ticket filters accessible without inventing request data", () => {
    render(<TicketFilters workspace={workspace} search={{}} />);
    expect(screen.getByText("No tickets yet")).toBeVisible();
    expect(screen.getByRole("tab", { name: /Completed\s*0/i })).toHaveAttribute(
      "href",
      "/my-tickets?filter=completed",
    );
    expect(screen.getByRole("searchbox", { name: "Search tickets" })).toHaveAttribute(
      "placeholder",
      "Search my tickets",
    );
  });

  it("renders an honest empty technician workspace", () => {
    render(<TechnicianWorkspace />);
    expect(screen.getByText("No tickets in the queue")).toBeVisible();
    const context = screen.getByRole("complementary", { name: "Selected ticket context" });
    expect(context).toHaveTextContent("No ticket selected");
    expect(screen.getAllByText("Ticket data not connected")).toHaveLength(4);
  });
});
