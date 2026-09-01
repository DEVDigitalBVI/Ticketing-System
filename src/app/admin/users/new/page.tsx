import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentAccess } from "@/server/auth/access";

export default async function NewUserPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const access = await getCurrentAccess();
  if (!access) redirect("/login");
  if (access.mustChangePassword) redirect("/account/change-password");
  if (!access.roles.includes("admin")) redirect("/");
  if (access.assuranceLevel !== "aal2") redirect("/account/mfa?next=/admin/users/new");
  const { status } = await searchParams;
  return (
    <main id="main-content" className="auth-task-page">
      <section className="auth-task-card wide" aria-labelledby="new-user-title">
        <p className="overline">Access administration</p>
        <h1 id="new-user-title">Create a service desk user</h1>
        <p>
          A temporary password and sign-in instructions will be sent through the configured SMTP
          forwarder.
        </p>
        <form className="login-form" action="/auth/admin-create-user" method="post">
          <div className="login-field">
            <label htmlFor="display-name">Full name</label>
            <input id="display-name" name="displayName" autoComplete="name" required />
          </div>
          <div className="login-field">
            <label htmlFor="user-email">Work email</label>
            <input id="user-email" name="email" type="email" autoComplete="off" required />
          </div>
          <div className="login-field">
            <label htmlFor="property">Property</label>
            <select id="property" name="propertyId" required>
              {access.properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </div>
          <div className="login-field">
            <label htmlFor="role">Access role</label>
            <select id="role" name="role" defaultValue="staff">
              <option value="staff">Staff</option>
              <option value="technician">Technician</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          <button className="primary-button login-submit" type="submit">
            Create user and send email
          </button>
          {status === "sent" ? (
            <p className="form-success" role="status">
              The account was created and the temporary credentials were sent.
            </p>
          ) : null}
          {status && status !== "sent" ? (
            <p className="form-error" role="alert">
              The account could not be created. No usable partial account was retained.
            </p>
          ) : null}
        </form>
        <Link className="text-link" href="/">
          Return to service desk
        </Link>
      </section>
    </main>
  );
}
