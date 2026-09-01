import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import LoginPage from "@/app/login/page";

describe("LoginPage", () => {
  it("renders an accessible work-account sign-in form", () => {
    render(<LoginPage />);

    expect(screen.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
    expect(screen.getByLabelText("Work email")).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  it("reveals the password only when requested", () => {
    render(<LoginPage />);

    const password = screen.getByLabelText("Password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("does not imply credentials were authenticated or persisted", () => {
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "staff@example.invalid" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "test-only-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Authentication is not connected yet. Your credentials were not sent or stored.",
    );
  });
});
