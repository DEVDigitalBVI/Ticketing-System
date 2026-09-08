import type { Metadata } from "next";
import Link from "next/link";

import { ServiceDeskShell } from "@/modules/service-desk/components/service-desk-shell";
import { requireCurrentAccess } from "@/server/auth/authorization";
import { readLevelAlertRuleAdministration } from "@/server/integrations/level/alert-administration";
import { levelAlertSeverities } from "@/server/integrations/level/alert-policy";

export const metadata: Metadata = { title: "Level alert rules" };

export default async function LevelAlertRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; edit?: string }>;
}) {
  const access = await requireCurrentAccess("configuration.manage");
  const [data, search] = await Promise.all([
    readLevelAlertRuleAdministration(access),
    searchParams,
  ]);
  const editing = data.rules.find((rule) => rule.id === search.edit);
  const priorityMap =
    editing?.severityPriorityMap && typeof editing.severityPriorityMap === "object"
      ? (editing.severityPriorityMap as Record<string, string>)
      : {};
  return (
    <ServiceDeskShell access={access}>
      <div className="page-shell alert-automation-page">
        <header className="page-header narrow-header">
          <div>
            <p className="overline">Level automation</p>
            <h1>Alert routing rules</h1>
            <p>Turn only approved device alerts into controlled, correlated incidents.</p>
          </div>
          <div className="header-actions">
            <Link className="ghost-button" href="/admin/integrations/level/exceptions">
              Exception queue
            </Link>
            <Link className="ghost-button" href="/admin/integrations/level">
              Reconciliation
            </Link>
          </div>
        </header>
        {search.status === "saved" ? (
          <p className="form-banner success">Alert rule saved.</p>
        ) : null}
        {search.status === "failed" ? (
          <p className="form-banner error">The rule could not be saved safely.</p>
        ) : null}

        <section className="admin-card alert-rule-summary">
          <div className="admin-card-header">
            <div>
              <h2>Decision order</h2>
              <p>The first enabled rule matching property, severity, and alert name wins.</p>
            </div>
          </div>
          {data.rules.length ? (
            <div className="audit-table-wrap">
              <table className="audit-table job-table">
                <thead>
                  <tr>
                    <th>Rule</th>
                    <th>Match</th>
                    <th>Controls</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rules.map((rule) => (
                    <tr key={rule.id}>
                      <td>
                        <strong>{rule.name}</strong>
                        <small>
                          Order {rule.sortOrder} · {rule.autoResolvePolicy.replaceAll("_", " ")}
                        </small>
                      </td>
                      <td>
                        {rule.matchSeverities.join(", ")}
                        <small>
                          {rule.matchNameContains
                            ? `Name contains “${rule.matchNameContains}”`
                            : "Any alert name"}
                        </small>
                      </td>
                      <td>
                        {rule.correlationWindowMinutes} min correlation
                        <small>{rule.suppressionWindowMinutes} min suppression</small>
                      </td>
                      <td>
                        <span className={`audit-result ${rule.isEnabled ? "success" : "denied"}`}>
                          {rule.isEnabled ? (rule.dryRun ? "Dry run" : "Live") : "Disabled"}
                        </span>
                        <form action="/auth/level-alert-rule" method="post">
                          <input type="hidden" name="intent" value="toggle" />
                          <input type="hidden" name="ruleId" value={rule.id} />
                          <input type="hidden" name="enabled" value={String(!rule.isEnabled)} />
                          <button className="text-button" type="submit">
                            {rule.isEnabled ? "Disable" : "Enable"}
                          </button>
                        </form>
                        <Link
                          className="text-button"
                          href={`/admin/integrations/level/alert-rules?edit=${rule.id}`}
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state job-empty-state">
              <strong>No alert rules yet</strong>
              <p>
                Create the first rule in dry-run mode, then validate its decisions before enabling
                live creation.
              </p>
            </div>
          )}
        </section>

        <section className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2>Recent create-or-ignore decisions</h2>
              <p>Each accepted alert has one idempotent outcome with a human-readable reason.</p>
            </div>
          </div>
          {data.decisions.length ? (
            <div className="audit-table-wrap">
              <table className="audit-table job-table">
                <thead>
                  <tr>
                    <th>Outcome</th>
                    <th>Explanation</th>
                    <th>Correlation</th>
                    <th>Recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {data.decisions.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span
                          className={`audit-result ${item.outcome === "exception" ? "failure" : item.outcome === "ignored" || item.outcome === "suppressed" ? "denied" : "success"}`}
                        >
                          {item.outcome.replaceAll("_", " ")}
                        </span>
                        <small>{item.reasonCode.replaceAll("_", " ")}</small>
                      </td>
                      <td>{item.explanation}</td>
                      <td>
                        <small>{item.correlationKey ?? "No incident correlation"}</small>
                      </td>
                      <td>
                        {item.createdAt.toISOString().replace("T", " ").replace(".000Z", " UTC")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state job-empty-state">
              <strong>No alert decisions yet</strong>
              <p>Dry-run and live outcomes will appear after signed alert events are processed.</p>
            </div>
          )}
        </section>

        <section className="admin-card">
          <div className="admin-card-header">
            <div>
              <p className="overline">{editing ? "Edit rule" : "New rule"}</p>
              <h2>{editing ? editing.name : "Controlled alert mapping"}</h2>
              <p>Templates accept only the documented placeholders shown below.</p>
            </div>
          </div>
          <form className="alert-rule-form" action="/auth/level-alert-rule" method="post">
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
            <div className="form-grid two-column">
              <label>
                <span>Rule name</span>
                <input
                  name="name"
                  required
                  minLength={3}
                  maxLength={120}
                  placeholder="Critical infrastructure alerts"
                  defaultValue={editing?.name}
                />
              </label>
              <label>
                <span>Decision order</span>
                <input
                  name="sortOrder"
                  type="number"
                  min="0"
                  max="10000"
                  defaultValue={editing?.sortOrder ?? 100}
                />
              </label>
              <label>
                <span>Property scope</span>
                <select name="propertyId" defaultValue={editing?.propertyId ?? ""}>
                  <option value="">Any mapped property</option>
                  {data.properties.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Integration requester</span>
                <select
                  name="requesterUserId"
                  required
                  defaultValue={editing?.requesterUserId ?? ""}
                >
                  <option value="" disabled>
                    Select requester
                  </option>
                  {data.users.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Category</span>
                <select name="categoryId" required defaultValue={editing?.categoryId ?? ""}>
                  <option value="" disabled>
                    Select category
                  </option>
                  {data.categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Subcategory</span>
                <select name="subcategoryId" defaultValue={editing?.subcategoryId ?? ""}>
                  <option value="">No subcategory</option>
                  {data.subcategories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Support team</span>
                <select name="supportTeamId" defaultValue={editing?.supportTeamId ?? ""}>
                  <option value="">Leave unassigned</option>
                  {data.supportTeams.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <small>Choose a property scope when assigning a team.</small>
              </label>
              <label>
                <span>Alert name contains</span>
                <input
                  name="matchNameContains"
                  maxLength={120}
                  placeholder="Optional, for example disk"
                  defaultValue={editing?.matchNameContains ?? ""}
                />
              </label>
            </div>
            <fieldset className="alert-severity-grid">
              <legend>Severity and ticket priority</legend>
              {levelAlertSeverities.map((severity) => (
                <label key={severity}>
                  <input
                    type="checkbox"
                    name={`severity.${severity}`}
                    defaultChecked={editing ? editing.matchSeverities.includes(severity) : true}
                  />
                  <span>{severity}</span>
                  <select
                    name={`priority.${severity}`}
                    defaultValue={
                      priorityMap[severity] ??
                      (severity === "emergency"
                        ? "P1"
                        : severity === "critical"
                          ? "P2"
                          : severity === "warning"
                            ? "P3"
                            : "P4")
                    }
                    aria-label={`${severity} priority`}
                  >
                    {["P1", "P2", "P3", "P4"].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
              ))}
            </fieldset>
            <div className="form-grid two-column">
              <label>
                <span>Subject template</span>
                <input
                  name="subjectTemplate"
                  required
                  maxLength={180}
                  defaultValue={editing?.subjectTemplate ?? "{{alert.name}} · {{device.name}}"}
                />
              </label>
              <label>
                <span>Auto-resolution</span>
                <select
                  name="autoResolvePolicy"
                  defaultValue={editing?.autoResolvePolicy ?? "never"}
                >
                  <option value="never">Never close automatically</option>
                  <option value="if_unstarted">Resolve only before work starts</option>
                </select>
              </label>
              <label>
                <span>Correlation window in minutes</span>
                <input
                  name="correlationWindowMinutes"
                  type="number"
                  min="1"
                  max="10080"
                  defaultValue={editing?.correlationWindowMinutes ?? 60}
                />
              </label>
              <label>
                <span>Suppression window in minutes</span>
                <input
                  name="suppressionWindowMinutes"
                  type="number"
                  min="0"
                  max="10080"
                  defaultValue={editing?.suppressionWindowMinutes ?? 15}
                />
              </label>
            </div>
            <label>
              <span>Description template</span>
              <textarea
                name="descriptionTemplate"
                required
                maxLength={4000}
                rows={6}
                defaultValue={
                  editing?.descriptionTemplate ??
                  "Level.io reported {{alert.severity}}: {{alert.description}}\n\nDevice: {{device.name}}\nAsset: {{asset.tag}} · {{asset.name}}\nProperty: {{property.name}}\nLocation: {{location.name}}\nObserved: {{alert.startedAt}}\nSafe context: {{alert.payload}}"
                }
              />
              <small>
                Available: alert.name, alert.description, alert.payload, alert.severity,
                alert.startedAt, device.name, device.id, asset.tag, asset.name, property.name,
                location.name.
              </small>
            </label>
            <div className="alert-rule-controls">
              <label>
                <input type="checkbox" name="dryRun" defaultChecked={editing?.dryRun ?? true} />{" "}
                Start in dry-run mode
              </label>
              <label>
                <input
                  type="checkbox"
                  name="isEnabled"
                  defaultChecked={editing?.isEnabled ?? false}
                />{" "}
                Enable immediately
              </label>
              {editing ? (
                <Link className="ghost-button" href="/admin/integrations/level/alert-rules">
                  Cancel
                </Link>
              ) : null}
              <button className="primary-button" type="submit">
                {editing ? "Update rule" : "Save rule"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </ServiceDeskShell>
  );
}
