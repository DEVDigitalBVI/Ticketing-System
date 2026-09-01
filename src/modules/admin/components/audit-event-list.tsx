import type { AuditEventView } from "@/server/audit/events";

const auditEventTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Tortola",
});

function readableAction(action: string) {
  return action.replaceAll(/[._]/g, " ");
}

export function AuditEventList({ events }: { events: AuditEventView[] }) {
  if (!events.length)
    return (
      <section className="empty-state audit-empty-state" aria-live="polite">
        <strong>No audit events available</strong>
        <p>Security-sensitive and administrative activity will appear here.</p>
      </section>
    );

  return (
    <div className="audit-table-wrap">
      <table className="audit-table">
        <caption className="sr-only">Most recent security and administrative audit events</caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Actor</th>
            <th scope="col">Action</th>
            <th scope="col">Target</th>
            <th scope="col">Result</th>
            <th scope="col">Correlation ID</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td>
                <time dateTime={event.occurredAt}>
                  {auditEventTimeFormatter.format(new Date(event.occurredAt))}
                </time>
              </td>
              <td>{event.actor}</td>
              <td className="audit-action">{readableAction(event.action)}</td>
              <td>
                {event.targetType}
                {event.targetId ? <small>{event.targetId}</small> : null}
              </td>
              <td>
                <span className={`audit-result ${event.result}`}>{event.result}</span>
              </td>
              <td>
                <code className="correlation-id">{event.correlationId}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
