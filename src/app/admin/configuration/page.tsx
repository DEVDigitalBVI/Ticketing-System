import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ConfigurationConsole } from "@/modules/admin/components/configuration-console";
import { ServiceDeskShell } from "@/modules/service-desk/components/service-desk-shell";
import { requireCurrentAccess } from "@/server/auth/authorization";
import { listConfigurationCatalog } from "@/server/configuration/service";

export const metadata: Metadata = { title: "Configuration" };

export default async function ConfigurationPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; id?: string; status?: string }>;
}) {
  const access = await requireCurrentAccess("configuration.manage");
  if (access.assuranceLevel !== "aal2") redirect("/account/mfa?next=/admin/configuration");
  const [search, catalog] = await Promise.all([
    searchParams,
    listConfigurationCatalog(access.organizationId),
  ]);

  return (
    <ServiceDeskShell access={access}>
      <div className="page-shell audit-page configuration-page">
        <ConfigurationConsole catalog={catalog} search={search} />
      </div>
    </ServiceDeskShell>
  );
}
