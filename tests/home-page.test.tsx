import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";

describe("HomePage", () => {
  it("renders the complete Peter Island foundation experience", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { level: 1, name: "Service Desk" })).toBeVisible();
    expect(screen.getByText("Quiet confidence, engineered in.")).toBeVisible();
    expect(screen.getByText("All calm on the digital shoreline.")).toBeVisible();
    expect(screen.getByText("Designed now. Expanded with purpose.")).toBeVisible();
    expect(screen.getByRole("link", { name: /view system health/i })).toHaveAttribute(
      "href",
      "/health",
    );
  });
});
