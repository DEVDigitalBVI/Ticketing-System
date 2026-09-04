import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/modules/service-desk/components/page-header";
import { getAssetFormOptions, listAssets } from "@/server/assets/service";
import { requireCurrentAccess, accessCan } from "@/server/auth/authorization";
import { isDatabaseUnavailableError } from "@/server/database/errors";

export const metadata: Metadata = { title: "Asset inventory" };

function locationLabel(asset: Awaited<ReturnType<typeof listAssets>>[number]) {
  return [asset.property.name, asset.buildingArea?.name, asset.serviceLocation?.name]
    .filter(Boolean)
    .join(" · ");
}

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; propertyId?: string; status?: string; type?: string }>;
}) {
  const access = await requireCurrentAccess("asset.read");
  const search = await searchParams;
  let assets: Awaited<ReturnType<typeof listAssets>> | undefined;
  let options: Awaited<ReturnType<typeof getAssetFormOptions>> | undefined;
  try {
    [assets, options] = await Promise.all([
      listAssets(access, search),
      getAssetFormOptions(access),
    ]);
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) throw error;
  }
  const canManage = accessCan(access, "asset.manage");

  return (
    <section className="view" aria-labelledby="asset-list-title">
      <PageHeader
        eyebrow="Resort inventory"
        title="Assets"
        titleId="asset-list-title"
        lead="Trace ownership, location, lifecycle state, and service context from one record."
        actionHref={canManage ? "/assets/new" : undefined}
        actionLabel={canManage ? "Add asset" : undefined}
      />
      {assets && options ? (
        <>
          <form className="filter-bar asset-filter" method="get">
            <label className="sr-only" htmlFor="asset-query">
              Search assets
            </label>
            <input
              id="asset-query"
              name="query"
              placeholder="Asset tag, name, or serial number"
              defaultValue={search.query}
            />
            <select name="propertyId" aria-label="Property" defaultValue={search.propertyId ?? ""}>
              <option value="">All properties</option>
              {options.properties.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select name="status" aria-label="Lifecycle status" defaultValue={search.status ?? ""}>
              <option value="">All statuses</option>
              {options.statuses.map((item) => (
                <option key={item.id} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
            <select name="type" aria-label="Asset type" defaultValue={search.type ?? ""}>
              <option value="">All types</option>
              {options.types.map((item) => (
                <option key={item.id} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
            <button className="secondary-button" type="submit">
              Filter
            </button>
          </form>
          <div className="asset-register" aria-label="Asset register">
            {assets.length ? (
              assets.map((asset) => (
                <Link className="asset-register-row" href={`/assets/${asset.id}`} key={asset.id}>
                  <span className="asset-tag">{asset.assetTag}</span>
                  <span className="asset-register-name">
                    <strong>{asset.name}</strong>
                    <small>
                      {asset.assetType.name}
                      {asset.serialNumber ? ` · S/N ${asset.serialNumber}` : ""}
                    </small>
                  </span>
                  <span>
                    <small className="asset-cell-label">Current location</small>
                    {locationLabel(asset)}
                  </span>
                  <span>
                    <small className="asset-cell-label">Custodian</small>
                    {asset.custodian?.displayName ?? "Shared / unassigned"}
                  </span>
                  <span
                    className={`status-pill ${asset.assetStatus.isTerminal ? "waiting" : "progress"}`}
                  >
                    {asset.assetStatus.name}
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
              ))
            ) : (
              <div className="empty-state">
                <strong>No assets match this view</strong>
                <p>Adjust the filters or add the first inventory record.</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <strong>Asset inventory is temporarily unavailable</strong>
          <p>The service database could not be reached.</p>
        </div>
      )}
    </section>
  );
}
