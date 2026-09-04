"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Option = { id: string; name: string };
export type AssetFormOptions = {
  properties: Option[];
  buildings: Array<Option & { propertyId: string }>;
  locations: Array<Option & { propertyId: string; buildingAreaId: string }>;
  departments: Array<Option & { propertyId: string }>;
  users: Array<{ id: string; displayName: string; email: string; propertyIds: string[] }>;
  types: Array<Option & { code: string }>;
  statuses: Array<Option & { code: string; isTerminal: boolean }>;
  vendors: Option[];
};

type AssetDefaults = {
  id: string;
  updatedAt: Date;
  assetTag: string;
  serialNumber: string | null;
  name: string;
  description: string | null;
  assetTypeId: string;
  assetStatusId: string;
  propertyId: string;
  buildingAreaId: string | null;
  serviceLocationId: string | null;
  departmentId: string | null;
  custodianUserId: string | null;
  criticality: string;
  manufacturer: string | null;
  model: string | null;
  acquiredAt: Date | null;
  procurement: {
    vendorId: string | null;
    purchaseDate: Date | null;
    purchaseCost: string | null;
    currencyCode: string | null;
    purchaseOrder: string | null;
    warrantyStart: Date | null;
    warrantyEnd: Date | null;
    warrantyReference: string | null;
    notes: string | null;
  } | null;
};

