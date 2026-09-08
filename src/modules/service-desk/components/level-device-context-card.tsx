import type { LevelDeviceContext } from "@/server/integrations/level/device-context";

function dateTime(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Tortola",
      }).format(value)
    : "Not reported";
}

function onlineLabel(value: boolean | null) {
  if (value === true) return "Online";
  if (value === false) return "Offline";
  return "Unknown";
}

export function LevelDeviceContextCard({ context }: { context: LevelDeviceContext }) {
  const badge = context.stale
    ? "Stale snapshot"
    : context.state === "degraded"
      ? "Degraded"
      : onlineLabel(context.online);
  return (
    <section
      className={`device-card level-context ${context.state}`}
      aria-labelledby="level-context-title"
    >
      <div className="device-heading">
        <span>
          <small>LEVEL.IO DEVICE CONTEXT</small>
          <strong id="level-context-title">{context.deviceName ?? "Device context"}</strong>
        </span>
        <span className="online-badge">{badge}</span>
      </div>
      <p className="level-health-summary">{context.healthSummary}</p>
      {context.message ? (
        <p className="level-context-notice" role="status">
          {context.message}
        </p>
      ) : null}
      {context.deviceId ? (
        <dl className="level-context-grid">
          <div>
            <dt>Operating system</dt>
            <dd>{context.operatingSystem ?? "Not reported"}</dd>
          </div>
          <div>
            <dt>Agent state</dt>
            <dd>{onlineLabel(context.online)}</dd>
          </div>
          <div>
            <dt>Last seen</dt>
            <dd>{dateTime(context.lastSeenAt)}</dd>
          </div>
          <div>
            <dt>Group</dt>
            <dd>{context.group ?? "Not synchronized"}</dd>
          </div>
          <div>
            <dt>Selected alerts</dt>
            <dd>
              {context.selectedAlerts.length
                ? context.selectedAlerts.join(", ")
                : "Not synchronized"}
            </dd>
          </div>
          <div>
            <dt>Last successful sync</dt>
            <dd>{dateTime(context.lastSuccessfulSyncAt)}</dd>
          </div>
        </dl>
      ) : null}
      {context.deviceId ? (
        <p className="level-device-id">
          <span>Level device ID</span>
          <code>{context.deviceId}</code>
        </p>
      ) : null}
      {context.deepLink ? (
        <a className="secondary-button" href={context.deepLink} rel="noreferrer">
          Open in Level.io
        </a>
      ) : null}
    </section>
  );
}
