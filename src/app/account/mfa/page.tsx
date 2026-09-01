import { redirect } from "next/navigation";

import { MfaForm } from "@/modules/auth/components/mfa-form";
import { getCurrentAccess } from "@/server/auth/access";

function safePath(value?: string) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const access = await getCurrentAccess();
  if (!access) redirect("/login");
  if (access.mustChangePassword) redirect("/account/change-password");
  const { next } = await searchParams;
  return (
    <main id="main-content" className="auth-task-page">
      <section className="auth-task-card" aria-labelledby="mfa-title">
        <p className="overline">Security verification</p>
        <h1 id="mfa-title">Verify with your authenticator</h1>
        <p>Administrator actions require a fresh second factor.</p>
        <MfaForm nextPath={safePath(next)} />
      </section>
    </main>
  );
}
