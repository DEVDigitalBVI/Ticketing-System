import type { Metadata } from "next";

import { ServiceDeskShell } from "@/modules/service-desk/components/service-desk-shell";
import { accessCan, requireCurrentAccess } from "@/server/auth/authorization";
import { isDatabaseUnavailableError } from "@/server/database/errors";
import { readJobOperations } from "@/server/jobs/operations";

export const metadata: Metadata = { title: "Background jobs" };

function utc(value: Date | null) {
  return value ? value.toISOString().replace("T", " ").replace(".000Z", " UTC") : "Not recorded";
}

export default async function BackgroundJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const access = await requireCurrentAccess("job.read");
  const search = await searchParams;
  let operations;

  try {
    operations = await readJobOperations(access, new Date());
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) throw error;
  }

  return (
    <ServiceDeskShell access={access}>
      <div className="page-shell job-operations-page">
        <header className="page-header narrow-header">
          <div>
            <p className="overline">Operations</p>
            <h1>Background jobs</h1>
            <p>Backlog health, failed work, and safe replay controls for this organisation.</p>
          </div>
        </header>

        {search.status === "replayed" ? (
          <p className="form-banner success" role="status">
            The failed job was queued for replay. Its existing effect key still prevents duplicate
            work.
          </p>
        ) : null}
        {search.status === "failed" ? (
          <p className="form-banner error" role="alert">
            The job could not be replayed. Refresh the page and confirm it is still failed.
          </p>
        ) : null}

        {operations ? (
          <>
            <section className="job-health-grid" aria-label="Background job health">
              <article className="job-health-card">
                <span>Events awaiting dispatch</span>
                <strong>{operations.pendingOutboxCount}</strong>
              </article>
              <article className="job-health-card">
                <span>Ready or delayed</span>
                <strong>{operations.counts.queued}</strong>
              </article>
              <article className="job-health-card">
                <span>Running</span>
                <strong>{operations.counts.running}</strong>
              </article>
              <article className="job-health-card">
                <span>Completed</span>
                <strong>{operations.counts.succeeded}</strong>
              </article>
              <article
                className={`job-health-card${operations.counts.deadLetter ? " is-danger" : ""}`}
              >
                <span>Needs attention</span>
                <strong>{operations.counts.deadLetter}</strong>
              </article>
            </section>
            <p className="job-backlog-note">
              Oldest undispatched event:{" "}
              {operations.oldestOutboxAt
                ? `${utc(operations.oldestOutboxAt)} (${operations.oldestOutboxAgeSeconds}s old)`
                : "No pending events"}
              . Oldest queued job:{" "}
              {operations.oldestQueuedAt
                ? `${utc(operations.oldestQueuedAt)} (${operations.oldestQueuedAgeSeconds}s old)`
                : "No queued work"}
              .
            </p>

            <section className="admin-card">
              <div className="admin-card-header">
                <div>
                  <h2>Failed jobs</h2>
                  <p>
                    Safe error summaries are shown here; payloads and credentials are never
                    displayed.
                  </p>
                </div>
              </div>
              {operations.failedJobs.length ? (
                <div className="audit-table-wrap">
                  <table className="audit-table job-table">
                    <thead>
                      <tr>
                        <th>Job</th>
                        <th>Attempts</th>
                        <th>Failure</th>
                        <th>Failed at</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {operations.failedJobs.map((job) => (
                        <tr key={job.id}>
                          <td>
                            <strong className="audit-action">{job.jobType}</strong>
                            <small>
                              {job.category} · {job.id}
                            </small>
                            <small>Correlation: {job.correlationId}</small>
                          </td>
                          <td>
                            {job.attempts} / {job.maxAttempts}
                          </td>
                          <td>
                            <span className="audit-result failure">
                              {job.lastErrorCode ?? "failed"}
                            </span>
                            <small>{job.lastErrorMessage ?? "No safe summary was recorded."}</small>
                          </td>
                          <td>
                            <time dateTime={job.deadLetteredAt?.toISOString()}>
                              {utc(job.deadLetteredAt)}
                            </time>
                          </td>
                          <td>
                            {accessCan(access, "job.replay") ? (
                              <form action="/auth/job" method="post">
                                <input type="hidden" name="jobId" value={job.id} />
                                <button className="ghost-button" type="submit">
                                  Replay
                                </button>
                              </form>
                            ) : (
                              <span className="muted-copy">Inspect only</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state job-empty-state">
                  <strong>No failed jobs</strong>
                  <p>
                    Jobs that exhaust their retry limit will remain here for inspection and replay.
                  </p>
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="empty-state audit-empty-state" aria-live="polite">
            <strong>Job data is temporarily unavailable</strong>
            <p>Restore the service database connection, then refresh this page.</p>
          </section>
        )}
      </div>
    </ServiceDeskShell>
  );
}
