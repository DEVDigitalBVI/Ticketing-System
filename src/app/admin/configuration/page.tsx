import type { Metadata } from "next";

import { ConfigurationConsole } from "@/modules/admin/components/configuration-console";
import { LevelIntegrationStatus } from "@/modules/admin/components/level-integration-status";
import { ServiceDeskShell } from "@/modules/service-desk/components/service-desk-shell";
import { requireCurrentAccess } from "@/server/auth/authorization";
import { isDatabaseUnavailableError } from "@/server/database/errors";
import { listConfigurationCatalog } from "@/server/configuration/service";
import { getLevelConfigurationStatus } from "@/server/integrations/level/configuration";

export const metadata: Metadata = { title: "Configuration" };

export default async function ConfigurationPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; id?: string; status?: string; level?: string }>;
}) {
  const access = await requireCurrentAccess("configuration.manage");
  const search = await searchParams;
  const levelStatus = getLevelConfigurationStatus();
  let catalog;

  try {
    catalog = await listConfigurationCatalog(access.organizationId);
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) throw error;
  }

  return (
    <ServiceDeskShell access={access}>
      <div className="page-shell audit-page configuration-page configuration-stack">
        <LevelIntegrationStatus status={levelStatus} check={search.level} />
        {catalog ? (
          <ConfigurationConsole catalog={catalog} search={search} />
        ) : (
          <section className="admin-card">
            <div className="admin-card-header">
              <div>
                <p className="overline">Configuration administration</p>
                <h1>Resort hierarchy and service taxonomy</h1>
                <p>
                  Configuration data is temporarily unavailable because the local database is
                  offline.
                </p>
              </div>
            </div>
            <div className="empty-state audit-empty-state">
              <strong>Configuration could not be loaded</strong>
              <p>Restore the local service database connection, then refresh this page.</p>
            </div>
          </section>
        )}
      </div>
    </ServiceDeskShell>
  );
}
