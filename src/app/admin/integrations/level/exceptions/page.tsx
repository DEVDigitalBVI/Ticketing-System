import type { Metadata } from "next";
import Link from "next/link";

import { ServiceDeskShell } from "@/modules/service-desk/components/service-desk-shell";
import { requireCurrentAccess } from "@/server/auth/authorization";
import { readLevelAlertExceptions } from "@/server/integrations/level/alert-administration";

export const metadata: Metadata = { title: "Level alert exceptions" };

function timestamp(value: Date | null | undefined) {
  return value ? value.toISOString().replace("T", " ").replace(".000Z", " UTC") : "Not reported";
}

export default async function LevelAlertExceptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const access = await requireCurrentAccess("configuration.manage");
  const [items, search] = await Promise.all([readLevelAlertExceptions(access), searchParams]);
  const openCount = items.filter((item) => item.exceptionState === "open").length;
  return (
    <ServiceDeskShell access={access}>
      <div className="page-shell alert-automation-page">
        <header className="page-header narrow-header">
          <div>
            <p className="overline">Level automation</p>
            <h1>Alert exception queue</h1>
            <p>
              Investigate events that could not be mapped safely. Nothing here creates a ticket
              automatically.
            </p>
          </div>
          <div className="header-actions">
            <Link className="ghost-button" href="/admin/integrations/level/alert-rules">
              Alert rules
            </Link>
            <Link className="ghost-button" href="/admin/integrations/level">
              Reconciliation
            </Link>
          </div>
        </header>
        {search.status === "saved" ? (
          <p className="form-banner success">Exception state updated.</p>
        ) : null}
        {search.status === "failed" ? (
          <p className="form-banner error">The exception could not be updated.</p>
        ) : null}
        <section className="job-health-grid" aria-label="Exception health">
          <article className={`job-health-card${openCount ? " is-danger" : ""}`}>
            <span>Open exceptions</span>
            <strong>{openCount}</strong>
          </article>
          <article className="job-health-card">
            <span>Reviewed</span>
            <strong>{items.length - openCount}</strong>
          </article>
        </section>
        <section className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2>Decision evidence</h2>
              <p>
                Every exception retains a plain-language reason and the minimum provider identifiers
                needed to reconcile it.
              </p>
            </div>
          </div>
          {items.length ? (
            <div className="audit-table-wrap">
              <table className="audit-table job-table">
                <thead>
                  <tr>
                    <th>Alert event</th>
                    <th>Why it stopped</th>
                    <th>State</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>
                          {item.receipt?.alertName ?? item.receipt?.eventType ?? "Alert event"}
                        </strong>
                        <small>Alert: {item.receipt?.alertId ?? "Not available"}</small>
                        <small>Device: {item.receipt?.alertDeviceId ?? "Not available"}</small>
                        <small>{timestamp(item.receipt?.occurredAt)}</small>
                      </td>
                      <td>
                        <strong>{item.reasonCode.replaceAll("_", " ")}</strong>
                        <small>{item.explanation}</small>
                      </td>
                      <td>
                        <span
                          className={`audit-result ${item.exceptionState === "open" ? "failure" : "success"}`}
                        >
                          {item.exceptionState}
                        </span>
                      </td>
                      <td>
                        {item.exceptionState === "open" ? (
                          <form
                            action="/auth/level-alert-exception"
                            method="post"
                            className="exception-actions"
                          >
                            <input type="hidden" name="decisionId" value={item.id} />
                            <button className="ghost-button" name="state" value="resolved">
                              Resolve
                            </button>
                            <button className="text-button" name="state" value="ignored">
                              Ignore
                            </button>
                          </form>
                        ) : (
                          <span className="muted-copy">Reviewed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state job-empty-state">
              <strong>No alert exceptions</strong>
              <p>All received alerts have a safe create-or-ignore decision.</p>
            </div>
          )}
        </section>
      </div>
    </ServiceDeskShell>
  );
}