function dateValue(value: Date | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

export function AssetForm({
  options,
  asset,
}: {
  options: AssetFormOptions;
  asset?: AssetDefaults;
}) {
  const [propertyId, setPropertyId] = useState(
    asset?.propertyId ?? options.properties[0]?.id ?? "",
  );
  const [buildingAreaId, setBuildingAreaId] = useState(asset?.buildingAreaId ?? "");
  const buildings = useMemo(
    () => options.buildings.filter((item) => item.propertyId === propertyId),
    [options.buildings, propertyId],
  );
  const locations = useMemo(
    () =>
      options.locations.filter(
        (item) => item.propertyId === propertyId && item.buildingAreaId === buildingAreaId,
      ),
    [options.locations, propertyId, buildingAreaId],
  );
  const departments = useMemo(
    () => options.departments.filter((item) => item.propertyId === propertyId),
    [options.departments, propertyId],
  );
  const users = useMemo(
    () => options.users.filter((item) => item.propertyIds.includes(propertyId)),
    [options.users, propertyId],
  );
  const edit = Boolean(asset);

  return (
    <form className="asset-form form-section" action="/auth/asset" method="post">
      <input type="hidden" name="intent" value={edit ? "edit" : "create"} />
      {asset ? (
        <>
          <input type="hidden" name="assetId" value={asset.id} />
          <input type="hidden" name="expectedUpdatedAt" value={asset.updatedAt.toISOString()} />
        </>
      ) : null}
      <div className="form-section-content">
        <p className="overline">Identity</p>
        <div className="field-pair">
          <label>
            <span className="field-label">Resort asset tag</span>
            <input
              name="assetTag"
              required
              minLength={2}
              maxLength={50}
              defaultValue={asset?.assetTag}
            />
          </label>
          <label>
            <span className="field-label">Serial number</span>
            <input name="serialNumber" maxLength={120} defaultValue={asset?.serialNumber ?? ""} />
          </label>
        </div>
        <label>
          <span className="field-label">Asset name</span>
          <input name="name" required minLength={2} maxLength={160} defaultValue={asset?.name} />
        </label>
        <label>
          <span className="field-label">Description</span>
          <textarea
            name="description"
            rows={3}
            maxLength={2000}
            defaultValue={asset?.description ?? ""}
          />
        </label>
        <div className="field-pair">
          <label>
            <span className="field-label">Asset type</span>
            <select name="assetTypeId" required defaultValue={asset?.assetTypeId}>
              {options.types.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Lifecycle status</span>
            <select name="assetStatusId" required defaultValue={asset?.assetStatusId}>
              {options.statuses
                .filter((item) => !item.isTerminal)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className="field-pair">
          <label>
            <span className="field-label">Criticality</span>
            <select name="criticality" defaultValue={asset?.criticality ?? "standard"}>
              <option value="low">Low</option>
              <option value="standard">Standard</option>
              <option value="high">High</option>
              <option value="mission_critical">Mission critical</option>
            </select>
          </label>
          <label>
            <span className="field-label">Acquired date</span>
            <input name="acquiredAt" type="date" defaultValue={dateValue(asset?.acquiredAt)} />
          </label>
        </div>
        <div className="field-pair">
          <label>
            <span className="field-label">Manufacturer</span>
            <input name="manufacturer" maxLength={120} defaultValue={asset?.manufacturer ?? ""} />
          </label>
          <label>
            <span className="field-label">Model</span>
            <input name="model" maxLength={120} defaultValue={asset?.model ?? ""} />
          </label>
        </div>

        {!edit ? (
          <>
            <p className="overline asset-form-divider">Initial location and responsibility</p>
            <div className="field-pair">
              <label>
                <span className="field-label">Property</span>
                <select
                  name="propertyId"
                  required
                  value={propertyId}
                  onChange={(event) => {
                    setPropertyId(event.target.value);
                    setBuildingAreaId("");
                  }}
                >
                  {options.properties.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">Building or area</span>
                <select
                  name="buildingAreaId"
                  value={buildingAreaId}
                  onChange={(event) => setBuildingAreaId(event.target.value)}
                >
                  <option value="">Property-level</option>
                  {buildings.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="field-pair">
              <label>
                <span className="field-label">Room or outlet</span>
                <select name="serviceLocationId" defaultValue={asset?.serviceLocationId ?? ""}>
                  <option value="">No specific room</option>
                  {locations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">Department</span>
                <select name="departmentId" defaultValue={asset?.departmentId ?? ""}>
                  <option value="">Unassigned</option>
                  {departments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              <span className="field-label">Custodian</span>
              <select name="custodianUserId" defaultValue={asset?.custodianUserId ?? ""}>
                <option value="">Shared / no individual custodian</option>
                {users.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.displayName} · {item.email}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}

        <p className="overline asset-form-divider">Purchase and warranty</p>
        <div className="field-pair">
          <label>
            <span className="field-label">Vendor</span>
            <select name="vendorId" defaultValue={asset?.procurement?.vendorId ?? ""}>
              <option value="">No vendor recorded</option>
              {options.vendors.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Purchase order</span>
            <input
              name="purchaseOrder"
              maxLength={120}
              defaultValue={asset?.procurement?.purchaseOrder ?? ""}
            />
          </label>
        </div>
        <div className="field-pair">
          <label>
            <span className="field-label">Purchase date</span>
            <input
              name="purchaseDate"
              type="date"
              defaultValue={dateValue(asset?.procurement?.purchaseDate)}
            />
          </label>
          <label>
            <span className="field-label">Purchase cost</span>
            <span className="asset-money-field">
              <input
                name="currencyCode"
                aria-label="Currency"
                maxLength={3}
                defaultValue={asset?.procurement?.currencyCode ?? "USD"}
              />
              <input
                name="purchaseCost"
                aria-label="Purchase cost"
                type="number"
                min="0"
                step="0.01"
                defaultValue={asset?.procurement?.purchaseCost ?? ""}
              />
            </span>
          </label>
        </div>
        <div className="field-pair">
          <label>
            <span className="field-label">Warranty start</span>
            <input
              name="warrantyStart"
              type="date"
              defaultValue={dateValue(asset?.procurement?.warrantyStart)}
            />
          </label>
          <label>
            <span className="field-label">Warranty end</span>
            <input
              name="warrantyEnd"
              type="date"
              defaultValue={dateValue(asset?.procurement?.warrantyEnd)}
            />
          </label>
        </div>
        <label>
          <span className="field-label">Warranty reference</span>
          <input
            name="warrantyReference"
            maxLength={160}
            defaultValue={asset?.procurement?.warrantyReference ?? ""}
          />
        </label>
        <label>
          <span className="field-label">Procurement notes</span>
          <textarea
            name="procurementNotes"
            rows={3}
            maxLength={2000}
            defaultValue={asset?.procurement?.notes ?? ""}
          />
        </label>
        <div className="form-actions">
          <Link className="secondary-button" href={asset ? `/assets/${asset.id}` : "/assets"}>
            Cancel
          </Link>
          <button className="primary-button" type="submit">
            {edit ? "Save asset" : "Create asset"}
          </button>
        </div>
      </div>
    </form>
  );
}
