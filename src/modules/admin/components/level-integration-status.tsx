import type { getLevelConfigurationStatus } from "@/server/integrations/level/configuration";

type LevelStatus = ReturnType<typeof getLevelConfigurationStatus>;

const checkMessages: Record<string, { tone: "success" | "error"; text: string }> = {
  healthy: {
    tone: "success",
    text: "Read-only access succeeded. Level returned a valid device-list response.",
  },
  authentication_failed: {
    tone: "error",
    text: "Level rejected the configured API key. Replace or reactivate the server-side key.",
  },
  permission_denied: {
    tone: "error",
    text: "The configured key cannot read devices. Confirm its tenant and read-only access.",
  },
  throttled: {
    tone: "error",
    text: "Level throttled the check after bounded retries. Try again after its retry window.",
  },
  timeout: {
    tone: "error",
    text: "Level did not respond within the configured timeout after bounded retries.",
  },
  malformed_response: {
    tone: "error",
    text: "Level responded, but the response did not match the documented API schema.",
  },
  failed: {
    tone: "error",
    text: "The read-only check could not reach a healthy Level API response.",
  },
};

export function LevelIntegrationStatus({ status, check }: { status: LevelStatus; check?: string }) {
  const message = check ? checkMessages[check] : undefined;
  return (
    <section className="admin-card integration-status-card" aria-labelledby="level-status-heading">
      <div className="admin-card-header">
        <div>
          <p className="overline">Provider boundary</p>
          <h2 id="level-status-heading">Level.io</h2>
          <p>
            Server-only, read-only connectivity status. The health check reads at most one device;
            approved inventory synchronization runs through the durable worker.
          </p>
        </div>
        <span className={`integration-state${status.configured ? " is-configured" : ""}`}>
          <span aria-hidden="true" />
          {status.configured ? "Key configured" : "Not configured"}
        </span>
      </div>

      <dl className="integration-facts">
        <div>
          <dt>Credential</dt>
          <dd>Server environment</dd>
        </div>
        <div>
          <dt>Required access</dt>
          <dd>Read-only</dd>
        </div>
        <div>
          <dt>API boundary</dt>
          <dd>{status.baseUrl}/v2</dd>
        </div>
        <div>
          <dt>Tenant binding</dt>
          <dd>{status.inventoryOrganizationConfigured ? "Configured" : "Not configured"}</dd>
        </div>
        <div>
          <dt>Scheduled inventory</dt>
          <dd>{status.scheduledInventorySyncEnabled ? "Hourly" : "Manual only"}</dd>
        </div>
      </dl>

      {message ? (
        <p
          className={message.tone === "success" ? "form-success" : "form-error"}
          role={message.tone === "success" ? "status" : "alert"}
        >
          {message.text}
        </p>
      ) : null}

      <div className="integration-actions">
        <form action="/auth/level-health" method="post">
          <button className="secondary-button" type="submit" disabled={!status.configured}>
            Run read-only check
          </button>
        </form>
        {!status.configured ? (
          <p>
            Add <code>LEVEL_API_KEY</code> to the server secret environment to enable the check.
          </p>
        ) : (
          <p>The API key value is never displayed, returned to the browser, or written to logs.</p>
        )}
      </div>
    </section>
  );
}
