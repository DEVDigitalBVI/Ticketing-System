import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/modules/service-desk/components/page-header";
import { AssetTransferForm } from "@/modules/assets/components/asset-transfer-form";
import { AssetServiceError } from "@/server/assets/policy";
import { getAssetDetail, getAssetFormOptions } from "@/server/assets/service";
import { accessCan, requireCurrentAccess } from "@/server/auth/authorization";

export const metadata: Metadata = { title: "Asset detail" };

function date(value: Date | null | undefined, includeTime = false) {
  return value
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: includeTime ? "short" : undefined,
        timeZone: "America/Tortola",
      }).format(value)
    : "Not recorded";
}

function location(
  property?: { name: string } | null,
  building?: { name: string } | null,
  room?: { name: string } | null,
) {
  return [property?.name, building?.name, room?.name].filter(Boolean).join(" · ") || "Not recorded";
}

function notice(status?: string) {
  const messages: Record<string, string> = {
    created: "Asset created and its initial location was recorded.",
    updated: "Asset details updated.",
    transferred: "Transfer complete and move history recorded.",
    assigned: "Responsibility updated and assignment history recorded.",
    retired: "Asset retired. Its record and history remain available.",
    conflict: "This asset changed while you were working. Review the latest record and try again.",
    invalid: "Check the selected values and required fields.",
    retired_error: "Retired assets cannot be changed.",
    failed: "The asset change could not be completed.",
  };
  return status ? messages[status] : undefined;
}

