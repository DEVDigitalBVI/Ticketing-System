import type { Metadata } from "next";
import Link from "next/link";

import { ServiceDeskShell } from "@/modules/service-desk/components/service-desk-shell";
import { accessCan, requireCurrentAccess } from "@/server/auth/authorization";
import { isDatabaseUnavailableError } from "@/server/database/errors";
import { readOperationalOverview } from "@/server/observability/operations";

export const metadata: Metadata = { title: "Operations" };

function timestamp(value: Date) {
  return value.toISOString().replace("T", " ").replace(".000Z", " UTC");
}

export default async function OperationsPage() {
  const access = await requireCurrentAccess("job.read");
  let overview: Awaited<ReturnType<typeof readOperationalOverview>> | undefined;
  try {
    overview = await readOperationalOverview(access, new Date());
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) throw error;
  }

  return (
    <ServiceDeskShell access={access}>
      <div className="page-shell operations-page">
        <header className="page-header narrow-header">
          <div>
            <p className="overline">IT operations</p>
            <h1>Service health</h1>
            <p>One view of worker, provider, delivery, webhook, and SLA processing health.</p>
          </div>
          {overview ? (
            <span className={`operations-state is-${overview.overall}`}>
              <span aria-hidden="true" />
              {overview.overall}
            </span>
          ) : null}
        </header>

        {overview ? (
          <>
            <p className="operations-observed">
              Observed {timestamp(overview.observedAt)}. Times and thresholds use UTC.
            </p>
            <section className="operations-signal-grid" aria-label="Operational health signals">
              {overview.signals.map((signal) => (
                <article className={`operations-signal is-${signal.state}`} key={signal.key}>
                  <div>
                    <span className="signal-dot" aria-hidden="true" />
                    <span>{signal.state}</span>
                  </div>
                  <h2>{signal.label}</h2>
                  <p>{signal.summary}</p>
                </article>
              ))}
            </section>

            <section className="operations-links" aria-label="Failure management">
              <Link href="/admin/jobs">
                <strong>Failed jobs</strong>
                <span>Inspect dead letters and replay safely</span>
              </Link>
              {accessCan(access, "configuration.manage") ? (
                <>
                  <Link href="/admin/integrations/level/exceptions">
                    <strong>Webhook exceptions</strong>
                    <span>Review malformed and unmatched alerts</span>
                  </Link>
                  <Link href="/admin/integrations/level">
                    <strong>Sync reconciliation</strong>
                    <span>{overview.reconciliationCount} device records need review</span>
                  </Link>
                </>
              ) : null}
            </section>

            <section className="admin-card">
              <div className="admin-card-header">
                <div>
                  <h2>Delivery and application failures</h2>
                  <p>
                    Safe diagnostics only. Secrets, personal data, payloads, and private comments
                    are excluded.
                  </p>
                </div>
              </div>
              {overview.failures.length ? (
                <div className="audit-table-wrap">
                  <table className="audit-table job-table">
                    <thead>
                      <tr>
                        <th>Failure</th>
                        <th>Severity</th>
                        <th>Occurred</th>
                        <th>Correlation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.failures.map((failure) => (
                        <tr key={failure.id}>
                          <td>
                            <strong>{failure.eventType.replaceAll("_", " ")}</strong>
                            <small>
                              {failure.component} · {failure.errorCode ?? "operation_failed"}
                            </small>
                          </td>
                          <td>
                            <span
                              className={`audit-result ${failure.severity === "error" || failure.severity === "critical" ? "failure" : "denied"}`}
                            >
                              {failure.severity}
                            </span>
                          </td>
                          <td>{timestamp(failure.occurredAt)}</td>
                          <td>
                            <code className="correlation-id">{failure.correlationId}</code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state job-empty-state">
                  <strong>No unresolved application failures</strong>
                  <p>New failures will appear here with a correlation ID and safe error code.</p>
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="empty-state audit-empty-state" role="alert">
            <strong>Operational data is unavailable</strong>
            <p>
              The web process is responding, but the service database could not be reached. Follow
              the database readiness procedure in the runbook.
            </p>
          </section>
        )}
      </div>
    </ServiceDeskShell>
  );
}
