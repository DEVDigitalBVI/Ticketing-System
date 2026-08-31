import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HealthPage from "@/app/health/page";

describe("HealthPage", () => {
  it("reports that the application shell is operational", () => {
    render(<HealthPage />);

    expect(
      screen.getByRole("heading", { name: /all calm on the digital shoreline/i }),
    ).toBeVisible();
    expect(screen.getByText("Operational")).toBeVisible();
    expect(screen.getByText("Application shell")).toBeVisible();
    expect(screen.getByText(/external services are intentionally not queried/i)).toBeVisible();
  });
});