export default async function AssetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ assetId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const access = await requireCurrentAccess("asset.read");
  const [{ assetId }, search] = await Promise.all([params, searchParams]);
  try {
    const asset = await getAssetDetail(access, assetId);
    const canManage = accessCan(access, "asset.manage", {
      organizationId: access.organizationId,
      propertyId: asset.propertyId,
    });
    const options = canManage && !asset.retiredAt ? await getAssetFormOptions(access) : undefined;
    const message = notice(
      search.status === "retired" && asset.retiredAt ? "retired" : search.status,
    );
    const activeAssignment = asset.assignments.find((item) => !item.endedAt);

    return (
      <section className="view" aria-labelledby="asset-detail-title">
        <PageHeader
          backHref="/assets"
          backLabel="Asset inventory"
          eyebrow={`${asset.assetType.name} · ${asset.assetTag}`}
          title={asset.name}
          titleId="asset-detail-title"
          lead="Current business-owned inventory context and immutable history."
          actionHref={canManage && !asset.retiredAt ? `/assets/${asset.id}/edit` : undefined}
          actionLabel={canManage && !asset.retiredAt ? "Edit asset" : undefined}
        />
        {message ? (
          <div
            className={
              search.status === "conflict" ||
              search.status === "invalid" ||
              search.status === "failed"
                ? "form-error"
                : "form-success"
            }
            role="status"
          >
            {message}
          </div>
        ) : null}

        <div className="asset-detail-grid">
          <article className="panel asset-identity-card">
            <div className="asset-detail-heading">
              <div>
                <p className="overline">Current record</p>
                <h2>{asset.assetTag}</h2>
              </div>
              <span
                className={`status-pill ${asset.assetStatus.isTerminal ? "waiting" : "progress"}`}
              >
                {asset.assetStatus.name}
              </span>
            </div>
            <dl className="detail-list asset-detail-list">
              <div>
                <dt>Location</dt>
                <dd>{location(asset.property, asset.buildingArea, asset.serviceLocation)}</dd>
              </div>
              <div>
                <dt>Custodian</dt>
                <dd>{asset.custodian?.displayName ?? "Shared / unassigned"}</dd>
              </div>
              <div>
                <dt>Department</dt>
                <dd>{asset.department?.name ?? "Not assigned"}</dd>
              </div>
              <div>
                <dt>Criticality</dt>
                <dd>{asset.criticality.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt>Serial number</dt>
                <dd>{asset.serialNumber ?? "Not recorded"}</dd>
              </div>
              <div>
                <dt>Manufacturer / model</dt>
                <dd>
                  {[asset.manufacturer, asset.model].filter(Boolean).join(" · ") || "Not recorded"}
                </dd>
              </div>
              <div>
                <dt>Acquired</dt>
                <dd>{date(asset.acquiredAt)}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{date(asset.updatedAt, true)}</dd>
              </div>
            </dl>
            {asset.description ? <p className="asset-description">{asset.description}</p> : null}
          </article>

          <aside className="panel asset-procurement-card">
            <p className="overline">Purchase and warranty</p>
            <dl className="detail-list">
              <div>
                <dt>Vendor</dt>
                <dd>{asset.procurement?.vendor?.name ?? "Not recorded"}</dd>
              </div>
              <div>
                <dt>Purchase</dt>
                <dd>
                  {asset.procurement?.purchaseCost
                    ? `${asset.procurement.currencyCode ?? ""} ${asset.procurement.purchaseCost.toString()}`.trim()
                    : "Not recorded"}
                </dd>
              </div>
              <div>
                <dt>Purchase date</dt>
                <dd>{date(asset.procurement?.purchaseDate)}</dd>
              </div>
              <div>
                <dt>PO / reference</dt>
                <dd>{asset.procurement?.purchaseOrder ?? "Not recorded"}</dd>
              </div>
              <div>
                <dt>Warranty period</dt>
                <dd>
                  {asset.procurement?.warrantyStart || asset.procurement?.warrantyEnd
                    ? `${date(asset.procurement.warrantyStart)} — ${date(asset.procurement.warrantyEnd)}`
                    : "Not recorded"}
                </dd>
              </div>
              <div>
                <dt>Warranty reference</dt>
                <dd>{asset.procurement?.warrantyReference ?? "Not recorded"}</dd>
              </div>
              <div>
                <dt>External systems</dt>
                <dd>
                  {asset.externalLinks.length
                    ? asset.externalLinks
                        .map((item) => `${item.systemKey}: ${item.externalId}`)
                        .join(", ")
                    : "None linked"}
                </dd>
              </div>
            </dl>
            <p className="field-intro">Level.io is intentionally not connected in Step 15.</p>
          </aside>
        </div>

        {options ? (
          <section className="asset-actions" aria-labelledby="asset-actions-title">
            <div>
              <p className="overline">Controlled changes</p>
              <h2 id="asset-actions-title">Move, assign, or retire</h2>
            </div>
            <div className="asset-action-grid">
              <AssetTransferForm
                asset={{
                  id: asset.id,
                  updatedAt: asset.updatedAt,
                  propertyId: asset.propertyId,
                  buildingAreaId: asset.buildingAreaId,
                  serviceLocationId: asset.serviceLocationId,
                }}
                options={options}
              />
              <form className="panel compact-asset-form" action="/auth/asset" method="post">
                <input type="hidden" name="intent" value="assign" />
                <input type="hidden" name="assetId" value={asset.id} />
                <input
                  type="hidden"
                  name="expectedUpdatedAt"
                  value={asset.updatedAt.toISOString()}
                />
                <h3>Assign responsibility</h3>
                <label>
                  <span className="field-label">Custodian</span>
                  <select name="custodianUserId" defaultValue={asset.custodianUserId ?? ""}>
                    <option value="">No individual custodian</option>
                    {options.users
                      .filter((item) => item.propertyIds.includes(asset.propertyId))
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.displayName}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  <span className="field-label">Department</span>
                  <select name="departmentId" defaultValue={asset.departmentId ?? ""}>
                    <option value="">No department</option>
                    {options.departments
                      .filter((item) => item.propertyId === asset.propertyId)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  <span className="field-label">Assignment note</span>
                  <textarea name="note" maxLength={1000} rows={2} />
                </label>
                <button className="secondary-button" type="submit">
                  Record assignment
                </button>
              </form>
              <form
                className="panel compact-asset-form retire-form"
                action="/auth/asset"
                method="post"
              >
                <input type="hidden" name="intent" value="retire" />
                <input type="hidden" name="assetId" value={asset.id} />
                <input
                  type="hidden"
                  name="expectedUpdatedAt"
                  value={asset.updatedAt.toISOString()}
                />
                <h3>Retire asset</h3>
                <p>Retirement preserves this record and all move and assignment history.</p>
                <label>
                  <span className="field-label">Retirement reason</span>
                  <textarea name="reason" required minLength={2} maxLength={1000} rows={2} />
                </label>
                <button className="danger-button" type="submit">
                  Retire asset
                </button>
              </form>
            </div>
          </section>
        ) : null}

        <div className="asset-history-grid">
          <section className="panel" aria-labelledby="move-history-title">
            <p className="overline">Location history</p>
            <h2 id="move-history-title">Moves</h2>
            <ol className="asset-timeline">
              {asset.locationHistory.map((move) => (
                <li key={move.id}>
                  <span className="timeline-mark" />
                  <div>
                    <strong>
                      {location(move.toProperty, move.toBuildingArea, move.toServiceLocation)}
                    </strong>
                    <p>
                      {move.fromProperty
                        ? `From ${location(move.fromProperty, move.fromBuildingArea, move.fromServiceLocation)} · `
                        : ""}
                      {move.reason}
                    </p>
                    <small>
                      {date(move.movedAt, true)} · {move.movedBy.displayName}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <section className="panel" aria-labelledby="assignment-history-title">
            <p className="overline">Responsibility history</p>
            <h2 id="assignment-history-title">Assignments</h2>
            {activeAssignment ? (
              <p className="field-intro">Current since {date(activeAssignment.assignedAt, true)}</p>
            ) : null}
            <ol className="asset-timeline">
              {asset.assignments.length ? (
                asset.assignments.map((assignment) => (
                  <li key={assignment.id}>
                    <span className="timeline-mark" />
                    <div>
                      <strong>
                        {assignment.custodian?.displayName ??
                          assignment.department?.name ??
                          "Unassigned"}
                      </strong>
                      <p>{assignment.note ?? "Assignment recorded"}</p>
                      <small>
                        {date(assignment.assignedAt, true)}
                        {assignment.endedAt
                          ? ` — ${date(assignment.endedAt, true)}`
                          : " — current"}{" "}
                        · {assignment.assignedBy.displayName}
                      </small>
                    </div>
                  </li>
                ))
              ) : (
                <li>
                  <div>
                    <strong>No assignment history</strong>
                    <p>This asset is shared and has not been assigned.</p>
                  </div>
                </li>
              )}
            </ol>
          </section>
        </div>
      </section>
    );
  } catch (error) {
    if (error instanceof AssetServiceError) notFound();
    throw error;
  }
}
