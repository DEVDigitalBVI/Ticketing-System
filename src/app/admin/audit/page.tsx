import type { Metadata } from "next";

import { AuditEventList } from "@/modules/admin/components/audit-event-list";
import { ServiceDeskShell } from "@/modules/service-desk/components/service-desk-shell";
import { requireCurrentAccess } from "@/server/auth/authorization";
import { isDatabaseUnavailableError } from "@/server/database/errors";
import { listAuditEvents } from "@/server/audit/events";

export const metadata: Metadata = { title: "Audit trail" };

export default async function AuditPage() {
  const access = await requireCurrentAccess("audit.read");
  let events;

  try {
    events = await listAuditEvents();
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) throw error;
  }

  return (
    <ServiceDeskShell access={access}>
      <div className="page-shell audit-page">
        <header className="page-header narrow-header">
          <div>
            <p className="overline">Access administration</p>
            <h1>Audit trail</h1>
            <p>Recent security-sensitive and administrative activity for this organisation.</p>
          </div>
        </header>
        {events ? (
          <AuditEventList events={events} />
        ) : (
          <section className="empty-state audit-empty-state" aria-live="polite">
            <strong>Audit data is temporarily unavailable</strong>
            <p>Restore the local service database connection, then refresh this page.</p>
          </section>
        )}
      </div>
    </ServiceDeskShell>
  );
}
