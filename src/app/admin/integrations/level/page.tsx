import type { Metadata } from "next";

import { ServiceDeskShell } from "@/modules/service-desk/components/service-desk-shell";
import { requireCurrentAccess } from "@/server/auth/authorization";
import { isDatabaseUnavailableError } from "@/server/database/errors";
import { getLevelConfigurationStatus } from "@/server/integrations/level/configuration";
import { readLevelReconciliation } from "@/server/integrations/level/reconciliation";

export const metadata: Metadata = { title: "Level inventory reconciliation" };

function timestamp(value: Date | null) {
  return value ? value.toISOString().replace("T", " ").replace(".000Z", " UTC") : "Not reported";
}

export default async function LevelReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ sync?: string; reconcile?: string }>;
}) {
  const access = await requireCurrentAccess("configuration.manage");
  const search = await searchParams;
  const configuration = getLevelConfigurationStatus();
  let data;
  try {
    data = await readLevelReconciliation(access);
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) throw error;
  }

  return (
    <ServiceDeskShell access={access}>
      <div className="page-shell job-operations-page">
        <header className="page-header narrow-header">
          <div>
            <p className="overline">Integrations</p>
            <h1>Level inventory reconciliation</h1>
            <p>Review remote devices that cannot be linked safely to one resort-owned asset.</p>
          </div>
          <form action="/auth/level-sync" method="post">
            <button
              className="primary-button"
              type="submit"
              disabled={!configuration.configured || !configuration.inventoryOrganizationConfigured}
            >
              Queue inventory sync
            </button>
          </form>
        </header>

        {search.sync === "queued" ? <p className="form-banner success">Inventory sync queued.</p> : null}
        {search.reconcile === "linked" ? <p className="form-banner success">Device linked to the selected asset.</p> : null}
        {search.sync === "failed" || search.reconcile === "failed" ? (
          <p className="form-banner error">The requested operation could not be completed safely.</p>
        ) : null}

        {data ? (
          <>
            <section className="job-health-grid" aria-label="Level inventory health">
              {(["unmatched", "ambiguous", "stale", "failed"] as const).map((state) => (
                <article className={`job-health-card${state === "failed" ? " is-danger" : ""}`} key={state}>
                  <span>{state}</span>
                  <strong>{data.devices.filter((device) => device.syncState === state).length}</strong>
                </article>
              ))}
            </section>

            <section className="admin-card">
              <div className="admin-card-header">
                <div>
                  <h2>Devices needing review</h2>
                  <p>Hostname is context only. Choose an asset only after verifying its identity.</p>
                </div>
              </div>
              {data.devices.length ? (
                <div className="audit-table-wrap">
                  <table className="audit-table job-table">
                    <thead><tr><th>Level device</th><th>State</th><th>Last sync</th><th>Reconcile</th></tr></thead>
                    <tbody>
                      {data.devices.map((device) => (
                        <tr key={device.id}>
                          <td><strong>{device.hostname ?? "Unnamed device"}</strong><small>ID: {device.levelDeviceId}</small><small>Serial: {device.serialNumber ?? "Not reported"}</small></td>
                          <td><span className={`audit-result ${device.syncState === "failed" ? "failure" : "denied"}`}>{device.syncState}</span>{device.lastErrorCode ? <small>{device.lastErrorCode}</small> : null}</td>
                          <td>{timestamp(device.lastSyncedAt)}</td>
                          <td>
                            <form action="/auth/level-reconcile" method="post" className="inline-reconciliation-form">
                              <input type="hidden" name="deviceId" value={device.id} />
                              <select name="assetId" required aria-label={`Asset for ${device.hostname ?? device.levelDeviceId}`} defaultValue="">
                                <option value="" disabled>Select asset</option>
                                {data.assets.map((asset) => <option value={asset.id} key={asset.id}>{asset.assetTag} — {asset.name}{asset.serialNumber ? ` · ${asset.serialNumber}` : ""}</option>)}
                              </select>
                              <button className="ghost-button" type="submit">Link</button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="empty-state job-empty-state"><strong>No devices need review</strong><p>The latest completed inventory is reconciled.</p></div>}
            </section>

            <section className="admin-card">
              <div className="admin-card-header"><div><h2>Recent sync runs</h2><p>Each worker attempt is retained, including partial and failed runs.</p></div></div>
              <div className="audit-table-wrap"><table className="audit-table"><thead><tr><th>Started</th><th>Trigger</th><th>Status</th><th>Results</th></tr></thead><tbody>
                {data.runs.map((run) => <tr key={run.id}><td>{timestamp(run.startedAt)}</td><td>{run.trigger}</td><td>{run.status}</td><td>{run.devicesMatched} matched · {run.devicesUnmatched} unmatched · {run.devicesAmbiguous} ambiguous · {run.devicesFailed} failed · {run.devicesStale} stale</td></tr>)}
              </tbody></table></div>
            </section>
          </>
        ) : <section className="empty-state"><strong>Reconciliation data is temporarily unavailable</strong><p>Restore the service database connection, then refresh.</p></section>}
      </div>
    </ServiceDeskShell>
  );
}
