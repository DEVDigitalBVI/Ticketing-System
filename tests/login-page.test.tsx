import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import LoginPage from "@/app/login/page";

describe("LoginPage", () => {
  it("renders an accessible work-account sign-in form", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
    expect(screen.getByLabelText("Work email")).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign in" }).closest("form")).toHaveAttribute(
      "action",
      "/auth/login",
    );
  });

  it("reveals the password only when requested", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    const password = screen.getByLabelText("Password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("renders a generic credential error without disclosing account state", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({ error: "credentials" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("The email or password was not accepted");
  });
});
