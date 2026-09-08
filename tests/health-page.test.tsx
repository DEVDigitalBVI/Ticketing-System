import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HealthPage from "@/app/health/page";

describe("HealthPage", () => {
  it("reports liveness without claiming dependency health", () => {
    render(<HealthPage />);

    expect(screen.getByRole("heading", { name: /the service desk is responding/i })).toBeVisible();
    expect(screen.getByText("Web process responding")).toBeVisible();
    expect(screen.getByText("Application shell")).toBeVisible();
    expect(screen.getByText(/this page confirms liveness only/i)).toBeVisible();
  });
});
