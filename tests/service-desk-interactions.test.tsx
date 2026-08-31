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

  it("filters tickets using accessible tabs and search", () => {
    render(<TicketFilters />);
    fireEvent.click(screen.getByRole("tab", { name: "Completed" }));
    expect(screen.getByText("No matching tickets")).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: "All" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search tickets" }), {
      target: { value: "Wi-Fi" },
    });
    expect(screen.getByText("Weak Wi-Fi signal in the west lobby")).toBeVisible();
    expect(screen.queryByText("Front desk printer stops after each page")).not.toBeInTheDocument();
  });

  it("updates the technician detail context when a queue row is selected", () => {
    render(<TechnicianWorkspace />);
    fireEvent.click(screen.getByRole("row", { name: /front desk printer stops/i }));
    const context = screen.getByRole("complementary", { name: "Selected ticket context" });
    expect(context).toHaveTextContent("PRN-FRO-02");
    expect(context).toHaveTextContent(/Level\.io device/i);
  });

  it("opens a deep-linked mock ticket as the initial technician context", () => {
    render(<TechnicianWorkspace initialTicketId="INC-1048" />);
    const context = screen.getByRole("complementary", { name: "Selected ticket context" });
    expect(context).toHaveTextContent("Front desk printer stops after each page");
    expect(context).toHaveTextContent("PRN-FRO-02");
  });
});
