import { redirect } from "next/navigation";

import { getCurrentAccess } from "@/server/auth/access";

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const access = await getCurrentAccess();
  if (!access) redirect("/login");
  if (!access.mustChangePassword) redirect("/");
  const { error } = await searchParams;
  return (
    <main id="main-content" className="auth-task-page">
      <section className="auth-task-card" aria-labelledby="change-password-title">
        <p className="overline">Initial sign-in</p>
        <h1 id="change-password-title">Choose your permanent password</h1>
        <p>
          Your temporary password has done its job. Replace it before entering the service desk.
        </p>
        <form className="login-form" action="/auth/change-password" method="post">
          <div className="login-field">
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </div>
          <div className="login-field">
            <label htmlFor="confirm-password">Confirm new password</label>
            <input
              id="confirm-password"
              name="confirmation"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </div>
          <p className="password-guidance">
            Use at least 12 characters with uppercase, lowercase, a number, and a symbol.
          </p>
          <button className="primary-button login-submit" type="submit">
            Save password and continue
          </button>
          {error ? (
            <p className="form-error" role="alert">
              The password could not be updated. Check every requirement and try again.
            </p>
          ) : null}
        </form>
      </section>
    </main>
  );
}
