"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const next = searchParams.get("next") ?? "";

  return (
    <form className="login-form" action="/auth/login" method="post">
      <input type="hidden" name="next" value={next} />
      <div className="login-field">
        <label htmlFor="login-email">Work email</label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          placeholder="name@peterisland.com"
          required
        />
      </div>

      <div className="login-field">
        <div className="login-label-row">
          <label htmlFor="login-password">Password</label>
          <button
            className="password-toggle"
            type="button"
            aria-controls="login-password"
            aria-pressed={showPassword}
            onClick={() => setShowPassword((visible) => !visible)}
          >
            {showPassword ? "Hide password" : "Show password"}
          </button>
        </div>
        <input
          id="login-password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
        />
      </div>

      <button className="primary-button login-submit" type="submit">
        Sign in <span aria-hidden="true">→</span>
      </button>

      <p
        className={`login-form-status${error ? " is-visible" : ""}`}
        role="alert"
        aria-live="polite"
      >
        {error === "access"
          ? "Your account is not enabled for this service desk. Contact the IT team."
          : "The email or password was not accepted. Try again or contact the IT team."}
      </p>
    </form>
  );
}
